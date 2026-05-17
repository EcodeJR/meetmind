import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';
import { welcomeEmailTemplate } from '@/lib/emailTemplates';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret from Railway
    const webhookSecret = req.headers.get('x-webhook-secret');
    if (!WEBHOOK_SECRET || webhookSecret !== WEBHOOK_SECRET) {
      console.warn('Webhook received with invalid secret');
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const { email, name, clerkId } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'email and name are required' }, { status: 400 });
    }

    const welcomeHtml = welcomeEmailTemplate(name);
    await sendEmail(email, 'Welcome to Memovoice 🎙️', welcomeHtml);

    console.log(`Welcome email sent to new user: ${email} (${clerkId})`);
    return NextResponse.json({ success: true, message: `Welcome email sent to ${email}` });
  } catch (error: any) {
    console.error('Failed to send welcome email:', error);
    return NextResponse.json({ error: 'Failed to send welcome email', details: error.message }, { status: 500 });
  }
}
