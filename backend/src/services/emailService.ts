import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { logger } from '../utils/logger';

// Initialize nodemailer transporter with Gmail - try port 587 (TLS) if 465 (SSL) fails
let transporter: nodemailer.Transporter | null = null;
let fallbackTransporter: nodemailer.Transporter | null = null;
let resendClient: Resend | null = null;

const gmailUser = process.env.GMAIL_USER?.trim();
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
const resendApiKey = process.env.RESEND_API_KEY?.trim();
const resendFromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'Memovoice <onboarding@resend.dev>';
const hasProductionResendSender = resendFromEmail.includes('@') && !resendFromEmail.includes('onboarding@resend.dev');

// Log what we're reading at startup for debugging
logger.info({
  gmailUserSet: !!gmailUser,
  gmailUserValue: gmailUser ? `${gmailUser.substring(0, 3)}...` : 'NOT SET',
  gmailAppPasswordSet: !!gmailAppPassword,
  resendApiKeySet: !!resendApiKey,
  resendFromEmail,
  hasProductionResendSender,
}, 'Email service startup - checking credentials');

// Initialize Resend client if API key is provided
if (resendApiKey) {
  resendClient = new Resend(resendApiKey);
}

const createTransporter = (port: number) => {
  if (!gmailUser || !gmailAppPassword) {
    logger.warn('Gmail credentials not configured (GMAIL_USER or GMAIL_APP_PASSWORD missing)');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure: port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
};

transporter = createTransporter(587);
fallbackTransporter = createTransporter(465);

// Verify connection at startup with timeout
if (transporter) {
  transporter.verify((error, _success) => {
    if (error) {
      logger.error(
        { error: JSON.stringify(error) },
        `Email service verification failed (code: ${(error as any).code}, errno: ${(error as any).errno}). Emails will not be sent.`
      );
      logger.info(
        'TROUBLESHOOTING: Verify GMAIL_USER and GMAIL_APP_PASSWORD are set correctly on Railway. Gmail requires App Password (not account password) if 2FA is enabled.'
      );

      if (fallbackTransporter) {
        fallbackTransporter.verify((fallbackError, _fallbackSuccess) => {
          if (fallbackError) {
            logger.error(
              { error: JSON.stringify(fallbackError) },
              `Fallback Gmail verification also failed (code: ${(fallbackError as any).code}, errno: ${(fallbackError as any).errno}).`
            );
          } else {
            logger.info('Fallback Gmail transporter verified on port 465');
            transporter = fallbackTransporter;
          }
        });
      }
    } else {
      logger.info('Email service verified and ready to send emails');
    }
  });
}

/**
 * Send email via Resend API
 */
const sendEmailWithResend = async (
  mailOptions: nodemailer.SendMailOptions
): Promise<{ success: boolean; messageId?: string; validationError?: boolean; error?: any }> => {
  if (!resendClient) {
    logger.warn('Resend client not initialized (RESEND_API_KEY not set)');
    return { success: false };
  }

  try {
    const response = await resendClient.emails.send({
      from: resendFromEmail,
      to: mailOptions.to as string,
      subject: mailOptions.subject as string,
      html: mailOptions.html as string,
    });

    if (response.error) {
      // Detect common validation error (testing mode / unverified domain)
      const err = response.error as any;
      if (err && (err.name === 'validation_error' || err.statusCode === 403)) {
        logger.error({ error: err, resendFromEmail }, 'Resend API returned validation_error: testing-mode or unverified domain');
        logger.info('REMEDY: Verify a sending domain at https://resend.com/domains and set RESEND_FROM_EMAIL to a verified address (e.g. "Name <you@yourdomain.com>").');
        return { success: false, validationError: true, error: err };
      }

      logger.error({ error: response.error }, 'Resend API returned error');
      return { success: false, error: response.error };
    }

    logger.info({ messageId: response.data?.id }, 'Email sent via Resend API (fallback)');
    return { success: true, messageId: response.data?.id };
  } catch (error: any) {
    // Catch thrown errors from the SDK and surface validation errors explicitly
    const err = error as any;
    if (err && (err.name === 'validation_error' || err.statusCode === 403)) {
      logger.error({ error: err, resendFromEmail }, 'Resend API thrown validation_error: testing-mode or unverified domain');
      logger.info('REMEDY: Verify a sending domain at https://resend.com/domains and set RESEND_FROM_EMAIL to a verified address (e.g. "Name <you@yourdomain.com>").');
      return { success: false, validationError: true, error: err };
    }

    logger.error({ error: err?.message ?? err }, 'Resend API request failed');
    return { success: false, error: err };
  }
};

/**
 * Send email with automatic fallback retry (Gmail SMTP → Resend API)
 */
const sendEmailWithRetry = async (
  mailOptions: nodemailer.SendMailOptions
): Promise<{ success: boolean; messageId?: string }> => {
  if (!transporter && !fallbackTransporter && !resendClient) {
    logger.warn('No email transporters available (Gmail SMTP and Resend API not configured)');
    return { success: false };
  }

  // Prefer Resend in production when a verified sender is configured.
  if (resendClient && hasProductionResendSender) {
    const resendResult = await sendEmailWithResend(mailOptions);
    if (resendResult.success) {
      return resendResult;
    }

    // If Resend rejected due to validation/testing mode, log clear remediation and avoid confusing retries
    if (resendResult.validationError) {
      logger.error({ resendFromEmail, to: mailOptions.to }, 'Resend is in testing mode or the sending domain is unverified. Emails to other recipients are blocked.');
      logger.info('Action: Verify a sending domain at https://resend.com/domains and set RESEND_FROM_EMAIL to the verified address.');
      return { success: false };
    }

    logger.warn('Primary Resend send failed; falling back to Gmail SMTP if available');
  }

  // Try primary transporter (Gmail SMTP port 587)
  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (primaryError: any) {
      logger.warn(
        { error: primaryError.message, code: primaryError.code },
        'Primary Gmail transporter failed; attempting fallback on port 465'
      );

      // Try fallback transporter (Gmail SMTP port 465)
      if (fallbackTransporter && fallbackTransporter !== transporter) {
        try {
          const info = await fallbackTransporter.sendMail(mailOptions);
          logger.info('Email sent via fallback Gmail transporter (port 465)');
          return { success: true, messageId: info.messageId };
        } catch (fallbackError: any) {
          logger.warn(
            { primaryError: primaryError.message, fallbackError: fallbackError.message },
            'Both Gmail transporters failed; attempting Resend API'
          );
          // Try Resend API as final fallback
          return await sendEmailWithResend(mailOptions);
        }
      }
      // If no fallback transporter, try Resend directly
      return await sendEmailWithResend(mailOptions);
    }
  }

  // If primary is null, try fallback directly
  if (fallbackTransporter) {
    try {
      const info = await fallbackTransporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      logger.warn(
        { error: error.message },
        'Fallback Gmail transporter failed; attempting Resend API'
      );
      return await sendEmailWithResend(mailOptions);
    }
  }

  // If no SMTP transporters, try Resend API
  return await sendEmailWithResend(mailOptions);
};

