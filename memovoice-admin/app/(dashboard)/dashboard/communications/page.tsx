'use client';

import { useState } from 'react';

const TARGET_OPTIONS = [
  { value: 'all', label: 'All Users', icon: 'group', description: 'Send to all registered users' },
  { value: 'pro', label: 'Pro Users Only', icon: 'verified', description: 'Send to Pro subscribers only' },
  { value: 'free', label: 'Free Users Only', icon: 'person_outline', description: 'Send to free tier users only' },
  { value: 'single', label: 'Single User', icon: 'person', description: 'Send to a specific email address' },
];

const TEMPLATES = [
  { value: 'custom', label: 'Custom (Blank)' },
  { value: 'welcome', label: 'Welcome Email' },
  { value: 'pro_upgrade', label: 'Pro Upgrade' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'announcement', label: 'Announcement' },
];

const TEMPLATE_SUBJECTS: Record<string, string> = {
  welcome: 'Welcome to Memovoice 🎙️',
  pro_upgrade: 'Welcome to Memovoice Pro 🚀',
  payment_failed: 'Action Required - Payment Failed',
  announcement: 'Announcement from Memovoice',
  custom: '',
};

const TEMPLATE_BODIES: Record<string, string> = {
  welcome: `<p>Hi {name},</p><p>Welcome to Memovoice! We're thrilled to have you on board.</p><p>Memovoice uses cutting-edge AI to transcribe and summarize your meetings automatically — so you never miss an important detail.</p><p><strong>Getting started in 3 steps:</strong></p><ol><li>Open the Memovoice app</li><li>Start a new recording before your meeting</li><li>Receive your AI-powered summary within minutes</li></ol><p>Have questions? Reach us at hello@memovoice.app</p>`,
  pro_upgrade: `<p>Hi {name},</p><p>Congratulations! Your Memovoice Pro subscription is now active 🎉</p><p><strong>What's unlocked with Pro:</strong></p><ul><li>Unlimited meeting recordings</li><li>Advanced AI summaries & action items</li><li>Priority processing</li><li>Export to PDF & Notion</li></ul><p>If you have any questions, contact us at hello@memovoice.app</p>`,
  payment_failed: `<p>Hi {name},</p><p>We were unable to process your recent payment for Memovoice Pro.</p><p>To continue enjoying Pro features, please update your payment method.</p><p>If you believe this is an error, please contact us at hello@memovoice.app</p>`,
  custom: '',
  announcement: `<p>Hi {name},</p><p>We have an exciting announcement from the Memovoice team...</p>`,
};

interface EmailLog {
  id: string;
  type: string;
  recipients: string;
  subject: string;
  sentBy: string;
  date: string;
  status: 'sent' | 'failed';
}

const MOCK_LOGS: EmailLog[] = [
  { id: '1', type: 'Broadcast', recipients: 'All Users (12,482)', subject: 'New Feature: Action Items', sentBy: 'Admin', date: '2024-01-15 10:30', status: 'sent' },
  { id: '2', type: 'Single', recipients: 'sarah.m@agency.com', subject: 'Your account inquiry', sentBy: 'Admin', date: '2024-01-14 15:00', status: 'sent' },
  { id: '3', type: 'Broadcast', recipients: 'Pro Users (4,102)', subject: 'Pro Feature Update', sentBy: 'Admin', date: '2024-01-12 09:00', status: 'sent' },
  { id: '4', type: 'Single', recipients: 'd.chen@startup.io', subject: 'Welcome to Memovoice 🎙️', sentBy: 'System', date: '2024-01-11 08:00', status: 'sent' },
];

