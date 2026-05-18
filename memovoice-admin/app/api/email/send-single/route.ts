import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { sendEmail } from '@/lib/mailer';
import { getTemplate } from '@/lib/emailTemplates';
import { connectDB } from '@/lib/mongodb';

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

    // Log the email into MongoDB for the Email History page
    try {
      const db = await connectDB();
      const EmailLog = db.models.EmailLog || (await import('mongoose')).model(
        'EmailLog',
        new (await import('mongoose')).Schema({
          type: String,
          recipients: String,
          subject: String,
          sentBy: String,
          status: String
        }, { timestamps: true })
      );

      await EmailLog.create({
        type: 'Single',
        recipients: to,
        subject: emailSubject,
        sentBy: 'Admin',
        status: 'sent'
      });
    } catch (dbErr) {
      console.error('Failed to log single email to DB:', dbErr);
    }

    return NextResponse.json({ success: true, message: `Email sent to ${to}` });
  } catch (error: any) {
    console.error('Email send error:', error);

    try {
      const { to, subject } = await req.json();
      const db = await connectDB();
      const EmailLog = db.models.EmailLog;
      if (EmailLog) {
        await EmailLog.create({
          type: 'Single',
          recipients: to || 'Unknown',
          subject: subject || 'Unknown',
          sentBy: 'Admin',
          status: 'failed'
        });
      }
    } catch (e) { }

    return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
  }
}