/**
 * Send welcome/sign-up email
 */
export const sendWelcomeEmail = async (email: string, firstName: string): Promise<boolean> => {
  try {
    const mailOptions = {
      from: resendClient && hasProductionResendSender ? resendFromEmail : gmailUser,
      to: email,
      subject: 'Welcome to Memovoice - Professional Intelligence Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to Memovoice</h1>
          </div>
          <div style="background: #f5f5f5; padding: 40px; border-radius: 0 0 8px 8px;">
            <p style="color: #333; font-size: 16px;">Hello <strong>${firstName}</strong>,</p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Thank you for joining Memovoice! Your account has been successfully created and is ready to use.
            </p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              <strong>Getting Started:</strong>
            </p>
            <ul style="color: #666; font-size: 14px; line-height: 1.8;">
              <li>Open the Memovoice app to begin recording meetings</li>
              <li>Your meetings will be automatically transcribed</li>
              <li>Get AI-powered summaries and insights</li>
              <li>Upgrade to Pro for advanced features</li>
            </ul>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              If you have any questions, contact our support team at support@memovoice.com
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              Memovoice Team<br>
              <em>Institutional trust. Professional depth.</em>
            </p>
          </div>
        </div>
      `,
    };

    const result = await sendEmailWithRetry(mailOptions);
    if (result.success) {
      logger.info({ email, messageId: result.messageId }, 'Welcome email sent successfully');
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ error, email }, 'Failed to send welcome email');
    return false;
  }
};

/**
 * Send meeting recording started notification email
 */
export const sendMeetingStartedEmail = async (
  email: string,
  userName: string,
  meetingTitle?: string
): Promise<boolean> => {
  try {
    const mailOptions = {
      from: resendClient && hasProductionResendSender ? resendFromEmail : gmailUser,
      to: email,
      subject: 'Meeting Recording Started - Memovoice',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">📱 Meeting Recording Started</h2>
          </div>
          <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="color: #333; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Your meeting is now being recorded and will be automatically transcribed.
            </p>
            ${meetingTitle ? `<p style="color: #333; font-size: 14px;"><strong>Meeting:</strong> ${meetingTitle}</p>` : ''}
            <p style="color: #666; font-size: 12px; line-height: 1.6;">
              Your audio is being securely stored and will be processed immediately after recording ends.
            </p>
          </div>
        </div>
      `,
    };

    const result = await sendEmailWithRetry(mailOptions);
    if (result.success) {
      logger.info({ email, messageId: result.messageId }, 'Meeting started email sent');
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ error, email }, 'Failed to send meeting started email');
    return false;
  }
};

/**
 * Send meeting processing complete notification email
 */
