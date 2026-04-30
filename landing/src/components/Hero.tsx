'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';

const Hero = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      setEmail('');
    }
  };

  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              v1.0 is now live
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold text-primary leading-[1.1] mb-6 tracking-tight">
              Your Meetings.<br />
              <span className="text-accent">Transcribed.</span><br />
              Summarized. Done.
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-xl">
              Memovoice listens during your physical meetings and automatically generates transcripts, summaries and action items using AI. No bots. No Zoom required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <a 
                href="#download" 
                className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-4 rounded-2xl font-bold text-lg hover:scale-[1.02] transition-all shadow-xl shadow-primary/20 active:scale-95"
              >
                <Download className="w-5 h-5" />
                Download on Android
              </a>
              
              <form onSubmit={handleSubmit} className="flex-1 max-w-sm flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="email"
                    placeholder="Join the waitlist..."
                    className="w-full h-full px-5 py-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-gray-600"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  {submitted && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -bottom-8 left-0 text-sm font-medium text-green-600"
                    >
                      You&apos;re on the list! 🎉
                    </motion.div>
                  )}
                </div>
                <button 
                  type="submit"
                  className="bg-accent/10 text-accent border border-accent/20 px-6 py-4 rounded-2xl font-bold hover:bg-accent/20 transition-all active:scale-95"
                >
                  Join
                </button>
              </form>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-gray-200" />
                ))}
              </div>
              <p className="text-sm text-gray-500 font-medium">
                Trusted by <span className="text-primary font-bold">1,200+</span> professionals
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
            <div className="relative w-[320px] h-[640px] mx-auto bg-primary rounded-[48px] p-4 shadow-[0_50px_100px_-20px_rgba(15,28,63,0.3)] border-[8px] border-[#1a2b5e]">
              {/* Screen */}
              <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative flex flex-col">
                {/* App Header */}
                <div className="px-6 pt-10 pb-6 border-b border-gray-50 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold text-accent tracking-widest mb-1">RECORDING</p>
                    <h3 className="text-lg font-bold text-primary">Board Meeting</h3>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100" />
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
                <div className="px-6 py-8 bg-gray-50/50 rounded-t-[32px]">
                  <div className="flex items-start gap-3 mb-6 opacity-40">
                    <div className="w-6 h-6 rounded bg-gray-200" />
                    <div className="flex-1 h-3 bg-gray-200 rounded" />
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
