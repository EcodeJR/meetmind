'use client';

import { useEffect, useState } from 'react';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

interface WaitlistEntry {
  _id: string;
  email: string;
  platform: string;
  createdAt: string;
}

interface PaginatedWaitlist {
  waitlist: WaitlistEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API || 'https://memovoice-backend.up.railway.app';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

export default function WaitlistPage() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Email modal state
  const [emailModal, setEmailModal] = useState<{ open: boolean; targetEmail: string | 'all' }>({ open: false, targetEmail: 'all' });
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingStatus, setSendingStatus] = useState<{ sending: boolean; current: number; total: number } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_API}/admin/waitlist?page=${page}&limit=50`, {
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setWaitlist(result.data.waitlist);
          setPagination(result.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch waitlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, [page]);

  const handleSendEmail = async () => {
    if (!emailSubject || !emailBody) return;

    let targets: string[] = [];
    if (emailModal.targetEmail === 'all') {
      // Fetch all to broadcast if there are multiple pages
      try {
        const res = await fetch(`${RAILWAY_API}/admin/waitlist?page=1&limit=500`, {
          headers: { 'x-admin-key': ADMIN_KEY },
        });
        if (res.ok) {
          const result = await res.json();
          targets = result.data.waitlist.map((e: WaitlistEntry) => e.email);
        }
      } catch (err) {
        showToast('Failed to retrieve target list.', 'error');
        return;
      }
    } else {
      targets = [emailModal.targetEmail];
    }

    if (targets.length === 0) {
      showToast('No emails found to send to.', 'error');
      return;
    }

    setSendingStatus({ sending: true, current: 0, total: targets.length });

    let successCount = 0;
    for (let i = 0; i < targets.length; i++) {
      const targetEmail = targets[i];
      try {
        const res = await fetch(`${RAILWAY_API}/admin/waitlist/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': ADMIN_KEY,
          },
          body: JSON.stringify({
            email: targetEmail,
            subject: emailSubject,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 26px;">Memovoice Updates</h1>
                </div>
                <div style="background: #fdfdfd; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px; line-height: 1.6;">
                  <p>Hello,</p>
                  <div style="margin: 30px 0; font-size: 16px;">
                    ${emailBody.replace(/\n/g, '<br />')}
                  </div>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
                  <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                    You are receiving this because you signed up for the Memovoice iOS Launch Waitlist.<br />
                    Memovoice Team © 2026
                  </p>
                </div>
              </div>
            `,
          }),
        });
        if (res.ok) {
          successCount++;
        }
      } catch (err) {
        console.error(`Failed to send waitlist email to ${targetEmail}:`, err);
      }
      setSendingStatus((prev) => prev ? { ...prev, current: i + 1 } : null);
    }

    showToast(`Successfully dispatched emails to ${successCount} of ${targets.length} waitlist entries!`);
    setEmailModal({ open: false, targetEmail: 'all' });
    setEmailSubject('');
    setEmailBody('');
    setSendingStatus(null);
  };

  const filteredWaitlist = waitlist.filter((entry) =>
    entry.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 bg-[#1e1f24] min-h-screen p-8 text-[#dfe0ff]">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-lg shadow-xl border backdrop-blur-md transition-all ${
          toast.type === 'error' ? 'bg-[#3b0f0f] border-[#ffb4ab] text-[#ffdad6]' : 'bg-[#153b15] border-[#a0f0a0] text-[#e0ffe0]'
        }`}>
          <span className="material-symbols-outlined">{toast.type === 'error' ? 'error' : 'check_circle'}</span>
          <span className="text-sm font-semibold">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">iOS Waitlist Subscribers</h1>
          <p className="text-sm text-[#757686] mt-1">Manage iOS users interested in Memovoice and broadcast updates</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setEmailModal({ open: true, targetEmail: 'all' })}
            className="bg-accent text-black px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-accent/90 transition-all uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-accent/20"
          >
            <span className="material-symbols-outlined text-sm">campaign</span>
            Broadcast to All
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#2f3038] p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
            <span className="material-symbols-outlined text-2xl">hourglass_top</span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{pagination.total}</div>
            <div className="text-xs text-[#757686] uppercase tracking-wider font-semibold">Total Waitlist Signups</div>
          </div>
        </div>

        <div className="bg-[#2f3038] p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 bg-[#78db86]/10 rounded-xl flex items-center justify-center text-[#78db86]">
            <span className="material-symbols-outlined text-2xl">phone_iphone</span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">iOS Target</div>
            <div className="text-xs text-[#757686] uppercase tracking-wider font-semibold">Primary Platform Profile</div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-[#2f3038] p-4 rounded-xl border border-white/5 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:max-w-sm">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#757686]">
            <span className="material-symbols-outlined text-sm">search</span>
          </span>
          <input
            type="text"
            placeholder="Search email address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-black/25 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-accent"
          />
        </div>
        <div className="text-xs text-[#757686]">
          Showing {filteredWaitlist.length} subscribers
        </div>
      </div>

      {/* Subscriber List Table */}
      {loading ? (
        <TableSkeleton rows={8} cols={4} />
      ) : filteredWaitlist.length === 0 ? (
        <div className="bg-[#2f3038] rounded-2xl border border-white/5 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-[#757686] mb-4">hourglass_disabled</span>
          <h3 className="text-lg font-bold text-white">No waitlist entries found</h3>
          <p className="text-sm text-[#757686] mt-1">Waitlist is currently empty or matches no search terms</p>
        </div>
      ) : (
        <div className="bg-[#2f3038] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[11px] font-bold text-[#757686] uppercase tracking-wider bg-[#ffffff03]">
                  <th className="py-4 px-6">Email Address</th>
                  <th className="py-4 px-6 text-center">Target Platform</th>
                  <th className="py-4 px-6">Joined At</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredWaitlist.map((entry) => (
                  <tr key={entry._id} className="hover:bg-[#ffffff02] transition-colors group">
                    <td className="py-4 px-6 font-semibold text-white text-sm">
                      {entry.email}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-2.5 py-1 rounded bg-[#ffffff05] border border-white/10 text-[10px] font-bold uppercase tracking-wider text-accent">
                        {entry.platform}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-[#757686]">
                      {new Date(entry.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setEmailModal({ open: true, targetEmail: entry.email })}
                        className="px-3 py-1.5 rounded-lg bg-[#ffffff05] border border-white/10 hover:border-white/20 text-xs text-white flex items-center gap-1.5 transition-all inline-flex"
                      >
                        <span className="material-symbols-outlined text-sm">mail</span>
                        Email
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t border-white/5 bg-[#ffffff01]">
              <span className="text-xs text-[#757686]">
                Page {pagination.page} of {pagination.pages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-[#ffffff05] border border-white/5 disabled:opacity-30 text-xs text-white transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page === pagination.pages}
                  className="px-3 py-1.5 rounded-lg bg-[#ffffff05] border border-white/5 disabled:opacity-30 text-xs text-white transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Broadcast / Direct Email Modal */}
      {emailModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#2f3038] border border-white/10 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#ffffff02] border-b border-white/5 flex justify-between items-center">
              <h2 className="font-extrabold text-white text-lg">
                {emailModal.targetEmail === 'all' ? 'Broadcast iOS Waitlist' : 'Direct Waitlist Email'}
              </h2>
              <button
                onClick={() => setEmailModal({ open: false, targetEmail: 'all' })}
                className="text-[#757686] hover:text-white transition-colors"
                disabled={sendingStatus?.sending}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-black/25 p-4 rounded-xl border border-white/5 text-xs text-[#757686]">
                <strong>Recipient:</strong>{' '}
                {emailModal.targetEmail === 'all' ? (
                  <span className="text-accent font-bold">ALL iOS waitlist subscribers ({pagination.total})</span>
                ) : (
                  <span>{emailModal.targetEmail}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#757686] uppercase tracking-wider mb-2">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Memovoice iOS Release Beta Testing Invitation"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  disabled={sendingStatus?.sending}
                  className="w-full bg-black/25 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#757686] uppercase tracking-wider mb-2">Message Body</label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Enter newsletter text or beta update details..."
                  disabled={sendingStatus?.sending}
                  className="w-full bg-black/25 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                />
              </div>

              {/* Progress Monitor */}
              {sendingStatus?.sending && (
                <div className="bg-[#1a1b20] p-4 rounded-xl border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs text-white">
                    <span>Sending Broadcast Emails...</span>
                    <span>{sendingStatus.current} / {sendingStatus.total}</span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-accent h-full transition-all duration-300"
                      style={{ width: `${(sendingStatus.current / sendingStatus.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-[#ffffff02] border-t border-white/5 flex justify-end gap-3">
              <button
                onClick={() => setEmailModal({ open: false, targetEmail: 'all' })}
                disabled={sendingStatus?.sending}
                className="px-4 py-2 text-xs font-bold text-[#757686] hover:text-white transition-colors uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingStatus?.sending || !emailSubject || !emailBody}
                className="bg-accent text-black px-6 py-2 rounded-xl text-xs font-bold hover:bg-accent/90 transition-all uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
              >
                {sendingStatus?.sending ? (
                  <>Processing...</>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">campaign</span>
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
