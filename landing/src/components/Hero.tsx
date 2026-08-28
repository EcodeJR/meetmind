'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

const imageMap: { [key: string]: string } = {
  'Capture': '/images/Phone-recording-screen-one.jpg',
  'Read': '/images/Phone-meeting-summary.jpg',
  'Act': '/images/Phone-meeting-key-notes.jpg',
};

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://memovoice.onrender.com/api';
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
    } catch {
      setMessage('Failed to connect to waitlist service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 overflow-hidden bg-white">
      <div className="absolute inset-0 z-0">
        <Image src="/images/hero-desktop.jfif" alt="" fill className="object-cover opacity-[0.04]" priority />
      </div>
      <div className="absolute inset-x-0 top-0 h-px bg-black/10" />
      <div className="absolute inset-y-0 right-0 w-[40rem] bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.04),transparent_60%)] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 text-black text-xs font-bold mb-8 uppercase tracking-[0.3em] bg-white">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-20"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
              </span>
              Android app live, iOS coming soon
            </div>

            <h1 className="max-w-3xl text-5xl sm:text-6xl lg:text-7xl font-black text-black leading-[0.95] mb-8 tracking-[-0.06em]">
              Meetings, captured with editorial clarity.
            </h1>

            <p className="text-lg sm:text-xl text-black/65 mb-10 leading-relaxed max-w-2xl font-light">
              Memovoice records in the background, then turns every discussion into a clean transcript, a readable summary, and clear next steps. No bots. No Zoom required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <a
                href="https://github.com/EcodeJR/meetmind/releases/download/v1.2.0/application-d901fa13-2531-4317-8900-26fbea054e60.apk"
                className="inline-flex items-center justify-center gap-3 bg-black text-white px-8 py-4 rounded-full font-bold text-base hover:bg-black/90 transition-all active:scale-95 uppercase tracking-[0.2em] w-full sm:w-auto"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.5 12c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5m-11 0c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5m11.55-4.8l1.8-3.1a.488.488 0 00-.18-.67c-.24-.13-.54-.05-.67.18l-1.83 3.17C15.65 6.28 13.89 6 12 6c-1.89 0-3.65.28-5.37.78L4.8 3.61c-.13-.23-.43-.31-.67-.18a.488.488 0 00-.18.67l1.8 3.1C2.92 8.78 1 11.16 1 14h22c0-2.84-1.92-5.22-4.75-6.8z" />
                </svg>
                Download for Android
              </a>

              <div
                className="inline-flex items-center justify-center gap-3 bg-white border border-black/10 text-black px-8 py-4 rounded-full font-bold text-base cursor-not-allowed uppercase tracking-[0.2em] w-full sm:w-auto relative group overflow-hidden"
                title="iOS App Coming Soon!"
              >
                <svg className="w-5 h-5 opacity-40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.2.67-2.92 1.5-.62.72-1.16 1.87-1.01 2.98 1.1.09 2.24-.59 2.94-1.42z" />
                </svg>
                <span>Download for iOS</span>
                <span className="absolute top-1 right-2 bg-black text-white font-black tracking-[0.2em] text-[8px] px-1.5 py-0.5 rounded-full uppercase">Soon</span>
              </div>
            </div>

            <div className="bg-white border border-black/10 p-6 rounded-3xl max-w-lg mb-12 shadow-[0_12px_40px_rgba(0,0,0,0.05)] mx-auto">
              <p className="text-xs font-bold text-black/50 mb-3 uppercase tracking-[0.25em] flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-20"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
                </span>
                Get notified when iOS is released:
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 relative">
                <div className="relative flex-1">
                  <input
                    type="email"
                    placeholder="Enter email for iOS Waitlist..."
                    className="w-full px-5 py-4 rounded-full border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all text-black placeholder-black/35 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                  />
                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`absolute -bottom-6 left-0 text-[10px] font-bold ${submitted ? 'text-black' : 'text-black/60'}`}
                    >
                      {message}
                    </motion.div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-black text-white px-6 py-4 rounded-full font-bold hover:bg-black/90 transition-all active:scale-95 text-sm uppercase tracking-[0.2em] disabled:opacity-50 whitespace-nowrap"
                >
                  {submitting ? 'Joining...' : 'Join Waitlist'}
                </button>
              </form>
            </div>

            {/* <div className="flex items-center gap-6 pt-8 border-t border-black/10">
              <div className="flex -space-x-3">
                {[32, 44, 55, 68].map((id) => (
                  <img
                    key={id}
                    src={`https://randomuser.me/api/portraits/men/${id}.jpg`}
                    alt="Professional"
                    className="w-10 h-10 rounded-full border-2 border-white object-cover bg-neutral-200"
                  />
                ))}
              </div>
              <p className="text-sm text-black/55 font-medium">
                Trusted by <span className="text-black font-bold">1,200+</span> professionals
              </p>
            </div> */}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateY: 20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="flex gap-5">
              {[
                { label: 'Capture', title: 'Record the room', copy: 'One tap to start recording without bots or setup.', tone: 'bg-black text-white' },
                { label: 'Read', title: 'See the transcript', copy: 'Clean transcript layouts with speaker-aware blocks.', tone: 'bg-white text-black border border-black/10' },
                { label: 'Act', title: 'Turn notes into work', copy: 'Summaries and actions packaged in a calm, readable layout.', tone: 'bg-black text-white' },
              ].map((panel, index) => (
                <motion.div
                  key={panel.label}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 + index * 0.08 }}
                  className={`${panel.tone} rounded-[28px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.08)]`}
                >
                  <div className="rounded-[22px] overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                    <Image
                      src={imageMap[panel.label]}
                      alt={panel.title}
                      width={640}
                      height={420}
                      className="w-full h-[180px] sm:h-[220px] md:h-[260px] lg:h-[300px] xl:h-[340px] 2xl:h-[380px] object-contain transition-all duration-300"
                    />
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">{panel.label}</p>
                      <h3 className="text-2xl font-black tracking-[-0.04em] mt-2">{panel.title}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-current/15 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed opacity-75">{panel.copy}</p>
                </motion.div>
              ))}
            </div>
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-black/5 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

