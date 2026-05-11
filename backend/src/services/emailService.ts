import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// Initialize nodemailer transporter with Gmail - try port 587 (TLS) if 465 (SSL) fails
let transporter: nodemailer.Transporter | null = null;
let fallbackTransporter: nodemailer.Transporter | null = null;

const gmailUser = process.env.GMAIL_USER?.trim();
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');

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
 * Send email with automatic fallback retry
 */
const sendEmailWithRetry = async (
  mailOptions: nodemailer.SendMailOptions
): Promise<{ success: boolean; messageId?: string }> => {
  if (!transporter && !fallbackTransporter) {
    logger.warn('No email transporters available');
    return { success: false };
  }

  // Try primary transporter
  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (primaryError: any) {
      logger.warn(
        { error: primaryError.message, code: primaryError.code },
        'Primary Gmail transporter failed; attempting fallback on port 465'
      );

      // Try fallback transporter if primary failed
      if (fallbackTransporter && fallbackTransporter !== transporter) {
        try {
          const info = await fallbackTransporter.sendMail(mailOptions);
          logger.info('Email sent via fallback transporter (port 465)');
          return { success: true, messageId: info.messageId };
        } catch (fallbackError: any) {
          logger.error(
            { primaryError: primaryError.message, fallbackError: fallbackError.message },
            'Both Gmail transporters failed'
          );
          return { success: false };
        }
      }
      return { success: false };
    }
  }

  // If primary is null, try fallback directly
  if (fallbackTransporter) {
    try {
      const info = await fallbackTransporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Fallback Gmail transporter failed');
      return { success: false };
    }
  }

  return { success: false };
};

/**
 * Send welcome/sign-up email
 */
export const sendWelcomeEmail = async (email: string, firstName: string): Promise<boolean> => {
  try {
    const mailOptions = {
      from: gmailUser,
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
      from: gmailUser,
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
  summary: string
): Promise<boolean> => {
  try {
    const mailOptions = {
      from: gmailUser,
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
      from: gmailUser,
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
      from: gmailUser,
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
