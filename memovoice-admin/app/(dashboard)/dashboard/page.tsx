'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';

interface Stats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  totalMeetings: number;
  meetingsThisMonth: number;
  newUsersThisMonth: number;
  monthlyRevenue: number;
  activeSubscriptions: number;
}

interface RecentUser {
  _id: string;
  name: string;
  email: string;
  subscription: { plan: string };
  createdAt: string;
}

interface RecentMeeting {
  _id: string;
  title: string;
  duration: number;
  status: string;
  createdAt: string;
  platform?: string;
}

const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API || 'https://memovoice.onrender.com';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const adminHeaders = { 'x-admin-key': ADMIN_KEY };

// Mock sparkline data
const userSparkline = [40, 60, 50, 80, 70, 95];
const proSparkline = [30, 50, 80, 60, 85, 90];
const meetingSparkline = [90, 80, 60, 40, 30, 45];
const revenueSparkline = [50, 65, 70, 80, 90, 100];

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<RecentMeeting[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [userSeries, setUserSeries] = useState<number[]>([]);
  const [meetingSeries, setMeetingSeries] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [debugData, setDebugData] = useState<any | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, usersRes, meetingsRes, metricsRes] = await Promise.all([
        fetch(`${RAILWAY_API}/admin/stats`, { headers: adminHeaders }),
        fetch(`${RAILWAY_API}/admin/users?page=1&limit=5`, { headers: adminHeaders }),
        fetch(`${RAILWAY_API}/admin/meetings?page=1&limit=5`, { headers: adminHeaders }),
        fetch(`${RAILWAY_API}/admin/metrics?days=30`, { headers: adminHeaders }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) {
        const data = await usersRes.json();
        setRecentUsers(data.users || []);
      }
      if (meetingsRes.ok) {
        const data = await meetingsRes.json();
        setRecentMeetings(data.meetings || []);
      }
      if (metricsRes && metricsRes.ok) {
        const data = await metricsRes.json();
        setChartLabels(data.labels || []);
        setUserSeries(data.users || []);
        setMeetingSeries(data.meetings || []);
      }
      // fetch debug info
      try {
        const debugRes = await fetch(`${RAILWAY_API}/admin/debug`, { headers: adminHeaders });
        if (debugRes.ok) setDebugData(await debugRes.json());
      } catch (e) {
        console.debug('admin debug fetch failed', e);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      // Use mock data on error
      setStats({
        totalUsers: 12482,
        proUsers: 4102,
        freeUsers: 8380,
        totalMeetings: 98432,
        meetingsThisMonth: 856,
        newUsersThisMonth: 1240,
        monthlyRevenue: 42400,
        activeSubscriptions: 4102,
      });
      setRecentUsers([
        { _id: '1', name: 'Alex Johnson', email: 'alex.j@company.com', subscription: { plan: 'pro' }, createdAt: new Date().toISOString() },
        { _id: '2', name: 'Sarah Kim', email: 'sarah.k@startup.io', subscription: { plan: 'free' }, createdAt: new Date(Date.now() - 86400000).toISOString() },
        { _id: '3', name: 'Mike Lee', email: 'mike.l@agency.co', subscription: { plan: 'pro' }, createdAt: new Date(Date.now() - 172800000).toISOString() },
      ]);
      setRecentMeetings([
        { _id: '1', title: 'Q4 Planning', duration: 24, status: 'completed', createdAt: new Date().toISOString(), platform: 'Zoom' },
        { _id: '2', title: 'Daily Sync', duration: 12, status: 'processing', createdAt: new Date().toISOString(), platform: 'Google Meet' },
        { _id: '3', title: 'Product Review', duration: 45, status: 'completed', createdAt: new Date(Date.now() - 3600000).toISOString(), platform: 'MS Teams' },
      ]);
      // fallback chart data
      const fallbackLabels = Array.from({ length: 14 }).map((_, i) => new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      setChartLabels(fallbackLabels);
      setUserSeries([5, 8, 6, 12, 10, 14, 9, 11, 13, 7, 15, 10, 12, 16]);
      setMeetingSeries([40, 55, 75, 60, 85, 45, 65, 50, 95, 30, 70, 55, 80, 90]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { linePath, areaPath, lineMax } = useMemo(() => {
    if (!userSeries || userSeries.length === 0) return { linePath: '', areaPath: '', lineMax: 1 };
    const n = userSeries.length;
    const max = Math.max(...userSeries, 1);
    const points = userSeries.map((v, i) => {
      const x = (i / Math.max(1, n - 1)) * 400;
      const y = 100 - (v / max) * 80; // pad bottom
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
    const area = `${points} L 400 100 L 0 100 Z`;
    return { linePath: points, areaPath: area, lineMax: max };
  }, [userSeries]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const formatNumber = (n: number) =>
    new Intl.NumberFormat('en-US').format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const getMeetingIcon = (status: string) => {
    if (status === 'completed') return 'description';
    if (status === 'processing') return 'sync';
    return 'rate_review';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-[14px] text-outline">Welcome back, Admin</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-[14px] text-on-surface hover:bg-surface-container-low transition-all soft-shadow disabled:opacity-60"
        >
          <span
            className={`material-symbols-outlined ${refreshing ? 'animate-spin' : ''}`}
            style={{ fontSize: '18px' }}
          >
            refresh
          </span>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={formatNumber(stats?.totalUsers || 0)}
            change="+12%"
            icon="group"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            sparkline={userSparkline}
            sparklineColor="bg-primary"
          />
          <StatCard
            title="Pro Subscribers"
            value={formatNumber(stats?.proUsers || 0)}
            change="+8%"
            icon="verified"
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            sparkline={proSparkline}
            sparklineColor="bg-emerald-500"
          />
          <StatCard
            title="Meetings Recorded"
            value={formatNumber(stats?.meetingsThisMonth || 0)}
            change="-2%"
            changePositive={false}
            icon="video_chat"
            iconBg="bg-purple-50"
            iconColor="text-purple-600"
            sparkline={meetingSparkline}
            sparklineColor="bg-purple-500"
          />
          <StatCard
            title="Monthly Revenue"
            value={formatCurrency(stats?.monthlyRevenue || 0)}
            change="+15%"
            icon="payments"
            dark
            sparkline={revenueSparkline}
            subtitle="Target met: 104%"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: New Users */}
        <div className="bg-surface-container-lowest p-8 rounded-2xl soft-shadow border border-surface-container">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h4 className="text-[18px] font-semibold font-geist text-on-surface">New Users</h4>
              <p className="text-[12px] text-outline">Growth trends over the last 30 days</p>
            </div>
            <select className="bg-surface-container-low border-none rounded-lg text-[12px] px-3 py-1 outline-none text-on-surface-variant">
              <option>Last 30 Days</option>
              <option>Last 60 Days</option>
            </select>
          </div>
          <div className="h-[200px] w-full relative">
            <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-outline-variant pointer-events-none pb-4">
              <div className="border-b border-surface-container w-full">Top</div>
              <div className="border-b border-surface-container w-full">Mid</div>
              <div className="border-b border-surface-container w-full">Low</div>
              <div className="border-b border-surface-container w-full">0</div>
            </div>
            <div className="absolute inset-0 flex items-end justify-between px-4 pb-4">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 100">
                {userSeries && userSeries.length > 0 && (() => {
                  const n = userSeries.length;
                  const max = Math.max(...userSeries, 1);
                  const points = userSeries.map((v, i) => {
                    const x = (i / Math.max(1, n - 1)) * 400;
                    const y = 100 - (v / max) * 80; // pad bottom
                    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
                  }).join(' ');
                  const area = `${points} L 400 100 L 0 100 Z`;
                  return (
                    <>
                      <path d={points} fill="none" stroke="#384cd3" strokeWidth="2.5" strokeLinecap="round" />
                      <path d={area} fill="#384cd3" fillOpacity="0.08" />
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>

        {/* Bar Chart: Meetings */}
        <div className="bg-surface-container-lowest p-8 rounded-2xl soft-shadow border border-surface-container">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h4 className="text-[18px] font-semibold font-geist text-on-surface">Meetings Recorded</h4>
              <p className="text-[12px] text-outline">Daily volume for current cycle</p>
            </div>
            <button className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-outline hover:text-primary transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
            </button>
          </div>
          <div className="h-[200px] w-full flex items-end justify-between gap-1.5 px-2">
            {meetingSeries && meetingSeries.length > 0 ? meetingSeries.map((v, i) => {
              const max = Math.max(...meetingSeries, 1);
              const pct = Math.round((v / max) * 100);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t-lg transition-colors cursor-pointer ${pct >= 85 ? 'bg-primary' : 'bg-primary/20 hover:bg-primary'}`}
                  style={{ height: `${pct}%` }}
                  title={`${chartLabels[i] || `Day ${i + 1}`}: ${v} meetings`}
                />
              );
            }) : (
              // fallback bars
              [40, 55, 75, 60, 85, 45, 65, 50, 95, 30, 70, 55, 80, 90].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t-lg transition-colors cursor-pointer ${h >= 85 ? 'bg-primary' : 'bg-primary/20 hover:bg-primary'}`}
                  style={{ height: `${h}%` }}
                  title={`Day ${i + 1}: ${h} meetings`}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl soft-shadow border border-surface-container">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-[18px] font-semibold font-geist text-on-surface">Recent Signups</h4>
            <Link href="/dashboard/users" className="text-primary text-[12px] font-semibold hover:underline">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[12px] text-outline border-b border-surface-container uppercase tracking-wider">
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-[14px]">
                {recentUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                        {getUserInitials(user.name || 'U')}
                      </div>
                      <span className="font-medium text-on-surface">{user.name}</span>
                    </td>
                    <td className="py-4">
                      <Badge variant={(user.subscription?.plan as any) || 'free'} />
                    </td>
                    <td className="py-4 text-outline">{formatDate(user.createdAt)}</td>
                    <td className="py-4 text-right">
                      <Link href={`/dashboard/users/${user._id}`}>
                        <button className="p-1 text-outline hover:text-primary transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>more_vert</span>
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Meetings */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl soft-shadow border border-surface-container">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-[18px] font-semibold font-geist text-on-surface">Recent Meetings</h4>
            <Link href="/dashboard/meetings" className="text-primary text-[12px] font-semibold hover:underline">
              Full History
            </Link>
          </div>
          <div className="space-y-3">
            {recentMeetings.map((meeting) => (
              <div
                key={meeting._id}
                className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl hover:ring-1 hover:ring-primary/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-bright flex items-center justify-center text-primary flex-shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      {getMeetingIcon(meeting.status)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-on-surface text-[14px]">{meeting.title}</p>
                    <p className="text-[12px] text-outline">
                      {meeting.duration} mins{meeting.platform ? ` · ${meeting.platform}` : ''}
                    </p>
                  </div>
                </div>
                <Badge variant={(meeting.status as any) || 'completed'} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin Debug Panel */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl soft-shadow border border-surface-container">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-[18px] font-semibold font-geist text-on-surface">Admin Debug</h4>
          <p className="text-[12px] text-outline">Quick diagnostics from /admin/debug</p>
        </div>
        {debugData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 bg-surface-container rounded-lg text-center">
                <div className="text-outline text-[12px]">Total</div>
                <div className="text-[18px] font-bold">{debugData.meetings?.total ?? '-'}</div>
              </div>
              <div className="p-3 bg-surface-container rounded-lg text-center">
                <div className="text-outline text-[12px]">Pending</div>
                <div className="text-[18px] font-bold">{debugData.meetings?.pending ?? '-'}</div>
              </div>
              <div className="p-3 bg-surface-container rounded-lg text-center">
                <div className="text-outline text-[12px]">Processing</div>
                <div className="text-[18px] font-bold">{debugData.meetings?.processing ?? '-'}</div>
              </div>
              <div className="p-3 bg-surface-container rounded-lg text-center">
                <div className="text-outline text-[12px]">Completed</div>
                <div className="text-[18px] font-bold">{debugData.meetings?.completed ?? '-'}</div>
              </div>
              <div className="p-3 bg-surface-container rounded-lg text-center">
                <div className="text-outline text-[12px]">Failed</div>
                <div className="text-[18px] font-bold text-rose-600">{debugData.meetings?.failed ?? '-'}</div>
              </div>
            </div>

            <div>
              <h5 className="text-[14px] font-semibold mb-2">Recent Failed Samples</h5>
              {debugData.recentFailed && debugData.recentFailed.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[12px] text-outline border-b border-surface-container uppercase tracking-wider">
                        <th className="pb-2">ID</th>
                        <th className="pb-2">User</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Error</th>
                        <th className="pb-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debugData.recentFailed.map((m: any) => (
                        <tr key={m._id} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-2 font-mono text-[12px] text-on-surface">{m._id}</td>
                          <td className="py-2">{m.user?.email || m.userEmail || '-'}</td>
                          <td className="py-2"><span className="px-2 py-1 rounded-full bg-surface-container text-[12px]">{m.status}</span></td>
                          <td className="py-2 text-[13px] text-rose-600">{m.processingError || '-'}</td>
                          <td className="py-2 text-outline">{new Date(m.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[13px] text-outline">No recent failed meetings found.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-outline">Debug info unavailable.</p>
        )}
      </div>
    </div>
  );
}

