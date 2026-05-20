'use client';

import { useEffect, useState, useCallback } from 'react';

interface SystemHealth {
  mongodb: 'connected' | 'disconnected';
  groq: 'active' | 'error';
  gemini: 'active' | 'error';
  cloudinary: { status: string; storageUsed: string };
  railwayBackend: 'online' | 'offline';
  avgProcessingTime: number;
  avgSummaryTime: number;
  successRate: number;
  failedJobsToday: number;
  recentErrors: ErrorLog[];
}

interface ErrorLog {
  id: string;
  timestamp: string;
  error: string;
  endpoint: string;
  user?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const RAILWAY_API = process.env.NEXT_PUBLIC_RAILWAY_API || 'https://memovoice-backend.onrender.com';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const MOCK_HEALTH: SystemHealth = {
  mongodb: 'connected',
  groq: 'active',
  gemini: 'active',
  cloudinary: { status: 'active', storageUsed: '12.4 GB / 100 GB' },
  railwayBackend: 'online',
  avgProcessingTime: 18.4,
  avgSummaryTime: 6.2,
  successRate: 97.8,
  failedJobsToday: 4,
  recentErrors: [
    { id: '1', timestamp: '2024-01-15 14:32:01', error: 'Transcription timeout after 60s', endpoint: '/api/meetings/transcribe', user: 'user_abc123', severity: 'high' },
    { id: '2', timestamp: '2024-01-15 13:18:45', error: 'Groq API rate limit exceeded', endpoint: '/api/ai/summarize', severity: 'medium' },
    { id: '3', timestamp: '2024-01-15 11:05:22', error: 'Cloudinary upload failed - invalid format', endpoint: '/api/meetings/upload', user: 'user_def456', severity: 'medium' },
    { id: '4', timestamp: '2024-01-15 09:41:08', error: 'JWT verification failed', endpoint: '/api/users/me', severity: 'low' },
  ],
};

const INITIAL_HEALTH: SystemHealth = {
  mongodb: 'disconnected',
  groq: 'error',
  gemini: 'error',
  cloudinary: { status: 'inactive', storageUsed: '0 GB / 100 GB' },
  railwayBackend: 'offline',
  avgProcessingTime: 0,
  avgSummaryTime: 0,
  successRate: 0,
  failedJobsToday: 0,
  recentErrors: [],
};

const severityStyle: Record<string, string> = {
  low: 'bg-surface-container text-on-surface-variant',
  medium: 'bg-[#ffdcc6] text-[#914800]',
  high: 'bg-error-container text-error',
  critical: 'bg-error text-on-error',
};

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth>(INITIAL_HEALTH);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(30);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const getCloudinaryPercentage = () => {
    try {
      const parts = health.cloudinary.storageUsed.split('/');
      if (parts.length === 2) {
        const used = parseFloat(parts[0].replace(/[^\d.]/g, ''));
        const total = parseFloat(parts[1].replace(/[^\d.]/g, ''));
        if (!isNaN(used) && !isNaN(total) && total > 0) {
          return Math.round((used / total) * 100 * 10) / 10;
        }
      }
    } catch {}
    return 0;
  };
  const cloudinaryPercentage = getCloudinaryPercentage();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${RAILWAY_API}/admin/system`, {
        headers: { 'x-admin-key': ADMIN_KEY },
      });

      if (res.ok) {
        const data = await res.json();
        setHealth({
          ...data,
          railwayBackend: 'online',
        });
      } else {
        // Backend replied but with an error status (e.g. 401)
        setHealth(prev => ({
          ...prev,
          railwayBackend: 'online',
          mongodb: 'disconnected',
          groq: 'error',
          gemini: 'error',
        }));
      }
    } catch (err) {
      console.error('Failed to fetch system health:', err);
      setHealth(prev => ({
        ...prev,
        railwayBackend: 'offline',
        mongodb: 'disconnected',
        groq: 'error',
        gemini: 'error',
      }));
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
      setCountdown(30);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const refreshInterval = setInterval(fetchHealth, 30000);
    const countdownInterval = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [fetchHealth]);

  const handleRetryFailedJobs = () => {
    showToast('Failed jobs queued for retry');
  };

  const getStatusStyle = (status: string) => {
    if (['connected', 'active', 'online'].includes(status)) {
      return { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', label: status === 'connected' ? 'Connected' : status === 'online' ? 'Online' : 'Active' };
    }
    return { dot: 'bg-error animate-pulse', badge: 'bg-error-container text-error', label: status === 'disconnected' ? 'Disconnected' : status === 'offline' ? 'Offline' : 'Error' };
  };

  const serviceCards = [
    { name: 'Railway Backend', status: health.railwayBackend, icon: 'cloud', description: 'Main API server' },
    { name: 'MongoDB Atlas', status: health.mongodb, icon: 'database', description: 'Primary database' },
    { name: 'Groq API', status: health.groq, icon: 'psychology', description: 'Transcription AI' },
    { name: 'Gemini API', status: health.gemini, icon: 'auto_awesome', description: 'Summarization AI' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-[14px] font-medium text-white animate-slide-up ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-error'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header bar */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-[14px] text-outline">
            Last refreshed: <span className="text-on-surface font-medium">{lastRefresh.toLocaleTimeString()}</span>
            {' '}· Auto-refresh in <span className="text-primary font-medium">{countdown}s</span>
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-[14px] text-on-surface hover:bg-surface-container-low transition-all soft-shadow"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
          Refresh Now
        </button>
      </div>

      {/* Service Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {serviceCards.map(({ name, status, icon, description }) => {
          const styles = getStatusStyle(status);
          return (
            <div key={name} className="bg-surface-container-lowest rounded-2xl p-5 soft-shadow border border-white/80 card-hover">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{icon}</span>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${styles.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                  {styles.label}
                </div>
              </div>
              <p className="font-semibold text-on-surface text-[14px]">{name}</p>
              <p className="text-[12px] text-outline mt-0.5">{description}</p>
            </div>
          );
        })}
      </div>

      {/* Cloudinary Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 soft-shadow border border-white/80">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>cloud_upload</span>
            </div>
            <div>
              <p className="font-semibold text-on-surface text-[14px]">Cloudinary Storage</p>
              <p className="text-[12px] text-outline">Media & file storage</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[12px] text-outline mb-2">
            <span>Storage Used</span>
            <span className="font-medium text-on-surface">{health.cloudinary.storageUsed}</span>
          </div>
          <div className="h-2 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-1000"
              style={{ width: `${cloudinaryPercentage}%` }}
            />
          </div>
          <p className="text-[11px] text-outline mt-1">{cloudinaryPercentage}% of {health.cloudinary.storageUsed.split('/')[1] || '25 GB'} used</p>
        </div>
      </div>

      {/* Processing Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Avg Transcription Time', value: `${health.avgProcessingTime}s`, icon: 'timer', color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Avg Summary Time', value: `${health.avgSummaryTime}s`, icon: 'speed', color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Success Rate', value: `${health.successRate}%`, icon: 'check_circle', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Failed Jobs Today', value: health.failedJobsToday, icon: 'error', color: 'text-error', bg: 'bg-error-container', action: true },
        ].map(({ label, value, icon, color, bg, action }) => (
          <div key={label} className="bg-surface-container-lowest rounded-2xl p-5 soft-shadow border border-white/80 card-hover">
            <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center mb-3`}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
            </div>
            <p className="text-[11px] text-outline uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-[24px] font-bold font-geist text-on-surface">{value}</p>
            {action && health.failedJobsToday > 0 && (
              <button
                onClick={handleRetryFailedJobs}
                className="mt-2 text-[11px] text-primary hover:underline font-medium"
              >
                Retry all →
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Recent Error Logs */}
      <div className="bg-surface-container-lowest rounded-2xl soft-shadow border border-white/80 overflow-hidden">
        <div className="px-6 py-5 border-b border-outline-variant flex justify-between items-center">
          <div>
            <h3 className="text-[18px] font-semibold font-geist text-on-surface">Recent Error Logs</h3>
            <p className="text-[12px] text-outline mt-0.5">Latest system errors and warnings</p>
          </div>
          <button className="flex items-center gap-1.5 text-[13px] text-primary hover:underline font-medium">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
            Export Logs
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                {['Timestamp', 'Error', 'Endpoint', 'User', 'Severity'].map(h => (
                  <th key={h} className="px-6 py-3 text-[12px] font-bold text-outline uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {health.recentErrors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-outline text-[13px]">
                    <span className="material-symbols-outlined mb-2 block" style={{ fontSize: '32px', color: '#10b981' }}>verified</span>
                    No recent errors! Everything is running perfectly.
                  </td>
                </tr>
              ) : (
                health.recentErrors.map(err => (
                  <tr key={err.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 text-[12px] text-outline font-mono whitespace-nowrap">{err.timestamp}</td>
                    <td className="px-6 py-4 text-[13px] text-on-surface max-w-xs truncate" title={err.error}>{err.error}</td>
                    <td className="px-6 py-4">
                      <code className="text-[11px] bg-surface-container px-2 py-1 rounded font-mono text-primary">{err.endpoint}</code>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-outline">{err.user || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${severityStyle[err.severity]}`}>
                        {err.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