export default function CommunicationsPage() {
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  const [target, setTarget] = useState('all');
  const [singleEmail, setSingleEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [template, setTemplate] = useState('custom');
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleTemplateChange = (tmpl: string) => {
    setTemplate(tmpl);
    if (tmpl !== 'custom') {
      setSubject(TEMPLATE_SUBJECTS[tmpl] || '');
      setBody(TEMPLATE_BODIES[tmpl] || '');
    }
  };

  const getRecipientCount = () => {
    switch (target) {
      case 'all': return '12,482 users';
      case 'pro': return '4,102 Pro users';
      case 'free': return '8,380 Free users';
      case 'single': return singleEmail ? '1 user' : '—';
      default: return '—';
    }
  };

  const handleSend = async () => {
    setSending(true);
    setShowConfirm(false);
    try {
      const endpoint = target === 'single' ? '/api/email/send-single' : '/api/email/send-broadcast';
      const payload = target === 'single'
        ? { to: singleEmail, subject, html: body }
        : { target, subject, html: body, template };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('Email sent successfully!');
        setSubject('');
        setBody('');
        setSingleEmail('');
        setTemplate('custom');
      } else {
        throw new Error();
      }
    } catch {
      showToast('Failed to send email', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-[14px] font-medium text-white animate-slide-up ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex bg-surface-container-low rounded-xl p-1 w-fit gap-1">
        {[
          { key: 'compose', icon: 'edit', label: 'Compose & Send' },
          { key: 'history', icon: 'history', label: 'Email History' },
        ].map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'compose' | 'history')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
              activeTab === key
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'compose' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compose Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Target Selector */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 soft-shadow border border-white/80">
              <h3 className="text-[16px] font-semibold font-geist text-on-surface mb-4">Recipients</h3>
              <div className="grid grid-cols-2 gap-3">
                {TARGET_OPTIONS.map(({ value, label, icon, description }) => (
                  <button
                    key={value}
                    onClick={() => setTarget(value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      target === value
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant hover:border-primary/30 hover:bg-surface-container-low'
                    }`}
                  >
                    <div className={`flex items-center gap-2 mb-1 ${target === value ? 'text-primary' : 'text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
                      <span className="text-[13px] font-semibold">{label}</span>
                    </div>
                    <p className="text-[11px] text-outline">{description}</p>
                  </button>
                ))}
              </div>
              {target === 'single' && (
                <div className="mt-4">
                  <label className="text-[12px] font-medium text-on-surface-variant block mb-1.5">Recipient Email</label>
                  <input
                    value={singleEmail}
                    onChange={e => setSingleEmail(e.target.value)}
                    placeholder="user@example.com"
                    type="email"
                    className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-bright text-[14px] text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              )}
            </div>

            {/* Email Content */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 soft-shadow border border-white/80 space-y-4">
              <h3 className="text-[16px] font-semibold font-geist text-on-surface">Email Content</h3>

              {/* Template */}
              <div>
                <label className="text-[12px] font-medium text-on-surface-variant block mb-1.5">Template</label>
                <select
                  value={template}
                  onChange={e => handleTemplateChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-bright text-[14px] text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {TEMPLATES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="text-[12px] font-medium text-on-surface-variant block mb-1.5">Subject</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-bright text-[14px] text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-[12px] font-medium text-on-surface-variant block mb-1.5">Message Body (HTML)</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={12}
                  placeholder="Write your email content here (HTML supported)..."
                  className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-bright text-[13px] text-on-surface font-mono outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={!body}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface text-[14px] font-medium hover:bg-surface-container-low transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                  Preview
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={!subject || !body || (target === 'single' && !singleEmail) || sending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-[14px] font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>progress_activity</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Summary Panel */}
          <div className="space-y-4">
            <div className="bg-surface-container-lowest rounded-2xl p-6 soft-shadow border border-white/80">
              <h3 className="text-[16px] font-semibold font-geist text-on-surface mb-4">Send Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-[14px]">
                  <span className="text-outline">Recipients</span>
                  <span className="font-semibold text-on-surface">{getRecipientCount()}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-outline">Template</span>
                  <span className="font-semibold text-on-surface">{TEMPLATES.find(t => t.value === template)?.label}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-outline">Subject</span>
                  <span className="font-semibold text-on-surface truncate max-w-[150px]" title={subject}>{subject || '—'}</span>
                </div>
                <div className="h-px bg-outline-variant my-2" />
                <div className="flex justify-between text-[14px]">
                  <span className="text-outline">Rate limit</span>
                  <span className="font-semibold text-emerald-600">10/sec max</span>
                </div>
              </div>

              <div className="mt-5 p-3 bg-primary/5 rounded-xl border border-primary/20">
                <p className="text-[12px] text-primary font-medium">
                  📧 Broadcasts are rate-limited at 10 emails/second to comply with Gmail daily limits.
                </p>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 soft-shadow border border-white/80">
              <h3 className="text-[14px] font-semibold font-geist text-on-surface mb-3">Quick Templates</h3>
              <div className="space-y-2">
                {TEMPLATES.filter(t => t.value !== 'custom').map(t => (
                  <button
                    key={t.value}
                    onClick={() => handleTemplateChange(t.value)}
                    className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-all"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Email History Tab */
        <div className="bg-surface-container-lowest rounded-2xl soft-shadow border border-white/80 overflow-hidden">
          <div className="px-6 py-5 border-b border-outline-variant">
            <h3 className="text-[18px] font-semibold font-geist text-on-surface">Email History</h3>
            <p className="text-[12px] text-outline mt-0.5">All emails sent from the admin dashboard</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  {['Type', 'Recipients', 'Subject', 'Sent By', 'Date', 'Status'].map(h => (
                    <th key={h} className="px-6 py-3 text-[12px] font-bold text-outline uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {MOCK_LOGS.map(log => (
                  <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${log.type === 'Broadcast' ? 'bg-primary/10 text-primary' : 'bg-secondary-fixed text-secondary'}`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[14px] text-on-surface-variant">{log.recipients}</td>
                    <td className="px-6 py-4 text-[14px] text-on-surface font-medium">{log.subject}</td>
                    <td className="px-6 py-4 text-[14px] text-on-surface-variant">{log.sentBy}</td>
                    <td className="px-6 py-4 text-[13px] text-outline">{log.date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-error-container text-error'}`}>
                        {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl max-w-2xl w-full soft-shadow animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-outline-variant">
              <h3 className="text-[18px] font-semibold font-geist text-on-surface">Email Preview</h3>
              <button onClick={() => setShowPreview(false)} className="p-1 text-outline hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 space-y-1 text-[13px] text-outline">
                <div><strong className="text-on-surface">To:</strong> {getRecipientCount()}</div>
                <div><strong className="text-on-surface">Subject:</strong> {subject}</div>
              </div>
              <div
                className="bg-surface-container-low rounded-xl p-6 text-[14px] text-on-surface leading-relaxed"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full soft-shadow animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>send</span>
            </div>
            <h3 className="text-[18px] font-semibold font-geist text-on-surface mb-2">Confirm Send</h3>
            <p className="text-[14px] text-outline mb-1">
              You are about to send <strong className="text-on-surface">&ldquo;{subject}&rdquo;</strong> to{' '}
              <strong className="text-on-surface">{getRecipientCount()}</strong>.
            </p>
            <p className="text-[12px] text-outline mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-lg border border-outline-variant text-on-surface text-[14px] font-medium hover:bg-surface-container-low transition-all">Cancel</button>
              <button onClick={handleSend} className="flex-1 py-2.5 rounded-lg bg-primary text-on-primary text-[14px] font-semibold hover:brightness-110 transition-all">Send Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
