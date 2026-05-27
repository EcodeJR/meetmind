import axios from 'axios';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { Resend } from 'resend';
import { logger } from '../utils/logger';
import { buildEmailTemplate } from './emailTemplate';

// Initialize nodemailer transporter with Gmail - try port 587 (TLS) if 465 (SSL) fails
let transporter: nodemailer.Transporter | null = null;
let fallbackTransporter: nodemailer.Transporter | null = null;
let resendClient: Resend | null = null;

const gmailUser = process.env.GMAIL_USER?.trim();
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
const resendApiKey = process.env.RESEND_API_KEY?.trim();
const resendFromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'Memovoice <onboarding@resend.dev>';
const hasProductionResendSender = resendFromEmail.includes('@') && !resendFromEmail.includes('onboarding@resend.dev');
const emailGatewayUrl = process.env.EMAIL_GATEWAY_URL?.trim();
const emailGatewaySecret = process.env.EMAIL_GATEWAY_SECRET?.trim();

// Log what we're reading at startup for debugging
logger.info({
  gmailUserSet: !!gmailUser,
  gmailUserValue: gmailUser ? `${gmailUser.substring(0, 3)}...` : 'NOT SET',
  gmailAppPasswordSet: !!gmailAppPassword,
  resendApiKeySet: !!resendApiKey,
  resendFromEmail,
  hasProductionResendSender,
  emailGatewayUrlSet: !!emailGatewayUrl,
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
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  } as SMTPTransport.Options);
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
          'TROUBLESHOOTING: Verify GMAIL_USER and GMAIL_APP_PASSWORD are set correctly. Gmail requires App Password (not account password) if 2FA is enabled. This service now forces IPv4 to avoid Render ENETUNREACH on IPv6 SMTP resolution.'
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

const sendEmailWithGateway = async (
  mailOptions: nodemailer.SendMailOptions
): Promise<{ success: boolean; messageId?: string; error?: any }> => {
  if (!emailGatewayUrl || !emailGatewaySecret) {
    return { success: false };
  }

  try {
    const response = await axios.post(
      emailGatewayUrl,
      {
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-email-gateway-secret': emailGatewaySecret,
        },
        timeout: 15000,
      }
    );

    if (response.data?.success) {
      logger.info({ to: mailOptions.to, messageId: response.data?.messageId }, 'Email sent via Vercel gateway');
      return { success: true, messageId: response.data?.messageId };
    }

    logger.warn({ response: response.data }, 'Vercel email gateway returned a non-success response');
    return { success: false, error: response.data };
  } catch (error: any) {
    logger.warn(
      { error: error?.message ?? error, status: error?.response?.status },
      'Vercel email gateway request failed'
    );
    return { success: false, error };
  }
};

/**
 * Send email with automatic fallback retry (Gmail SMTP → Resend API)
 */
