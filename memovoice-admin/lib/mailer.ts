import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  await transporter.sendMail({
    from: `"Memovoice" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text: html.replace(/<[^>]*>/g, ''), // Plain text fallback
  });
};

export const verifyMailer = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
};
