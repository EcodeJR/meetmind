'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';

const Hero = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setMessage('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://memovoice-backend.up.railway.app/api';
      const res = await fetch(`${apiUrl}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, platform: 'ios' }),
      });

      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        setMessage(data.message || "You're on the iOS waitlist! 🎉");
        setEmail('');
        setTimeout(() => {
          setSubmitted(false);
          setMessage('');
        }, 5000);
      } else {
        setMessage(data.error || 'Failed to join waitlist. Please try again.');
      }
    } catch (err) {
      setMessage('Failed to connect to waitlist service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-accent text-xs font-bold mb-8 uppercase tracking-widest bg-white/5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              Android App Now Live • iOS Coming Soon! 📱
            </div>

            <h1 className="text-6xl lg:text-7xl font-black text-white leading-[1.1] mb-8 tracking-tight">
              Your Meetings.<br />
              <span className="text-accent">Transcribed.</span><br />
              Summarized. Done.
            </h1>

            <p className="text-xl text-white/60 mb-12 leading-relaxed max-w-xl font-light">
              Memovoice listens during your physical meetings and automatically generates transcripts, summaries and action items using AI. No bots. No Zoom required.
            </p>

            {/* Download Buttons Section */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              {/* Android Download Button */}
              <a
                href="https://github.com/EcodeJR/meetmind/releases/download/v1.0.0/memovoice.apk"
                className="inline-flex items-center justify-center gap-3 bg-accent text-black px-8 py-4 rounded-xl font-bold text-base hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 active:scale-98 uppercase tracking-wider w-full sm:w-auto"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.5 12c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5m-11 0c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5m11.55-4.8l1.8-3.1a.488.488 0 00-.18-.67c-.24-.13-.54-.05-.67.18l-1.83 3.17C15.65 6.28 13.89 6 12 6c-1.89 0-3.65.28-5.37.78L4.8 3.61c-.13-.23-.43-.31-.67-.18a.488.488 0 00-.18.67l1.8 3.1C2.92 8.78 1 11.16 1 14h22c0-2.84-1.92-5.22-4.75-6.8z" />
                </svg>
                Download for Android
              </a>

              {/* iOS Inactive Download Button */}
              <div
                className="inline-flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white/40 px-8 py-4 rounded-xl font-bold text-base cursor-not-allowed uppercase tracking-wider w-full sm:w-auto relative group overflow-hidden"
                title="iOS App Coming Soon!"
              >
                <svg className="w-5 h-5 opacity-40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.2.67-2.92 1.5-.62.72-1.16 1.87-1.01 2.98 1.1.09 2.24-.59 2.94-1.42z" />
                </svg>
                <span>Download for iOS</span>
                <span className="absolute top-1 right-2 bg-accent/10 border border-accent/20 text-accent font-black tracking-widest text-[8px] px-1.5 py-0.5 rounded uppercase">Soon</span>
              </div>
            </div>

            {/* iOS Waitlist Form Block */}
            <div className="bg-white/[0.02] border border-white/10 p-6 rounded-2xl max-w-lg mb-12 backdrop-blur-sm">
              <p className="text-xs font-bold text-white/50 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                Get notified when iOS is released:
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 relative">
                <div className="relative flex-1">
                  <input
                    type="email"
                    placeholder="Enter email for iOS Waitlist..."
                    className="w-full px-5 py-4 rounded-xl border border-white/10 bg-black/45 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all text-white placeholder-white/40 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                  />
                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`absolute -bottom-6 left-0 text-[10px] font-bold ${submitted ? 'text-accent' : 'text-red-500'}`}
                    >
                      {message}
                    </motion.div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-accent text-black px-6 py-4 rounded-xl font-bold hover:bg-accent/90 transition-all active:scale-98 text-sm uppercase tracking-wider disabled:opacity-50 whitespace-nowrap"
                >
                  {submitting ? 'Joining...' : 'Join Waitlist'}
                </button>
              </form>
            </div>

            <div className="flex items-center gap-6 pt-8 border-t border-white/5">
              <div className="flex -space-x-3">
                {[32, 44, 55, 68].map((id) => (
                  <img 
                    key={id}
                    src={`https://randomuser.me/api/portraits/men/${id}.jpg`}
                    alt="Professional"
                    className="w-10 h-10 rounded-full border-2 border-black object-cover bg-dark-100"
                  />
                ))}
              </div>
              <p className="text-sm text-white/50 font-medium">
                Trusted by <span className="text-white font-bold">1,200+</span> professionals
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateY: 20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative perspective-1000 hidden lg:block"
          >
            {/* Phone Mockup */}
            <div className="relative w-[320px] h-[640px] mx-auto bg-dark-50 rounded-[48px] p-4 shadow-[0_50px_100px_-20px_rgba(91,110,245,0.2)] border-[8px] border-dark-100">
              {/* Screen */}
              <div className="w-full h-full bg-black rounded-[32px] overflow-hidden relative flex flex-col">
                {/* App Header */}
                <div className="px-6 pt-10 pb-6 border-b border-white/5 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold text-accent tracking-widest mb-1 uppercase">RECORDING</p>
                    <h3 className="text-lg font-bold text-white">Board Meeting</h3>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-dark-100" />
                </div>

                {/* Waveform Visualization */}
                <div className="flex-1 flex items-center justify-center gap-1.5 px-8">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: [20, 60, 30, 80, 20][(i % 5)],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1 + Math.random(),
                        ease: "easeInOut",
                      }}
                      className="w-1.5 bg-accent rounded-full opacity-60"
                    />
                  ))}
                </div>

                {/* Transcription Preview */}
                <div className="px-6 py-8 bg-dark-100/50 rounded-t-[32px]">
                  <div className="flex items-start gap-3 mb-6 opacity-30">
                    <div className="w-6 h-6 rounded bg-white/10" />
                    <div className="flex-1 h-3 bg-white/10 rounded" />
                  </div>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-6 h-6 rounded bg-accent/20" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-accent/20 rounded w-3/4" />
                      <div className="h-3 bg-accent/20 rounded w-1/2" />
                    </div>
                  </div>
                </div>

                {/* Recording Controls */}
                <div className="p-8 flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
                    <div className="w-6 h-6 rounded bg-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
