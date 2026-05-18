'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

interface User {
  _id: string;
  name: string;
  email: string;
  subscription: { plan: string; status: string; provider?: string };
  meetingCount: number;
  lastActive: string;
  createdAt: string;
}

interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  pages: number;
}

const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API || 'https://memovoice-backend.up.railway.app';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const filters = ['All', 'Pro', 'Free', 'Suspended'];

const MOCK_USERS: User[] = [
  { _id: '1', name: 'Sarah Miller', email: 'sarah.m@agency.com', subscription: { plan: 'pro', status: 'active' }, meetingCount: 142, lastActive: '2 mins ago', createdAt: '2023-10-12T00:00:00Z' },
  { _id: '2', name: 'David Chen', email: 'd.chen@startup.io', subscription: { plan: 'free', status: 'active' }, meetingCount: 28, lastActive: '4 hours ago', createdAt: '2023-11-05T00:00:00Z' },
  { _id: '3', name: 'Elena Rodriguez', email: 'elena.r@global.co', subscription: { plan: 'pro', status: 'active' }, meetingCount: 512, lastActive: 'Online', createdAt: '2023-01-18T00:00:00Z' },
  { _id: '4', name: 'Marcus Thompson', email: 'm.thompson@design.net', subscription: { plan: 'free', status: 'suspended' }, meetingCount: 0, lastActive: '3 months ago', createdAt: '2023-02-22T00:00:00Z' },
  { _id: '5', name: 'Aisha Patel', email: 'a.patel@tech.org', subscription: { plan: 'pro', status: 'active' }, meetingCount: 89, lastActive: '1 hour ago', createdAt: '2023-09-03T00:00:00Z' },
];

