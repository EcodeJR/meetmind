'use client';

import { useEffect, useState } from 'react';

interface RevenueData {
  mrr: number;
  paddle: { total: number; transactions: any[] };
  flutterwave: { total: number; transactions: any[] };
  chartData: { month: string; revenue: number }[];
  activeSubscriptions: number;
  cancelledThisMonth: number;
  failedPayments: number;
}

interface Subscription {
  _id: string;
  name: string;
  email: string;
  plan: string;
  provider: string;
  amount: number;
  status: string;
  nextBilling: string;
}

const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API || 'https://memovoice-backend.up.railway.app';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const MOCK_REVENUE: RevenueData = {
  mrr: 42400,
  paddle: { total: 28300, transactions: [] },
  flutterwave: { total: 14100, transactions: [] },
  chartData: [
    { month: 'Aug', revenue: 31000 },
    { month: 'Sep', revenue: 34500 },
    { month: 'Oct', revenue: 37200 },
    { month: 'Nov', revenue: 39800 },
    { month: 'Dec', revenue: 40100 },
    { month: 'Jan', revenue: 42400 },
  ],
  activeSubscriptions: 4102,
  cancelledThisMonth: 38,
  failedPayments: 12,
};

const MOCK_SUBS: Subscription[] = [
  { _id: '1', name: 'Sarah Miller', email: 'sarah.m@agency.com', plan: 'pro', provider: 'Paddle', amount: 12.99, status: 'active', nextBilling: '2024-02-12' },
  { _id: '2', name: 'Elena Rodriguez', email: 'elena.r@global.co', plan: 'pro', provider: 'Flutterwave', amount: 12.99, status: 'active', nextBilling: '2024-02-18' },
  { _id: '3', name: 'Aisha Patel', email: 'a.patel@tech.org', plan: 'pro', provider: 'Paddle', amount: 12.99, status: 'cancelled', nextBilling: '—' },
  { _id: '4', name: 'James Wilson', email: 'j.wilson@corp.net', plan: 'pro', provider: 'Flutterwave', amount: 12.99, status: 'failed', nextBilling: '2024-01-28' },
];

const FAILED_USERS = [
  { id: '4', name: 'James Wilson', email: 'j.wilson@corp.net', date: '2024-01-20' },
  { id: '5', name: 'Robert Kim', email: 'r.kim@studio.io', date: '2024-01-19' },
];

