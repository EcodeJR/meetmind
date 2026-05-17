import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { sendEmail } from '@/lib/mailer';
import { getTemplate } from '@/lib/emailTemplates';

export async function POST(req: NextRequest) {
  try {
    requireAdminAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { to, subject, html, template, name } = await req.json();

    if (!to) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    let emailSubject = subject;
    let emailHtml = html;

    // If using a pre-built template
    if (template && template !== 'custom') {
      const tmpl = getTemplate(template, name || 'there');
      emailSubject = tmpl.subject || subject;
      emailHtml = tmpl.html || html;
    }

    if (!emailSubject || !emailHtml) {
      return NextResponse.json({ error: 'Subject and content are required' }, { status: 400 });
    }

    await sendEmail(to, emailSubject, emailHtml);
    return NextResponse.json({ success: true, message: `Email sent to ${to}` });
  } catch (error: any) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
  }
}