export const sendMeetingProcessedEmail = async (
  email: string,
  userName: string,
  meetingTitle: string,
  summary: string,
  highlights?: string[]
): Promise<boolean> => {
  try {
    const mailOptions = {
      from: resendClient && hasProductionResendSender ? resendFromEmail : gmailUser,
      to: email,
      subject: `Meeting Summary Ready - ${meetingTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">✅ Meeting Processing Complete</h2>
          </div>
          <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="color: #333; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Your meeting has been successfully transcribed and summarized.
            </p>
            <p style="color: #333; font-size: 14px;"><strong>Meeting:</strong> ${meetingTitle}</p>
            <div style="background: white; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #333; font-size: 13px; margin: 0;"><strong>Summary:</strong></p>
              <p style="color: #666; font-size: 13px; line-height: 1.6; margin: 10px 0 0 0;">
                ${summary.substring(0, 200)}${summary.length > 200 ? '...' : ''}
              </p>
            </div>
            ${highlights && highlights.length > 0 ? `
            <div style="background: #fffef6; border-left: 4px solid #ffb86b; padding: 12px; margin-bottom: 18px; border-radius: 4px;">
              <p style="color: #333; font-size: 13px; margin: 0;"><strong>Highlights:</strong></p>
              <ul style="color: #666; font-size: 13px; margin: 8px 0 0 16px;">
                ${highlights.slice(0,5).map(h => `<li>${h}</li>`).join('')}
              </ul>
            </div>` : ''}
            <p style="color: #666; font-size: 12px; line-height: 1.6;">
              Open the Memovoice app to view the full transcript and summary.
            </p>
          </div>
        </div>
      `,
    };

    const result = await sendEmailWithRetry(mailOptions);
    if (result.success) {
      logger.info({ email, messageId: result.messageId }, 'Meeting processed email sent');
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ error, email }, 'Failed to send meeting processed email');
    return false;
  }
};

/**
 * Send meeting processing failed notification email
 */
export const sendMeetingFailedEmail = async (
  email: string,
  userName: string,
  meetingTitle: string,
  errorMessage: string
): Promise<boolean> => {
  try {
    const mailOptions = {
      from: resendClient && hasProductionResendSender ? resendFromEmail : gmailUser,
      to: email,
      subject: `Meeting Processing Failed - ${meetingTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #d63031 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">⚠️ Meeting Processing Failed</h2>
          </div>
          <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="color: #333; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Unfortunately, your meeting processing encountered an error.
            </p>
            <p style="color: #333; font-size: 14px;"><strong>Meeting:</strong> ${meetingTitle}</p>
            <div style="background: #ffe5e5; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #d63031; font-size: 13px; margin: 0;"><strong>Error Details:</strong></p>
              <p style="color: #c92a2a; font-size: 12px; margin: 10px 0 0 0;">
                ${errorMessage}
              </p>
            </div>
            <p style="color: #666; font-size: 12px; line-height: 1.6;">
              Our support team has been notified and is investigating. Try re-uploading the meeting in the app, or contact support@memovoice.com if the issue persists.
            </p>
          </div>
        </div>
      `,
    };

    const result = await sendEmailWithRetry(mailOptions);
    if (result.success) {
      logger.info({ email, messageId: result.messageId }, 'Meeting failed email sent');
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ error, email }, 'Failed to send meeting failed email');
    return false;
  }
};

/**
 * Send subscription upgrade notification email
 */
export const sendSubscriptionUpgradeEmail = async (
  email: string,
  userName: string
): Promise<boolean> => {
  try {
    const mailOptions = {
      from: resendClient && hasProductionResendSender ? resendFromEmail : gmailUser,
      to: email,
      subject: 'Welcome to Memovoice Pro - Premium Features Unlocked',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ffd89b 0%, #19547b 100%); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">🎉 Welcome to Memovoice Pro</h2>
          </div>
          <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="color: #333; font-size: 16px;">Hello <strong>${userName}</strong>,</p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Thank you for upgrading to Memovoice Pro! You now have access to premium features.
            </p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;"><strong>Your Pro Benefits:</strong></p>
            <ul style="color: #666; font-size: 14px; line-height: 1.8;">
              <li>✓ Unlimited meeting recordings</li>
              <li>✓ Advanced AI summarization</li>
              <li>✓ Priority support</li>
              <li>✓ Custom meeting categories</li>
              <li>✓ Export capabilities</li>
            </ul>
            <p style="color: #666; font-size: 12px; line-height: 1.6;">
              Start using Pro features now in the Memovoice app!
            </p>
          </div>
        </div>
      `,
    };

    const result = await sendEmailWithRetry(mailOptions);
    if (result.success) {
      logger.info({ email, messageId: result.messageId }, 'Subscription upgrade email sent');
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ error, email }, 'Failed to send subscription upgrade email');
    return false;
  }
};

/**
 * Send a custom email (e.g. from the admin dashboard)
 */
export const sendCustomEmail = async (
  email: string,
  subject: string,
  html: string
): Promise<boolean> => {
  try {
    const mailOptions = {
      from: resendClient && hasProductionResendSender ? resendFromEmail : gmailUser,
      to: email,
      subject: subject,
      html: html,
    };

    const result = await sendEmailWithRetry(mailOptions);
    return result.success;
  } catch (error) {
    logger.error({ error, email }, 'Failed to send custom email');
    return false;
  }
};
