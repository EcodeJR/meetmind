'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

interface Contact {
  _id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: 'pending' | 'resolved';
  createdAt: string;
}

interface PaginatedContacts {
  contacts: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API || 'https://memovoice-backend.up.railway.app';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'resolved'>('all');
  const [replyModal, setReplyModal] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_API}/admin/contacts?page=${page}&limit=20`, {
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setContacts(result.data.contacts);
          setPagination(result.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to fetch contact submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [page]);

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch(`${RAILWAY_API}/admin/contacts/${id}/resolve`, {
        method: 'POST',
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) {
        showToast('Message marked as resolved!');
        fetchContacts();
      } else {
        showToast('Failed to resolve message.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server.', 'error');
    }
  };

  const handleSendReply = async () => {
    if (!replyModal.contact || !emailSubject || !emailBody) return;
    setSendingEmail(true);

    try {
      // Send custom email using our Vercel email API
      const res = await fetch('/api/email/send-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          to: replyModal.contact.email,
          name: replyModal.contact.name,
          subject: emailSubject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <div style="background: linear-gradient(135deg, #2f3038 0%, #1e1f24 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Memovoice Support</h1>
              </div>
              <div style="background: #fdfdfd; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px; line-height: 1.6;">
                <p>Hello <strong>${replyModal.contact.name}</strong>,</p>
                <p>Thank you for reaching out to us regarding: <em>"${replyModal.contact.subject || 'Inquiry'}"</em>.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <div style="background: #f7f7f7; padding: 20px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #666;"><strong>Your Inquiry:</strong></p>
                  <p style="margin: 8px 0 0 0; font-style: italic; font-size: 14px;">"${replyModal.contact.message}"</p>
                </div>
                <div style="margin: 30px 0; font-size: 16px;">
                  ${emailBody.replace(/\n/g, '<br />')}
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                  Best regards,<br>
                  Memovoice Support Team
                </p>
              </div>
            </div>
          `,
        }),
      });

      if (res.ok) {
        showToast(`Reply sent successfully to ${replyModal.contact.email}!`);
        setReplyModal({ open: false, contact: null });
        setEmailSubject('');
        setEmailBody('');
        // Automatically resolve the contact after reply
        await handleResolve(replyModal.contact._id);
      } else {
        showToast('Failed to dispatch email reply.', 'error');
      }
    } catch (err) {
      showToast('Error connecting to email service.', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (activeTab === 'pending') return c.status === 'pending';
    if (activeTab === 'resolved') return c.status === 'resolved';
    return true;
  });

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
          <h1 className="text-3xl font-extrabold tracking-tight">Support Contacts</h1>
          <p className="text-sm text-[#757686] mt-1">Manage user contact requests and support messages</p>
        </div>
        <div className="bg-[#2f3038] px-4 py-2 rounded-xl border border-white/5 text-xs text-[#757686] flex items-center gap-2">
          <span className="material-symbols-outlined font-light text-sm">support_agent</span>
          <span>{pagination.total} Total Messages</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex border-b border-white/5 mb-8">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'all' ? 'border-[#dfe0ff] text-white' : 'border-transparent text-[#757686] hover:text-[#dfe0ff]'
          }`}
        >
          All Messages
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'pending' ? 'border-[#ba1a1a] text-[#ffdad6]' : 'border-transparent text-[#757686] hover:text-[#dfe0ff]'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setActiveTab('resolved')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'resolved' ? 'border-[#78db86] text-[#e0ffe0]' : 'border-transparent text-[#757686] hover:text-[#dfe0ff]'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Content Table */}
      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : filteredContacts.length === 0 ? (
        <div className="bg-[#2f3038] rounded-2xl border border-white/5 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-[#757686] mb-4">mail_lock</span>
          <h3 className="text-lg font-bold text-white">No inquiries found</h3>
          <p className="text-sm text-[#757686] mt-1">All messages are clear or match no filters</p>
        </div>
      ) : (
        <div className="bg-[#2f3038] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[11px] font-bold text-[#757686] uppercase tracking-wider bg-[#ffffff03]">
                  <th className="py-4 px-6">Sender</th>
                  <th className="py-4 px-6">Subject / Message</th>
                  <th className="py-4 px-6">Submitted At</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredContacts.map((c) => (
                  <tr key={c._id} className="hover:bg-[#ffffff02] transition-colors group">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white text-sm">{c.name}</div>
                      <div className="text-xs text-[#757686] mt-0.5">{c.email}</div>
                    </td>
                    <td className="py-4 px-6 max-w-md">
                      <div className="font-bold text-xs text-[#dfe0ff] mb-1">{c.subject || 'No Subject'}</div>
                      <p className="text-xs text-[#757686] line-clamp-2 leading-relaxed">{c.message}</p>
                    </td>
                    <td className="py-4 px-6 text-xs text-[#757686]">
                      {new Date(c.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <Badge
                        variant={c.status === 'resolved' ? 'active' : 'suspended'}
                        className="capitalize"
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setReplyModal({ open: true, contact: c });
                            setEmailSubject(`Re: ${c.subject || 'Your Support Inquiry'}`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#ffffff05] border border-white/10 hover:border-white/20 text-xs text-white flex items-center gap-1.5 transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">reply</span>
                          Reply
                        </button>
                        {c.status === 'pending' && (
                          <button
                            onClick={() => handleResolve(c._id)}
                            className="px-3 py-1.5 rounded-lg bg-[#153b15] border border-[#a0f0a0]/20 hover:bg-[#1e531e] text-xs text-[#e0ffe0] flex items-center gap-1.5 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">done</span>
                            Resolve
                          </button>
                        )}
                      </div>
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

      {/* Reply Modal */}
      {replyModal.open && replyModal.contact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#2f3038] border border-white/10 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#ffffff02] border-b border-white/5 flex justify-between items-center">
              <h2 className="font-extrabold text-white text-lg">Send Email Response</h2>
              <button
                onClick={() => setReplyModal({ open: false, contact: null })}
                className="text-[#757686] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-black/25 p-4 rounded-xl border border-white/5 text-xs text-[#757686]">
                <p><strong>To:</strong> {replyModal.contact.name} &lt;{replyModal.contact.email}&gt;</p>
                <p className="mt-1.5">
                  <strong>Original Message:</strong> &quot;{replyModal.contact.message}&quot;
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#757686] uppercase tracking-wider mb-2">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-black/25 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#757686] uppercase tracking-wider mb-2">Message Body</label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Enter your support email response..."
                  className="w-full bg-black/25 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#ffffff02] border-t border-white/5 flex justify-end gap-3">
              <button
                onClick={() => setReplyModal({ open: false, contact: null })}
                disabled={sendingEmail}
                className="px-4 py-2 text-xs font-bold text-[#757686] hover:text-white transition-colors uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReply}
                disabled={sendingEmail || !emailSubject || !emailBody}
                className="bg-accent text-black px-6 py-2 rounded-xl text-xs font-bold hover:bg-accent/90 transition-all uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>Sending...</>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">send</span>
                    Send Reply
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