const sendEmailWithRetry = async (
  mailOptions: nodemailer.SendMailOptions
): Promise<{ success: boolean; messageId?: string }> => {
  if (!transporter && !fallbackTransporter && !resendClient && !emailGatewayUrl) {
    logger.warn('No email transporters available (Gmail SMTP, Resend API, and Vercel gateway not configured)');
    return { success: false };
  }

  if (emailGatewayUrl && emailGatewaySecret) {
    const gatewayResult = await sendEmailWithGateway(mailOptions);
    if (gatewayResult.success) {
      return gatewayResult;
    }

    logger.warn('Primary Vercel email gateway failed; falling back to local transports');
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

const sendTemplatedEmail = async (
  email: string,
  subject: string,
  options: Parameters<typeof buildEmailTemplate>[0]
): Promise<boolean> => {
  const mailOptions = {
    from: resendClient && hasProductionResendSender ? resendFromEmail : gmailUser,
    to: email,
    subject,
    html: buildEmailTemplate(options),
  };

  const result = await sendEmailWithRetry(mailOptions);
  return result.success;
};

/**
 * Send welcome/sign-up email
 */
export const sendWelcomeEmail = async (email: string, firstName: string): Promise<boolean> => {
  try {
    const success = await sendTemplatedEmail(email, 'Welcome to Memovoice - Professional Intelligence Platform', {
      preheader: 'Your Memovoice account is ready',
      title: 'Welcome to Memovoice',
      greetingName: firstName,
      intro: 'Thank you for joining Memovoice. Your account has been successfully created and is ready to use.',
      sections: [
        {
          title: 'Getting Started',
          bullets: [
            'Open the Memovoice app to begin recording meetings',
            'Your meetings will be automatically transcribed',
            'Get AI-powered summaries and insights',
            'Upgrade to Pro for advanced features',
          ],
        },
        {
          title: 'Need help?',
          body: 'If you have any questions, contact our support team at support@memovoice.com.',
        },
      ],
      footer: 'Memovoice Team · Institutional trust. Professional depth.',
    });
    if (success) {
      logger.info({ email }, 'Welcome email sent successfully');
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
    const success = await sendTemplatedEmail(email, 'Meeting Recording Started - Memovoice', {
      preheader: 'We are recording your meeting now',
      title: 'Meeting Recording Started',
      greetingName: userName,
      intro: 'Your meeting is now being recorded and will be automatically transcribed.',
      sections: [
        ...(meetingTitle ? [{ title: 'Meeting', body: meetingTitle }] : []),
        {
          title: 'What happens next',
          bullets: [
            'Your audio is securely stored',
            'Processing starts automatically after recording ends',
          ],
        },
      ],
    });
    if (success) {
      logger.info({ email }, 'Meeting started email sent');
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
    const success = await sendTemplatedEmail(email, `Meeting Summary Ready - ${meetingTitle}`, {
      preheader: 'Your meeting summary is ready',
      title: 'Meeting Processing Complete',
      greetingName: userName,
      intro: 'Your meeting has been successfully transcribed and summarized.',
      sections: [
        { title: 'Meeting', body: meetingTitle },
        {
          title: 'Summary',
          body: summary.substring(0, 200) + (summary.length > 200 ? '...' : ''),
        },
        ...(highlights && highlights.length > 0 ? [{ title: 'Highlights', bullets: highlights.slice(0, 5) }] : []),
        {
          title: 'Next steps',
          bullets: ['Open the Memovoice app to view the full transcript and summary', 'Share or export the meeting from the app when needed'],
        },
      ],
    });
    if (success) {
      logger.info({ email }, 'Meeting processed email sent');
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
    const success = await sendTemplatedEmail(email, `Meeting Processing Failed - ${meetingTitle}`, {
      preheader: 'We could not finish processing your meeting',
      title: 'Meeting Processing Failed',
      greetingName: userName,
      intro: 'Unfortunately, your meeting processing encountered an error.',
      sections: [
        { title: 'Meeting', body: meetingTitle },
        { title: 'Error details', body: errorMessage },
        {
          title: 'Recommended next step',
          bullets: ['Try re-uploading the meeting in the app', 'Contact memovoiceio@gmail.com if the issue persists'],
        },
      ],
      footer: 'Our support team has been notified and is investigating.',
    });
    if (success) {
      logger.info({ email }, 'Meeting failed email sent');
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
    const success = await sendTemplatedEmail(email, 'Welcome to Memovoice Pro - Premium Features Unlocked', {
      preheader: 'Your Pro benefits are now active',
      title: 'Welcome to Memovoice Pro',
      greetingName: userName,
      intro: 'Thank you for upgrading to Memovoice Pro. You now have access to premium features.',
      sections: [
        {
          title: 'Your Pro Benefits',
          bullets: [
            'Unlimited meeting recordings',
            'Advanced AI summarization',
            'Priority support',
            'Custom meeting categories',
            'Export capabilities',
          ],
        },
        {
          title: 'Next step',
          body: 'Start using Pro features now in the Memovoice app.',
        },
      ],
    });
    if (success) {
      logger.info({ email }, 'Subscription upgrade email sent');
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
    return await sendTemplatedEmail(email, subject, {
      preheader: subject,
      title: subject,
      intro: 'You have a new message from Memovoice.',
      sections: [{ rawHtml: html }],
    });
  } catch (error) {
    logger.error({ error, email }, 'Failed to send custom email');
    return false;
  }
};

export const sendSettingsUpdatedEmail = async (
  email: string,
  userName: string,
  changes: Array<{ label: string; before: string; after: string }>
): Promise<boolean> => {
  if (!changes.length) return true;

  return sendTemplatedEmail(email, 'Your Memovoice Settings Were Updated', {
    preheader: 'Important account settings were changed',
    title: 'Settings Updated',
    greetingName: userName,
    intro: 'We noticed an important change to your account settings and wanted to confirm it.',
    sections: [
      {
        title: 'What changed',
        bullets: changes.map(change => `${change.label}: ${change.before} → ${change.after}`),
      },
      {
        title: 'Why this matters',
        body: 'These settings affect how Memovoice records, processes, and notifies you about meetings.',
      },
    ],
  });
};

export const sendMeetingDeletedEmail = async (
  email: string,
  userName: string,
  meetingTitle: string
): Promise<boolean> => {
  return sendTemplatedEmail(email, `Meeting Deleted - ${meetingTitle}`, {
    preheader: 'A meeting was removed from your account',
    title: 'Meeting Deleted',
    greetingName: userName,
    intro: 'A meeting was deleted from your Memovoice account.',
    sections: [
      { title: 'Meeting', body: meetingTitle },
      {
        title: 'What to know',
        bullets: [
          'The meeting has been removed from your account',
          'Associated storage has been reclaimed',
          'If you removed this by mistake, contact support as soon as possible',
        ],
      },
    ],
  });
};

export const sendAccountDeletedEmail = async (
  email: string,
  userName: string
): Promise<boolean> => {
  return sendTemplatedEmail(email, 'Your Memovoice Account Was Deleted', {
    preheader: 'Confirmation of account deletion',
    title: 'Account Deleted',
    greetingName: userName,
    intro: 'Your Memovoice account and associated data have been deleted.',
    sections: [
      {
        title: 'What was removed',
        bullets: [
          'Your account profile',
          'Meeting history and transcripts',
          'Associated audio files and storage',
        ],
      },
      {
        title: 'Important',
        body: 'This action is irreversible. If you did not request this deletion, contact support immediately.',
      },
    ],
  });
};

export const sendAccountStatusEmail = async (
  email: string,
  userName: string,
  title: string,
  intro: string,
  bullets: string[]
): Promise<boolean> => {
  return sendTemplatedEmail(email, title, {
    preheader: intro,
    title,
    greetingName: userName,
    intro,
    sections: [{ title: 'Details', bullets }],
  });
};
