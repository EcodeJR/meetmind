"use strict";exports.id=304,exports.ids=[304],exports.modules={9230:(e,o,t)=>{t.d(o,{_r:()=>welcomeEmailTemplate,t4:()=>getTemplate});let i="https://memovoice.vercel.app",a="#384cd3",baseLayout=e=>`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F0F4F8; }
    .wrapper { max-width: 600px; margin: 40px auto; }
    .header { background: #0F1C3F; padding: 32px 40px; border-radius: 16px 16px 0 0; text-align: center; }
    .header .logo { display: inline-flex; align-items: center; gap: 10px; }
    .header .logo-icon { width: 40px; height: 40px; background: ${a}; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .header h1 { color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .content { background: #ffffff; padding: 40px; }
    .content h2 { font-size: 24px; font-weight: 700; color: #1a1b23; margin-bottom: 16px; }
    .content p { font-size: 15px; line-height: 1.7; color: #454654; margin-bottom: 16px; }
    .content ul, .content ol { padding-left: 20px; margin-bottom: 16px; }
    .content li { font-size: 15px; line-height: 1.7; color: #454654; margin-bottom: 6px; }
    .button { display: inline-block; background: ${a}; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; margin: 8px 4px; }
    .button-outline { display: inline-block; border: 2px solid ${a}; color: ${a} !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; margin: 8px 4px; }
    .feature-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .feature-icon { width: 36px; height: 36px; background: #EEF2FF; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 18px; }
    .step { display: flex; align-items: center; gap: 16px; padding: 16px; background: #F4F2FE; border-radius: 12px; margin-bottom: 12px; }
    .step-num { width: 32px; height: 32px; background: ${a}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
    .alert-box { background: #FFF3CD; border: 1px solid #FBBF24; border-radius: 12px; padding: 16px 20px; margin: 20px 0; }
    .footer { background: #F4F2FE; padding: 24px 40px; border-radius: 0 0 16px 16px; text-align: center; }
    .footer p { font-size: 13px; color: #757686; margin-bottom: 4px; }
    .footer a { color: ${a}; text-decoration: none; }
    .divider { height: 1px; background: #EEECF8; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm6 10a6 6 0 0 1-12 0H4a8 8 0 0 0 16 0h-2zm-6 10a1 1 0 0 1 0-2 1 1 0 0 1 0 2z"/></svg>
        </div>
        <h1>Memovoice</h1>
      </div>
    </div>
    <div class="content">
      ${e}
    </div>
    <div class="footer">
      <p>&copy; 2026 Memovoice &nbsp;|&nbsp; <a href="mailto:hello@memovoice.app">hello@memovoice.app</a></p>
      <p style="margin-top: 4px; font-size: 11px; color: #c5c5d7;">You're receiving this email because you have a Memovoice account.</p>
    </div>
  </div>
</body>
</html>`,welcomeEmailTemplate=e=>baseLayout(`
  <h2>Welcome to Memovoice, ${e}! 🎙️</h2>
  <p>We're so excited to have you on board. Memovoice uses cutting-edge AI to automatically transcribe and summarize your meetings — so you can focus on what matters instead of taking notes.</p>
  <div class="divider"></div>
  <p><strong>Get started in 3 simple steps:</strong></p>
  <div class="step">
    <div class="step-num">1</div>
    <div><strong>Open the app</strong> and sign in to your account</div>
  </div>
  <div class="step">
    <div class="step-num">2</div>
    <div><strong>Start a recording</strong> before your next meeting begins</div>
  </div>
  <div class="step">
    <div class="step-num">3</div>
    <div><strong>Get your summary</strong> — transcript, key points & action items delivered automatically</div>
  </div>
  <div class="divider"></div>
  <p style="text-align: center;">
    <a class="button" href="${i}">Open Memovoice</a>
    <a class="button-outline" href="${i}/settings/upgrade">Upgrade to Pro</a>
  </p>
  <div class="divider"></div>
  <p style="font-size: 13px; color: #757686;">Need help? Reach us anytime at <a href="mailto:hello@memovoice.app" style="color: ${a};">hello@memovoice.app</a></p>
`),proUpgradeEmailTemplate=e=>baseLayout(`
  <h2>You're now on Memovoice Pro 🚀</h2>
  <p>Hi ${e}, your Pro upgrade is confirmed. Here's everything that's now unlocked for you:</p>
  <div class="divider"></div>
  <div class="feature-row"><div class="feature-icon">♾️</div><div><strong>Unlimited recordings</strong><br/><span style="color:#757686; font-size:13px">No more recording caps — record as many meetings as you need</span></div></div>
  <div class="feature-row"><div class="feature-icon">🧠</div><div><strong>Advanced AI summaries</strong><br/><span style="color:#757686; font-size:13px">Rich summaries with action items, decisions & key points</span></div></div>
  <div class="feature-row"><div class="feature-icon">⚡</div><div><strong>Priority processing</strong><br/><span style="color:#757686; font-size:13px">Your meetings are processed first — results in under 2 minutes</span></div></div>
  <div class="feature-row"><div class="feature-icon">📄</div><div><strong>Export to PDF & Notion</strong><br/><span style="color:#757686; font-size:13px">Share your meeting notes anywhere, in any format</span></div></div>
  <div class="divider"></div>
  <p style="text-align: center;"><a class="button" href="${i}">Start Recording →</a></p>
  <p style="font-size: 13px; color: #757686; margin-top: 16px;">Questions? We're at <a href="mailto:hello@memovoice.app" style="color: ${a};">hello@memovoice.app</a></p>
`),paymentFailedEmailTemplate=e=>baseLayout(`
  <h2>Action Required: Payment Failed</h2>
  <p>Hi ${e}, we were unable to process your recent payment for Memovoice Pro.</p>
  <div class="alert-box">
    <strong>⚠️ Your Pro access will be paused</strong> unless we can collect payment successfully. Please update your payment method to continue enjoying all Pro features.
  </div>
  <p style="text-align: center;"><a class="button" href="${i}/settings/upgrade">Update Payment Method</a></p>
  <div class="divider"></div>
  <p style="font-size: 13px; color: #757686;">If you believe this is an error, or if you'd like to cancel your subscription, please contact us at <a href="mailto:hello@memovoice.app" style="color: ${a};">hello@memovoice.app</a></p>
`),getTemplate=(e,o="there")=>{switch(e){case"welcome":return{subject:"Welcome to Memovoice \uD83C\uDF99️",html:welcomeEmailTemplate(o)};case"pro_upgrade":return{subject:"Welcome to Memovoice Pro \uD83D\uDE80",html:proUpgradeEmailTemplate(o)};case"payment_failed":return{subject:"Action Required - Payment Failed",html:paymentFailedEmailTemplate(o)};default:return{subject:"",html:""}}}},7869:(e,o,t)=>{t.d(o,{C:()=>sendEmail});var i=t(6709);let a=i.createTransport({service:"gmail",auth:{user:process.env.GMAIL_USER,pass:process.env.GMAIL_APP_PASSWORD}}),sendEmail=async(e,o,t)=>{await a.sendMail({from:`"Memovoice" <${process.env.GMAIL_USER}>`,to:e,subject:o,html:t,text:t.replace(/<[^>]*>/g,"")})}}};