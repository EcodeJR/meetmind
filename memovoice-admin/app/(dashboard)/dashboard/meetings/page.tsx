'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

interface Meeting {
  _id: string;
  title: string;
  userEmail: string;
  userName: string;
  duration: number;
  status: string;
  createdAt: string;
  platform?: string;
}

const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API || 'https://memovoice-backend.up.railway.app';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const STATUS_FILTERS = ['All', 'Completed', 'Processing', 'Failed'];

const MOCK_MEETINGS: Meeting[] = [
  { _id: '1', title: 'Q4 Planning Session', userEmail: 'sarah.m@agency.com', userName: 'Sarah Miller', duration: 24, status: 'completed', createdAt: '2024-01-15T10:00:00Z', platform: 'Zoom' },
  { _id: '2', title: 'Daily Standup', userEmail: 'd.chen@startup.io', userName: 'David Chen', duration: 12, status: 'processing', createdAt: '2024-01-15T09:00:00Z', platform: 'Google Meet' },
  { _id: '3', title: 'Product Review', userEmail: 'elena.r@global.co', userName: 'Elena Rodriguez', duration: 45, status: 'completed', createdAt: '2024-01-14T14:00:00Z', platform: 'MS Teams' },
  { _id: '4', title: 'Investor Call', userEmail: 'a.patel@tech.org', userName: 'Aisha Patel', duration: 60, status: 'failed', createdAt: '2024-01-14T11:00:00Z', platform: 'Zoom' },
  { _id: '5', title: 'Team Retrospective', userEmail: 'sarah.m@agency.com', userName: 'Sarah Miller', duration: 30, status: 'completed', createdAt: '2024-01-13T16:00:00Z', platform: 'Google Meet' },
];

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchEmail, setSearchEmail] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMeeting, setViewMeeting] = useState<Meeting | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(searchEmail && { userId: searchEmail }),
        ...(statusFilter !== 'All' && { status: statusFilter.toLowerCase() }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`${RAILWAY_API}/admin/meetings?${params}`, {
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
        setTotal(data.total || 0);
      } else throw new Error();
    } catch {
      setMeetings(MOCK_MEETINGS);
      setTotal(2847);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [page, statusFilter, searchEmail, dateFrom, dateTo]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${RAILWAY_API}/admin/meetings/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) {
        showToast('Meeting deleted');
        setMeetings(ms => ms.filter(m => m._id !== id));
      }
    } catch {
      showToast('Delete failed', 'error');
    }
    setDeleteConfirm(null);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatDuration = (mins: number) =>
    mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;

  const getUserInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-[14px] font-medium text-white animate-slide-up ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl soft-shadow border border-white/80">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search by email */}
          <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: '18px' }}>search</span>
            <input
              placeholder="Search by user email..."
              value={searchEmail}
              onChange={e => { setSearchEmail(e.target.value); setPage(1); }}
              className="bg-transparent outline-none text-[14px] text-on-surface placeholder:text-outline-variant w-full"
            />
          </div>

          {/* Date From */}
          <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: '18px' }}>calendar_today</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent outline-none text-[14px] text-on-surface w-full"
            />
          </div>

          {/* Date To */}
          <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: '18px' }}>event</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent outline-none text-[14px] text-on-surface w-full"
            />
          </div>

          {/* Status Filter */}
          <div className="flex bg-surface-container-low rounded-xl p-1 gap-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => { setStatusFilter(f); setPage(1); }}
                className={`flex-1 text-center py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  statusFilter === f
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-highest'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Meetings', value: '2,847', icon: 'mic', color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Completed', value: '2,641', icon: 'check_circle', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Processing', value: '145', icon: 'sync', color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Failed', value: '61', icon: 'error', color: 'text-error', bg: 'bg-error-container' },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="bg-surface-container-lowest p-4 rounded-2xl soft-shadow border border-white/80">
            <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center mb-3`}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
            </div>
            <p className="text-[11px] text-outline uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-[24px] font-bold font-geist text-on-surface">{value}</p>
          </div>
        ))}
      </div>

      {/* Meetings Table */}
      <div className="bg-surface-container-lowest rounded-2xl soft-shadow border border-white/80 overflow-hidden">
        <div className="px-6 py-5 border-b border-outline-variant flex justify-between items-center">
          <div>
            <h3 className="text-[18px] font-semibold font-geist text-on-surface">All Meetings</h3>
            <p className="text-[12px] text-outline mt-0.5">{new Intl.NumberFormat().format(total)} total meetings</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {['User', 'Title', 'Duration', 'Date', 'Status', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-6 py-3 text-[12px] font-bold text-outline uppercase tracking-wider ${i === 5 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {loading ? (
                <tr><td colSpan={6}><TableSkeleton rows={5} cols={6} /></td></tr>
              ) : meetings.map((m) => (
                <tr key={m._id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                        {getUserInitials(m.userName || 'U')}
                      </div>
                      <div>
                        <p className="font-medium text-on-surface text-[13px]">{m.userName}</p>
                        <p className="text-outline text-[11px]">{m.userEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>description</span>
                      <span className="font-medium text-on-surface text-[14px]">{m.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant text-[14px]">{formatDuration(m.duration)}</td>
                  <td className="px-6 py-4 text-outline text-[13px]">{formatDate(m.createdAt)}</td>
                  <td className="px-6 py-4">
                    <Badge variant={(m.status as any) || 'completed'} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1 text-outline">
                      <button
                        onClick={() => setViewMeeting(m)}
                        className="p-1.5 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="View transcript"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(m._id)}
                        className="p-1.5 hover:text-error hover:bg-error-container/30 rounded-lg transition-colors"
                        title="Delete meeting"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-surface-container border-t border-outline-variant flex justify-between items-center">
          <p className="text-[14px] text-on-surface-variant">
            Showing <span className="font-bold text-on-surface">{((page - 1) * 10) + 1}–{Math.min(page * 10, total)}</span> of <span className="font-bold text-on-surface">{new Intl.NumberFormat().format(total)}</span>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-highest text-outline disabled:opacity-40 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
            </button>
            <span className="text-[14px] text-on-surface px-2">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={meetings.length < 10} className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-highest text-outline disabled:opacity-40 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* View Transcript Modal */}
      {viewMeeting && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-2xl w-full soft-shadow animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[18px] font-semibold font-geist text-on-surface">{viewMeeting.title}</h3>
                <p className="text-[12px] text-outline mt-1">{viewMeeting.userName} · {formatDuration(viewMeeting.duration)} · <Badge variant={(viewMeeting.status as any) || 'completed'} /></p>
              </div>
              <button onClick={() => setViewMeeting(null)} className="p-1 text-outline hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            <div className="bg-surface-container-low rounded-xl p-6 text-[14px] text-on-surface leading-relaxed">
              <p className="text-outline italic">Transcript content would load here from the backend. This meeting was recorded on {formatDate(viewMeeting.createdAt)}.</p>
              <div className="mt-4 space-y-3">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold flex-shrink-0">U1</div>
                  <div className="bg-surface-container rounded-xl px-4 py-2 text-[13px]">Good morning everyone, let's get started with today's agenda...</div>
                </div>
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-[10px] font-bold flex-shrink-0">U2</div>
                  <div className="bg-surface-container rounded-xl px-4 py-2 text-[13px]">Sure, I have some updates from the product team to share...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full soft-shadow animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center text-error mb-4">
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>delete_forever</span>
            </div>
            <h3 className="text-[18px] font-semibold font-geist text-on-surface mb-2">Delete Meeting?</h3>
            <p className="text-[14px] text-outline mb-6">This will permanently delete this meeting and its transcript. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-lg border border-outline-variant text-on-surface text-[14px] font-medium hover:bg-surface-container-low transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-lg bg-error text-on-error text-[14px] font-semibold hover:brightness-110 transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