export default function SubscriptionsPage() {
  const [revenue, setRevenue] = useState<RevenueData>(MOCK_REVENUE);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualEmail, setManualEmail] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [failedPaymentsList, setFailedPaymentsList] = useState<any[]>([]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchRevenueAndSubs = async () => {
      setLoading(true);
      try {
        const [revRes, usersRes] = await Promise.all([
          fetch(`${RAILWAY_API}/admin/revenue`, { headers: { 'x-admin-key': ADMIN_KEY } }),
          fetch(`${RAILWAY_API}/admin/users?limit=50`, { headers: { 'x-admin-key': ADMIN_KEY } }),
        ]);

        if (revRes.ok) {
          setRevenue(await revRes.json());
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          const mappedSubs = data.users.map((u: any) => ({
            _id: u._id,
            name: u.name || u.email.split('@')[0],
            email: u.email,
            plan: u.subscription?.plan || 'free',
            provider: u.subscription?.provider || 'N/A',
            amount: u.subscription?.plan === 'pro' ? 12.99 : 0,
            status: u.subscription?.status || 'inactive',
            nextBilling: u.subscription?.currentPeriodEnd
              ? new Date(u.subscription.currentPeriodEnd).toLocaleDateString('en-US')
              : '—',
          }));
          setSubscriptions(mappedSubs);

          // Get users who are in failed / past_due status
          const failed = data.users
            .filter((u: any) => u.subscription?.status === 'past_due' || u.subscription?.status === 'failed')
            .map((u: any) => ({
              id: u._id,
              name: u.name || u.email.split('@')[0],
              email: u.email,
              date: u.updatedAt ? new Date(u.updatedAt).toLocaleDateString('en-US') : 'Recently',
            }));
          setFailedPaymentsList(failed);
        } else {
          throw new Error('Failed to load users');
        }
      } catch (err) {
        console.error('Failed to load subscription metrics:', err);
        // Fail gracefully back to mock data
        setSubscriptions(MOCK_SUBS);
        setFailedPaymentsList([
          { id: '4', name: 'James Wilson', email: 'j.wilson@corp.net', date: '2024-01-20' },
          { id: '5', name: 'Robert Kim', email: 'r.kim@studio.io', date: '2024-01-19' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchRevenueAndSubs();
  }, []);

  const maxRevenue = Math.max(...revenue.chartData.map(d => d.revenue));

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const handleGrantPro = async () => {
    if (!manualEmail) return;
    try {
      // Step 1: Search for the user by email
      const searchRes = await fetch(`${RAILWAY_API}/admin/users?search=${encodeURIComponent(manualEmail)}&limit=1`, {
        headers: { 'x-admin-key': ADMIN_KEY },
      });
      if (!searchRes.ok) throw new Error('Search failed');
      const searchData = await searchRes.json();
      
      const user = searchData.users?.[0];
      if (!user || user.email.toLowerCase() !== manualEmail.toLowerCase()) {
        showToast('User with this email not found', 'error');
        return;
      }

      // Step 2: PATCH the user's plan to pro
      const updateRes = await fetch(`${RAILWAY_API}/admin/users/${user._id}/plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY,
        },
        body: JSON.stringify({ plan: 'pro', status: 'active' }),
      });

      if (updateRes.ok) {
        showToast(`Pro access granted to ${user.name || manualEmail}`);
        setManualEmail('');
        
        // Refresh active subscriptions count locally if possible
        setRevenue(prev => ({
          ...prev,
          activeSubscriptions: prev.activeSubscriptions + 1,
          mrr: prev.mrr + 12.99
        }));
      } else {
        throw new Error('Upgrade failed');
      }
    } catch {
      showToast('Failed to grant access', 'error');
    }
  };


  const handleSendReminder = async (email: string) => {
    try {
      const res = await fetch('/api/email/send-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: email,
          subject: 'Action Required - Payment Failed',
          template: 'payment_failed',
        }),
      });
      if (res.ok) showToast(`Payment reminder sent to ${email}`);
      else throw new Error();
    } catch {
      showToast('Failed to send reminder', 'error');
    }
  };

  const getSubStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-surface-variant text-on-surface-variant';
      case 'failed': return 'bg-error-container text-error';
      default: return 'bg-surface-variant text-outline';
    }
  };

  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-[14px] font-medium text-white animate-slide-up ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Monthly Revenue', value: formatCurrency(revenue.mrr), icon: 'payments', color: 'text-primary', bg: 'bg-primary/10', span: 'lg:col-span-2', dark: true },
          { label: 'Paddle Revenue', value: formatCurrency(revenue.paddle.total), icon: 'credit_card', color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Flutterwave', value: formatCurrency(revenue.flutterwave.total), icon: 'account_balance', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Active Subs', value: new Intl.NumberFormat().format(revenue.activeSubscriptions), icon: 'verified', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Cancelled', value: revenue.cancelledThisMonth, icon: 'cancel', color: 'text-[#914800]', bg: 'bg-[#ffdcc6]' },
          { label: 'Failed Payments', value: revenue.failedPayments, icon: 'error', color: 'text-error', bg: 'bg-error-container' },
        ].map(({ label, value, icon, color, bg, span, dark }) => (
          <div
            key={label}
            className={`${span || ''} ${dark ? 'bg-[#2f3038] text-white' : 'bg-surface-container-lowest border border-white/80'} p-5 rounded-2xl soft-shadow card-hover`}
          >
            <div className={`w-9 h-9 rounded-xl ${dark ? 'bg-primary/20' : bg} ${dark ? 'text-[#dfe0ff]' : color} flex items-center justify-center mb-3`}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
            </div>
            <p className={`text-[11px] uppercase tracking-wider mb-0.5 ${dark ? 'text-[#757686]' : 'text-outline'}`}>{label}</p>
            <p className={`text-[22px] font-bold font-geist ${dark ? 'text-white' : 'text-on-surface'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-surface-container-lowest rounded-2xl p-8 soft-shadow border border-white/80">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-[18px] font-semibold font-geist text-on-surface">Revenue — Last 6 Months</h3>
            <p className="text-[12px] text-outline mt-0.5">Monthly recurring revenue breakdown</p>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <span className="flex items-center gap-1.5 text-outline"><span className="w-3 h-3 rounded-full bg-primary inline-block" /> Paddle</span>
            <span className="flex items-center gap-1.5 text-outline"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Flutterwave</span>
          </div>
        </div>
        <div className="h-[200px] flex items-end justify-between gap-3 px-2">
          {revenue.chartData.map(({ month, revenue: rev }) => (
            <div key={month} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-[11px] text-outline">{formatCurrency(rev)}</span>
              <div className="w-full flex gap-1 items-end">
                <div
                  className="flex-1 bg-primary rounded-t-lg hover:brightness-110 transition-all cursor-pointer"
                  style={{ height: `${(rev * 0.67 / maxRevenue) * 160}px` }}
                  title={`Paddle: ${formatCurrency(rev * 0.67)}`}
                />
                <div
                  className="flex-1 bg-emerald-500 rounded-t-lg hover:brightness-110 transition-all cursor-pointer"
                  style={{ height: `${(rev * 0.33 / maxRevenue) * 160}px` }}
                  title={`Flutterwave: ${formatCurrency(rev * 0.33)}`}
                />
              </div>
              <span className="text-[11px] text-outline">{month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-surface-container-lowest rounded-2xl soft-shadow border border-white/80 overflow-hidden">
        <div className="px-6 py-5 border-b border-outline-variant">
          <h3 className="text-[18px] font-semibold font-geist text-on-surface">Active Subscriptions</h3>
          <p className="text-[12px] text-outline mt-0.5">Manage all paid subscriptions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {['User', 'Plan', 'Provider', 'Amount', 'Status', 'Next Billing', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-6 py-3 text-[12px] font-bold text-outline uppercase tracking-wider ${i === 6 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {subscriptions.map(sub => (
                <tr key={sub._id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                        {getUserInitials(sub.name)}
                      </div>
                      <div>
                        <p className="font-medium text-on-surface text-[13px]">{sub.name}</p>
                        <p className="text-outline text-[11px]">{sub.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[11px] font-bold uppercase">{sub.plan}</span>
                  </td>
                  <td className="px-6 py-4 text-[14px] text-on-surface-variant">{sub.provider}</td>
                  <td className="px-6 py-4 text-[14px] font-medium text-on-surface">${sub.amount}/mo</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${getSubStatusStyle(sub.status)}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-outline">{sub.nextBilling}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1 text-outline">
                      <button className="p-1.5 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Edit">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                      </button>
                      {sub.status === 'failed' && (
                        <button
                          onClick={() => handleSendReminder(sub.email)}
                          className="p-1.5 hover:text-[#914800] hover:bg-[#ffdcc6]/30 rounded-lg transition-colors"
                          title="Send payment reminder"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>mail</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Row: Failed Payments + Manual Override */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failed Payments */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 soft-shadow border border-white/80">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-error-container flex items-center justify-center text-error">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>error</span>
            </div>
            <div>
              <h3 className="text-[16px] font-semibold font-geist text-on-surface">Failed Payments</h3>
              <p className="text-[12px] text-outline">{revenue.failedPayments} users need attention</p>
            </div>
          </div>
          <div className="space-y-3">
            {failedPaymentsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-outline text-[13px]">
                <span className="material-symbols-outlined mb-2" style={{ fontSize: '32px' }}>check_circle</span>
                All payments are up to date!
              </div>
            ) : (
              failedPaymentsList.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-error-container/20 rounded-xl border border-error-container">
                  <div>
                    <p className="font-medium text-on-surface text-[13px]">{u.name}</p>
                    <p className="text-[11px] text-outline">{u.email} · Failed {u.date}</p>
                  </div>
                  <button
                    onClick={() => handleSendReminder(u.email)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error text-on-error text-[12px] font-medium hover:brightness-110 transition-all"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>mail</span>
                    Remind
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Manual Override */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 soft-shadow border border-white/80">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>stars</span>
            </div>
            <div>
              <h3 className="text-[16px] font-semibold font-geist text-on-surface">Grant Pro Access</h3>
              <p className="text-[12px] text-outline">Manually upgrade for influencers or promos</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-medium text-on-surface-variant block mb-1.5">User Email</label>
              <input
                value={manualEmail}
                onChange={e => setManualEmail(e.target.value)}
                placeholder="user@example.com"
                type="email"
                className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-bright text-[14px] text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button
              onClick={handleGrantPro}
              disabled={!manualEmail}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-[14px] font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>stars</span>
              Grant Pro Access
            </button>
            <p className="text-[11px] text-outline text-center">This will activate Pro features immediately for the user</p>
          </div>
        </div>
      </div>
    </div>
  );
}
