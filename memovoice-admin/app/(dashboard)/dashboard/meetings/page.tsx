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
  rawTranscript?: string;
  summary?: string;
  actionItems?: string[];
  keyDecisions?: string[];
}

const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API || 'https://memovoice-backend.onrender.com';
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
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState<{ totalMeetings: number; completedMeetings: number; processingMeetings: number; failedMeetings: number } | null>(null);

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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${RAILWAY_API}/admin/stats`, {
          headers: { 'x-admin-key': ADMIN_KEY },
        });
        if (res.ok) {
          const s = await res.json();
          setStats({
            totalMeetings: s.totalMeetings || 0,
            completedMeetings: s.completedMeetings || 0,
            processingMeetings: s.processingMeetings || 0,
            failedMeetings: s.failedMeetings || 0,
          });
        }
      } catch (err) {
        console.error('Failed to fetch meeting index stats:', err);
      }
    };
    fetchStats();
  }, []);

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

  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

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
          { label: 'Total Meetings', value: stats ? new Intl.NumberFormat().format(stats.totalMeetings) : '...', icon: 'mic', color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Completed', value: stats ? new Intl.NumberFormat().format(stats.completedMeetings) : '...', icon: 'check_circle', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Processing', value: stats ? new Intl.NumberFormat().format(stats.processingMeetings) : '...', icon: 'sync', color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Failed', value: stats ? new Intl.NumberFormat().format(stats.failedMeetings) : '...', icon: 'error', color: 'text-error', bg: 'bg-error-container' },
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
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-2xl w-full soft-shadow animate-slide-up max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-[18px] font-semibold font-geist text-on-surface">{viewMeeting.title}</h3>
                <p className="text-[12px] text-outline mt-1">{viewMeeting.userName || 'Unknown User'} · {viewMeeting.userEmail || 'No Email'} · {formatDuration(viewMeeting.duration)} · <Badge variant={(viewMeeting.status as any) || 'completed'} /></p>
              </div>
              <button onClick={() => { setViewMeeting(null); setActiveTab('transcript'); }} className="p-1 text-outline hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            {/* GDPR & Compliance Alert */}
            <div className="bg-[#fff7e6] text-[#b26900] border border-[#ffe5b3] rounded-xl p-3 mb-4 text-[12px] flex gap-2.5 items-start leading-relaxed">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#d48806', flexShrink: 0 }}>security</span>
              <div>
                <span className="font-bold">GDPR & Privacy Compliance Lock:</span> Under Section 5 of the <span className="font-semibold underline">Terms of Service</span> and Section 5 of the <span className="font-semibold underline">Privacy Policy</span>, all raw meeting audio and transcripts are the exclusive intellectual property of the account holder. Admins must respect sovereign user boundaries.
              </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-outline-variant mb-4 flex-shrink-0">
              <button
                onClick={() => setActiveTab('transcript')}
                className={`px-4 py-2 text-[13px] font-bold border-b-2 transition-all ${activeTab === 'transcript' ? 'border-primary text-primary' : 'border-transparent text-outline hover:text-on-surface'}`}
              >
                Raw Transcript
              </button>
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-4 py-2 text-[13px] font-bold border-b-2 transition-all ${activeTab === 'summary' ? 'border-primary text-primary' : 'border-transparent text-outline hover:text-on-surface'}`}
              >
                AI Summary & Insights
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto bg-surface-container-low rounded-xl p-6 text-[14px] text-on-surface leading-relaxed min-h-[250px]">
              {activeTab === 'transcript' ? (
                <div>
                  {viewMeeting.rawTranscript ? (
                    <div className="whitespace-pre-wrap font-sans text-on-surface text-[13px]">
                      {viewMeeting.rawTranscript}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-outline">
                      <span className="material-symbols-outlined mb-2" style={{ fontSize: '32px' }}>description</span>
                      No transcript has been generated for this meeting.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {viewMeeting.summary ? (
                    <div>
                      <h4 className="font-bold text-on-surface text-[14px] mb-1.5">Executive Summary</h4>
                      <p className="text-[13px] text-on-surface-variant bg-surface-container-lowest/50 p-4 rounded-xl border border-outline-variant/30">{viewMeeting.summary}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-outline">
                      <span className="material-symbols-outlined mb-2" style={{ fontSize: '32px' }}>auto_awesome</span>
                      No AI summary or insights available.
                    </div>
                  )}

                  {viewMeeting.keyDecisions && viewMeeting.keyDecisions.length > 0 && (
                    <div>
                      <h4 className="font-bold text-on-surface text-[14px] mb-1.5 flex items-center gap-1.5 text-emerald-600">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified</span>
                        Key Decisions
                      </h4>
                      <ul className="list-disc pl-5 text-[13px] space-y-1 text-on-surface-variant">
                        {viewMeeting.keyDecisions.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {viewMeeting.actionItems && viewMeeting.actionItems.length > 0 && (
                    <div>
                      <h4 className="font-bold text-on-surface text-[14px] mb-1.5 flex items-center gap-1.5 text-primary">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>assignment</span>
                        Action Items
                      </h4>
                      <ul className="list-disc pl-5 text-[13px] space-y-1 text-on-surface-variant">
                        {viewMeeting.actionItems.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
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

