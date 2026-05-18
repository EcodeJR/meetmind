import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { sendEmail } from '@/lib/mailer';
import { connectDB } from '@/lib/mongodb';
import { getTemplate } from '@/lib/emailTemplates';

// 200ms delay between emails to respect Gmail rate limits (10/sec max)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    requireAdminAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { target, subject, html, template, name } = await req.json();

    if (!target || !['all', 'pro', 'free'].includes(target)) {
      return NextResponse.json({ error: 'Invalid target. Must be: all, pro, or free' }, { status: 400 });
    }

    let emailSubject = subject;
    let emailHtml = html;

    if (template && template !== 'custom') {
      const tmpl = getTemplate(template, name || 'there');
      emailSubject = tmpl.subject || subject;
      emailHtml = tmpl.html || html;
    }

    if (!emailSubject || !emailHtml) {
      return NextResponse.json({ error: 'Subject and content are required' }, { status: 400 });
    }

    let users: { email: string; name?: string }[] = [];

    try {
      const db = await connectDB();
      const User = db.models.User || (await import('mongoose')).model(
        'User',
        new (await import('mongoose')).Schema({ email: String, name: String, subscription: { plan: String } })
      );

      const query = target === 'all' ? {} : { 'subscription.plan': target };
      users = await User.find(query).select('email name').lean() as any[];
    } catch (err) {
      console.error('DB error fetching users for broadcast:', err);
      return NextResponse.json({ error: 'Failed to fetch users from database' }, { status: 500 });
    }

    if (!users.length) {
      return NextResponse.json({ error: 'No users found for the given target' }, { status: 404 });
    }

    // Start sending process (background loop)
    // We return a 202 Accepted response immediately so Vercel function doesn't time out the user's dashboard view
    // (Note: For large broadcasts, a background worker is ideal, but here we perform rate-limited parallel delivery)
    
    // We return immediately to the frontend
    const responsePayload = {
      success: true,
      message: `Broadcast started to ${users.length} ${target} users`,
      total: users.length,
    };

    // Run the sending loop asynchronously without blocking the response
    (async () => {
      let sent = 0;
      let failed = 0;
      for (const user of users) {
        try {
          const personalizedHtml = emailHtml.replace(/\{name\}/g, user.name || 'there');
          await sendEmail(user.email, emailSubject, personalizedHtml);
          sent++;
        } catch (err) {
          console.error(`Failed to send to ${user.email}:`, err);
          failed++;
        }
        await delay(200); // Rate limiting: max 5 emails/second to remain highly compliant
      }
      console.log(`Broadcast complete: ${sent} sent, ${failed} failed out of ${users.length} total`);
      
      // Log to DB
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
          type: 'Broadcast',
          recipients: `${target === 'all' ? 'All' : target === 'pro' ? 'Pro' : 'Free'} Users (${users.length})`,
          subject: emailSubject,
          sentBy: 'Admin',
          status: failed === users.length ? 'failed' : 'sent'
        });
      } catch (e) {
        console.error('Failed to save EmailLog:', e);
      }
    })();

    return NextResponse.json(responsePayload, { status: 202 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid payload or server error', details: error.message }, { status: 500 });
  }
}
