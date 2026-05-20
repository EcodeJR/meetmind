'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';

interface UserDetail {
  _id: string;
  name: string;
  email: string;
  clerkId: string;
  subscription: { plan: string; status: string; provider?: string };
  meetingCount: number;
  lastActive: string;
  createdAt: string;
  country?: string;
}

interface Meeting {
  _id: string;
  title: string;
  duration: number;
  status: string;
  createdAt: string;
}

const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API || 'https://memovoice-backend.onrender.com';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const MOCK_USER: UserDetail = {
  _id: '1', name: 'Sarah Miller', email: 'sarah.m@agency.com', clerkId: 'clerk_abc123',
  subscription: { plan: 'pro', status: 'active', provider: 'Paddle' },
  meetingCount: 142, lastActive: '2 mins ago', createdAt: '2023-10-12T00:00:00Z', country: 'US',
};

const MOCK_MEETINGS: Meeting[] = [
  { _id: 'm1', title: 'Q4 Planning', duration: 24, status: 'completed', createdAt: '2024-01-15T10:00:00Z' },
  { _id: 'm2', title: 'Daily Standup', duration: 12, status: 'completed', createdAt: '2024-01-14T09:00:00Z' },
  { _id: 'm3', title: 'Product Review', duration: 45, status: 'processing', createdAt: '2024-01-13T14:00:00Z' },
  { _id: 'm4', title: 'Client Call', duration: 60, status: 'completed', createdAt: '2024-01-12T11:00:00Z' },
];