export default function UsersPage() {
  const [data, setData] = useState<PaginatedUsers>({ users: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState<{ proUsers: number; freeUsers: number } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(search && { search }),
        ...(activeFilter !== 'All' && { plan: activeFilter.toLowerCase() }),
      });
      const res = await fetch(`${RAILWAY_API}/admin/users?${params}`, {
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) {
        setData(await res.json());
      } else throw new Error();
    } catch {
      setData({ users: MOCK_USERS, total: 248, page: 1, pages: 25 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search, activeFilter]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${RAILWAY_API}/admin/stats`, {
          headers: { 'x-admin-key': ADMIN_KEY },
        });
        if (res.ok) {
          const s = await res.json();
          setStats({ proUsers: s.proUsers || 0, freeUsers: s.freeUsers || 0 });
        }
      } catch (err) {
        console.error('Failed to fetch user index stats:', err);
      }
    };
    fetchStats();
  }, []);

  const handleSuspend = async (id: string) => {
    try {
      const res = await fetch(`${RAILWAY_API}/admin/users/${id}/suspend`, {
        method: 'PATCH',
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) {
        showToast('User suspended');
        fetchUsers();
      }
    } catch {
      showToast('Action failed', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${RAILWAY_API}/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (res.ok) {
        showToast('User deleted');
        fetchUsers();
      }
    } catch {
      showToast('Delete failed', 'error');
    }
    setDeleteConfirm(null);
  };

  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getPlanBadgeVariant = (plan: string, status: string) => {
    if (status === 'suspended') return 'suspended';
    return plan as 'pro' | 'free';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-[14px] font-medium text-white transition-all animate-slide-up ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Search & Filter */}
      <section className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant focus-within:ring-2 focus-within:ring-primary/20 transition-all flex items-center gap-3 soft-shadow">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: '20px' }}>search</span>
            <input
              className="bg-transparent border-none outline-none w-full text-[14px] text-on-surface placeholder:text-outline-variant"
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-outline hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            )}
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 flex items-center bg-surface-container-low rounded-xl p-1 gap-1 soft-shadow">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => { setActiveFilter(f); setPage(1); }}
              className={`flex-1 text-center py-2 px-3 rounded-lg text-[12px] font-semibold transition-all ${
                activeFilter === f
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-highest'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {/* Stat Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Users', value: data.total || 0, icon: 'group', iconBg: 'bg-primary/10', iconColor: 'text-primary', change: '+12%' },
          { label: 'Pro Users', value: stats?.proUsers ?? 0, icon: 'diamond', iconBg: 'bg-primary-container', iconColor: 'text-on-primary', change: '+5%' },
          { label: 'Free Users', value: stats?.freeUsers ?? 0, icon: 'person_outline', iconBg: 'bg-secondary-container', iconColor: 'text-on-secondary-container', change: '-2%' },
        ].map(({ label, value, icon, iconBg, iconColor, change }) => (
          <div key={label} className="bg-surface-container-lowest p-6 rounded-2xl soft-shadow card-hover border border-white/80">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 ${iconBg} rounded-xl ${iconColor}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{icon}</span>
              </div>
              <span className="text-[12px] font-bold text-[#713700] bg-[#ffdcc6] px-2 py-0.5 rounded-full">{change}</span>
            </div>
            <p className="text-[12px] text-outline uppercase tracking-wider mb-1">{label}</p>
            <h2 className="text-[32px] leading-10 tracking-tight font-bold text-on-surface">{new Intl.NumberFormat().format(value)}</h2>
          </div>
        ))}
      </section>

      {/* Data Table */}
      <section className="bg-surface-container-lowest rounded-2xl soft-shadow border border-white/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {['User', 'Email', 'Plan', 'Meetings', 'Last Active', 'Joined', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-4 text-[12px] font-bold text-outline uppercase tracking-wider ${i === 6 ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <TableSkeleton rows={5} cols={7} />
                  </td>
                </tr>
              ) : data.users.map((user) => (
                <tr key={user._id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                        {getUserInitials(user.name || 'U')}
                      </div>
                      <span className="font-semibold text-on-surface">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant text-[14px]">{user.email}</td>
                  <td className="px-6 py-4">
                    <Badge variant={getPlanBadgeVariant(user.subscription?.plan, user.subscription?.status)} />
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{user.meetingCount}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{user.lastActive}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1 text-outline">
                      <Link href={`/dashboard/users/${user._id}`}>
                        <button className="p-1.5 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="View profile">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                        </button>
                      </Link>
                      <button className="p-1.5 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Edit plan">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                      </button>
                      <button
                        onClick={() => handleSuspend(user._id)}
                        className="p-1.5 hover:text-[#914800] hover:bg-[#ffdcc6]/30 rounded-lg transition-colors"
                        title="Suspend account"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>block</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(user._id)}
                        className="p-1.5 hover:text-error hover:bg-error-container/30 rounded-lg transition-colors"
                        title="Delete account"
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
        <div className="px-6 py-4 bg-surface-container border-t border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[14px] text-on-surface-variant">
            Showing <span className="font-bold text-on-surface">{((page - 1) * 10) + 1}–{Math.min(page * 10, data.total)}</span> of{' '}
            <span className="font-bold text-on-surface">{new Intl.NumberFormat().format(data.total)}</span> users
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-highest transition-all text-outline disabled:opacity-40"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
            </button>
            {Array.from({ length: Math.min(3, data.pages) }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-lg font-semibold transition-all ${page === p ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-surface-container-highest text-on-surface'}`}
                >
                  {p}
                </button>
              );
            })}
            {data.pages > 4 && <span className="px-2 text-outline">...</span>}
            {data.pages > 3 && (
              <button
                onClick={() => setPage(data.pages)}
                className={`w-10 h-10 rounded-lg font-semibold hover:bg-surface-container-highest text-on-surface transition-all ${page === data.pages ? 'bg-primary text-on-primary' : ''}`}
              >
                {data.pages}
              </button>
            )}
            <button
              onClick={() => setPage(p => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-highest transition-all text-outline disabled:opacity-40"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
            </button>
          </div>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-sm w-full soft-shadow animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center text-error mb-4">
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>delete_forever</span>
            </div>
            <h3 className="text-[18px] font-semibold font-geist text-on-surface mb-2">Delete User?</h3>
            <p className="text-[14px] text-outline mb-6">This will permanently delete the user and all their meetings and data. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-lg border border-outline-variant text-on-surface text-[14px] font-medium hover:bg-surface-container-low transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 rounded-lg bg-error text-on-error text-[14px] font-semibold hover:brightness-110 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
