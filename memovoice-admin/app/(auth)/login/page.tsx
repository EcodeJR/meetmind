'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8] p-4 font-inter">
      {/* Login Card */}
      <main className="w-full max-w-[400px] bg-surface-container-lowest rounded-2xl p-8 soft-shadow animate-slide-up">
        {/* Header */}
        <header className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="material-symbols-outlined text-primary"
              style={{
                fontSize: '32px',
                fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24",
              }}
            >
              mic
            </span>
            <h1 className="text-[24px] leading-8 font-black font-geist text-on-surface tracking-tight">
              Memovoice
            </h1>
          </div>
          <p className="text-[14px] text-outline">Admin Dashboard</p>
        </header>

        {/* Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Email */}
          <div className="space-y-1.5">
            <label
              className="text-[12px] font-medium text-on-surface-variant"
              htmlFor="email"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="admin@memovoice.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-4 rounded-lg border border-outline-variant bg-surface-bright text-[14px] text-on-surface placeholder:text-outline/50 outline-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label
                className="text-[12px] font-medium text-on-surface-variant"
                htmlFor="password"
              >
                Password
              </label>
              <a href="#" className="text-[12px] text-primary hover:underline transition-all">
                Forgot Password?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 pr-11 rounded-lg border border-outline-variant bg-surface-bright text-[14px] text-on-surface placeholder:text-outline/50 outline-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-[12px] text-error bg-error-container px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary-container text-on-primary-container text-[18px] font-semibold font-geist rounded-lg shadow-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span
                  className="material-symbols-outlined animate-spin"
                  style={{ fontSize: '20px' }}
                >
                  progress_activity
                </span>
                Signing in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        {/* Footer */}
        <footer className="mt-10 pt-8 border-t border-surface-container-high text-center">
          <p className="text-[12px] text-outline mb-4">Enterprise Grade AI Transcription</p>
          <div className="flex justify-center gap-3">
            {['lock', 'shield', 'verified_user'].map((icon) => (
              <div
                key={icon}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-outline/60 hover:text-primary hover:bg-primary/5 transition-all duration-300"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {icon}
                </span>
              </div>
            ))}
          </div>
        </footer>
      </main>
    </div>
  );
}
