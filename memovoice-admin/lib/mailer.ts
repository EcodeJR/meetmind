import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  family: 4,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
} as SMTPTransport.Options);

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