export default function UserDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${RAILWAY_API}/admin/users/${id}`, {
          headers: { 'x-admin-key': ADMIN_KEY },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || data);
          setMeetings(data.meetings || []);
        } else throw new Error();
      } catch {
        setUser(MOCK_USER);
        setMeetings(MOCK_MEETINGS);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  const handleUpgradePlan = async (plan: string) => {
    try {
      const res = await fetch(`${RAILWAY_API}/admin/users/${id}/plan`, {
        method: 'PATCH',
        headers: { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, status: 'active' }),
      });
      if (res.ok) {
        showToast(`Plan updated to ${plan}`);
        setUser(u => u ? { ...u, subscription: { ...u.subscription, plan } } : u);
      }
    } catch {
      showToast('Update failed', 'error');
    }
  };

  const handleSuspend = async () => {
    try {
      const res = await fetch(`${RAILWAY_API}/admin/users/${id}/suspend`, {
        method: 'PATCH',
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) showToast('User suspended');
    } catch {
      showToast('Action failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`${RAILWAY_API}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) {
        showToast('User deleted');
        setTimeout(() => router.push('/dashboard/users'), 1000);
      }
    } catch {
      showToast('Delete failed', 'error');
    }
    setShowDeleteModal(false);
  };

  const handleSendEmail = async () => {
    try {
      const res = await fetch('/api/email/send-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: user?.email, subject: emailSubject, html: emailBody }),
      });
      if (res.ok) {
        showToast('Email sent!');
        setShowEmailModal(false);
        setEmailSubject('');
        setEmailBody('');
      }
    } catch {
      showToast('Failed to send email', 'error');
    }
  };

  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const formatDuration = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-32 bg-surface-container rounded" />
        <div className="bg-surface-container-lowest rounded-2xl p-8 h-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-[14px] font-medium text-white animate-slide-up ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Back Button */}
      <Link href="/dashboard/users" className="inline-flex items-center gap-2 text-[14px] text-outline hover:text-primary transition-colors">
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        Back to Users
      </Link>

      {/* Profile Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-8 soft-shadow border border-white/80">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Avatar & Info */}
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-on-primary font-bold text-2xl flex-shrink-0">
              {getUserInitials(user.name)}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-[24px] font-bold font-geist text-on-surface">{user.name}</h2>
                <Badge variant={(user.subscription.status === 'suspended' ? 'suspended' : user.subscription.plan) as any} />
                {user.subscription.status === 'active' && <Badge variant="active" />}
              </div>
              <p className="text-[14px] text-outline mb-1">{user.email}</p>
              <p className="text-[12px] text-outline-variant">ID: {user.clerkId}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {[
                  { label: 'Joined', value: formatDate(user.createdAt), icon: 'calendar_today' },
                  { label: 'Last Active', value: user.lastActive, icon: 'schedule' },
                  { label: 'Meetings', value: user.meetingCount, icon: 'mic' },
                  { label: 'Provider', value: user.subscription.provider || 'N/A', icon: 'credit_card' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="bg-surface-container-low rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-outline" style={{ fontSize: '16px' }}>{icon}</span>
                      <p className="text-[11px] text-outline uppercase tracking-wider">{label}</p>
                    </div>
                    <p className="text-[14px] font-semibold text-on-surface">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 lg:ml-auto min-w-[200px]">
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-[14px] font-medium hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>mail</span>
              Send Email
            </button>
            {user.subscription.plan === 'free' ? (
              <button
                onClick={() => handleUpgradePlan('pro')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-[14px] font-medium hover:brightness-110 transition-all"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upgrade</span>
                Upgrade to Pro
              </button>
            ) : (
              <button
                onClick={() => handleUpgradePlan('free')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container text-on-surface-variant text-[14px] font-medium hover:bg-surface-container-high transition-all border border-outline-variant"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_downward</span>
                Downgrade to Free
              </button>
            )}
            <button
              onClick={handleSuspend}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#ffdcc6] text-[#914800] text-[14px] font-medium hover:bg-[#ffdcc6]/30 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>block</span>
              Suspend Account
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-error-container text-error text-[14px] font-medium hover:bg-error-container/30 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Meetings Table */}
      <div className="bg-surface-container-lowest rounded-2xl soft-shadow border border-white/80 overflow-hidden">
        <div className="px-6 py-5 border-b border-outline-variant">
          <h3 className="text-[18px] font-semibold font-geist text-on-surface">Meeting History</h3>
          <p className="text-[12px] text-outline mt-0.5">All meetings recorded by this user</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {['Title', 'Date', 'Duration', 'Status', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-6 py-3 text-[12px] font-bold text-outline uppercase tracking-wider ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {meetings.map((m) => (
                <tr key={m._id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>description</span>
                      </div>
                      <span className="font-medium text-on-surface text-[14px]">{m.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-outline text-[14px]">
                    {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant text-[14px]">{formatDuration(m.duration)}</td>
                  <td className="px-6 py-4">
                    <Badge variant={(m.status as any) || 'completed'} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1 text-outline">
                      <button className="p-1.5 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="View transcript">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                      </button>
                      <button className="p-1.5 hover:text-error hover:bg-error-container/30 rounded-lg transition-colors" title="Delete meeting">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-lg w-full soft-shadow animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[18px] font-semibold font-geist text-on-surface">Send Email to {user.name}</h3>
              <button onClick={() => setShowEmailModal(false)} className="p-1 text-outline hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-medium text-on-surface-variant block mb-1.5">To</label>
                <div className="px-4 py-2.5 rounded-lg bg-surface-container text-[14px] text-outline">{user.email}</div>
              </div>
              <div>
                <label className="text-[12px] font-medium text-on-surface-variant block mb-1.5">Subject</label>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-bright text-[14px] text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-on-surface-variant block mb-1.5">Message</label>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={5}
                  placeholder="Write your message..."
                  className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-bright text-[14px] text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEmailModal(false)} className="flex-1 py-2.5 rounded-lg border border-outline-variant text-on-surface text-[14px] font-medium hover:bg-surface-container-low transition-all">
                Cancel
              </button>
              <button onClick={handleSendEmail} className="flex-1 py-2.5 rounded-lg bg-primary text-on-primary text-[14px] font-semibold hover:brightness-110 transition-all">
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full soft-shadow animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center text-error mb-4">
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>delete_forever</span>
            </div>
            <h3 className="text-[18px] font-semibold font-geist text-on-surface mb-2">Delete {user.name}?</h3>
            <p className="text-[14px] text-outline mb-6">This will permanently delete this user and all their data. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-lg border border-outline-variant text-on-surface text-[14px] font-medium hover:bg-surface-container-low transition-all">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-lg bg-error text-on-error text-[14px] font-semibold hover:brightness-110 transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
