import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// Initialize nodemailer transporter with Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Use Gmail App Password, not your actual password
  },
});

// Verify connection at startup
transporter.verify((error, _success) => {
  if (error) {
    logger.error({ error }, 'Email service verification failed - notifications will not be sent');
  } else {
    logger.info('Email service verified and ready to send emails');
  }
});

/**
 * Send welcome/sign-up email
 */
export const sendWelcomeEmail = async (email: string, firstName: string): Promise<boolean> => {
  try {
    if (!process.env.GMAIL_USER) {
      logger.warn('Gmail not configured - skipping welcome email');
      return false;
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
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

    const info = await transporter.sendMail(mailOptions);
    logger.info({ email, messageId: info.messageId }, 'Welcome email sent successfully');
    return true;
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
    if (!process.env.GMAIL_USER) {
      logger.warn('Gmail not configured - skipping meeting started email');
      return false;
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
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

    const info = await transporter.sendMail(mailOptions);
    logger.info({ email, messageId: info.messageId }, 'Meeting started email sent');
    return true;
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
    if (!process.env.GMAIL_USER) {
      logger.warn('Gmail not configured - skipping meeting processed email');
      return false;
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
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

    const info = await transporter.sendMail(mailOptions);
    logger.info({ email, messageId: info.messageId }, 'Meeting processed email sent');
    return true;
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
    if (!process.env.GMAIL_USER) {
      logger.warn('Gmail not configured - skipping meeting failed email');
      return false;
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
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

    const info = await transporter.sendMail(mailOptions);
    logger.info({ email, messageId: info.messageId }, 'Meeting failed email sent');
    return true;
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
    if (!process.env.GMAIL_USER) {
      logger.warn('Gmail not configured - skipping subscription email');
      return false;
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
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

    const info = await transporter.sendMail(mailOptions);
    logger.info({ email, messageId: info.messageId }, 'Subscription upgrade email sent');
    return true;
  } catch (error) {
    logger.error({ error, email }, 'Failed to send subscription upgrade email');
    return false;
  }
};
