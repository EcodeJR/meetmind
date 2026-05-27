import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';

const EMAIL_GATEWAY_SECRET = process.env.EMAIL_GATEWAY_SECRET || '';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-email-gateway-secret');
    if (!EMAIL_GATEWAY_SECRET || secret !== EMAIL_GATEWAY_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'to, subject, and html are required' }, { status: 400 });
    }

    await sendEmail(to, subject, html);

    return NextResponse.json({ success: true, message: `Email sent to ${to}` });
  } catch (error: any) {
    console.error('Email gateway send error:', error);
    return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
  }
}