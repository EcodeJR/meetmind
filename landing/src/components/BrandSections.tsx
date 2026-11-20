'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Users,
  FileCheck,
  Check,
  Plus,
  Minus,
  Mail,
  Linkedin,
  Twitter,
  Instagram
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export const HowItWorks = () => (
  <section id="how-it-works" className="py-24 bg-white text-black overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">HOW IT WORKS</p>
        <h2 className="text-4xl lg:text-5xl font-black mb-6 tracking-[-0.05em]">From conversation to clear next steps</h2>
        <p className="text-black/60 max-w-2xl mx-auto text-lg leading-relaxed">Record when your meeting begins. Memovoice takes care of the notes after it ends.</p>
      </div>

      <div className="relative">
        {/* Connection Line */}
        <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-black/10 -translate-y-1/2 z-0" />

        <div className="grid lg:grid-cols-3 gap-12 relative z-10">
          {[
            {
              step: "01",
              title: "Tap Record",
              desc: "Start recording in one tap. No bot or meeting link is needed.",
              icon: <Mic className="w-8 h-8" />
            },
            {
              step: "02",
              title: "Have the meeting",
              desc: "Keep the app recording in the background while you focus on people in the room.",
              icon: <Users className="w-8 h-8" />
            },
            {
              step: "03",
              title: "Review what matters",
              desc: "When processing is done, see the transcript, summary, decisions, and tasks.",
              icon: <FileCheck className="w-8 h-8" />
            }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="flex flex-col items-center text-center group"
            >
              <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center mb-8 border border-black/10 text-black group-hover:bg-black group-hover:text-white group-hover:border-black transition-all duration-500">
                {item.icon}
              </div>
              <span className="text-black font-bold text-xs tracking-[0.3em] mb-4 uppercase">STEP {item.step}</span>
              <h3 className="text-2xl font-black mb-4 leading-tight tracking-tight">{item.title}</h3>
              <p className="text-black/60 leading-relaxed max-w-xs text-sm">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export const Pricing = () => (
  <section id="pricing" className="py-32 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">PRICING</p>
        <h2 className="text-4xl lg:text-5xl font-black text-black mb-6 tracking-[-0.05em]">Simple, transparent pricing</h2>
        <p className="text-black/60 text-lg leading-relaxed">Start free. Upgrade when you need more room.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Free Plan */}
        <div className="p-8 rounded-[28px] bg-white border border-black/10 hover:border-black/25 transition-all duration-300 shadow-[0_12px_34px_rgba(0,0,0,0.03)]">
          <p className="text-xs font-bold text-black/40 mb-4 uppercase tracking-[0.3em]">Free Plan</p>
          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-5xl font-black text-black">$0</span>
            <span className="text-black/40 font-light">/month</span>
          </div>

          <ul className="space-y-4 mb-10">
            {['5 meetings per month', 'Up to 30 minutes per meeting', 'Basic summary only', '7-day history'].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-black/70 text-sm">
                <Check className="w-5 h-5 text-black flex-shrink-0" />
                {item}
              </li>
            ))}
            <li className="flex items-center gap-3 text-black/40 text-sm">
              <Minus className="w-5 h-5 text-black/20 flex-shrink-0" />
              No action items or export
            </li>
          </ul>

          <Link href="#download" className="block text-center py-4 rounded-full border border-black/10 text-black font-bold hover:bg-black hover:text-white transition-all uppercase tracking-[0.2em] text-sm">
            Get Started Free
          </Link>
        </div>

        {/* Pro Plan */}
        <div className="p-8 rounded-[28px] bg-black border border-black transition-all duration-300 relative overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.1)]">
          <div className="absolute top-4 right-4 bg-white text-black px-3 py-1 rounded-full text-xs font-black tracking-[0.2em] uppercase">Most Popular</div>

          <p className="text-xs font-bold text-white mb-4 uppercase tracking-[0.3em]">Pro Plan</p>
          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-5xl font-black text-white">$12</span>
            <span className="text-white/40 font-light">/month</span>
          </div>

          <ul className="space-y-4 mb-10">
            {[
              'Unlimited meetings',
              'Full transcripts',
              'Action item extraction',
              'Export to PDF and email',
              'Unlimited history'
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-white/75 font-medium text-sm">
                <Check className="w-5 h-5 text-white flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <Link href="#download" className="block text-center py-4 rounded-full bg-white text-black font-black hover:bg-white/90 transition-all uppercase tracking-[0.2em] text-sm">
            Start Pro
          </Link>
        </div>
      </div>
    </div>
  </section>
);

export const Testimonials = () => (
  <section className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">TESTIMONIALS</p>
        <h2 className="text-4xl lg:text-5xl font-black text-black mb-4 tracking-[-0.05em]">What professionals are saying</h2>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {[
          {
            name: "Sarah Chen",
            role: "Product Manager at TechFlow",
            quote: "Memovoice has completely changed how I run meetings. I can finally be 100% present without worrying about capturing every detail."
          },
          {
            name: "Dr. Marcus Thorne",
            role: "Consultant Physician",
            quote: "The accuracy of the medical terminology transcription is impressive. It saves me hours of charting every single day."
          },
          {
            name: "Elena Rodriguez",
            role: "Creative Director",
            quote: "Action item extraction is a lifesaver. My team knows exactly what to do the moment the meeting ends. It's seamless."
          }
        ].map((t, i) => (
          <div key={i} className="p-6 rounded-[28px] bg-white border border-black/10 hover:border-black/25 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-black/5 border border-black/10" />
              <div>
                <p className="font-bold text-black text-sm">{t.name}</p>
                <p className="text-xs text-black/40">{t.role}</p>
              </div>
            </div>
            <p className="text-black/60 italic leading-relaxed text-sm">&quot;{t.quote}&quot;</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: "Does Memovoice work without internet?", a: "Yes. You can record meetings without internet. The recording stays on your device and is processed when you are online again." },
    { q: "How accurate is the transcription?", a: "Memovoice uses multiple AI providers to improve reliability. Accuracy depends on audio quality, speakers, accents, background noise, and language, so always review important details." },
    { q: "What control do I have over my meeting data?", a: "You can choose a retention period, export meetings you need, and delete your account from the app settings. Read our Privacy Policy for the full details." },
    { q: "What languages are supported?", a: "Memovoice supports English, Spanish, French, German, and Portuguese. Results can vary with recording quality, accents, and technical vocabulary." },
    { q: "Can I use Memovoice on iPhone?", a: "Memovoice is available on Android. Join the iOS waitlist and we will let you know when it is ready." },
    { q: "Can I use Memovoice with my team?", a: "Yes. Create a workspace, invite members by email, and share workspace meetings, comments, and tasks." },
    { q: "How do I cancel my subscription?", a: "You can cancel any time directly through the app settings. Your Pro features will remain active until the end of your billing cycle." }
  ];

  return (
    <section className="py-24 max-w-3xl mx-auto px-4 bg-white">
      <div className="text-center mb-16">
        <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">FAQ</p>
        <h2 className="text-4xl lg:text-5xl font-black text-black mb-4 tracking-[-0.05em]">Frequently asked questions</h2>
      </div>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="border border-black/10 rounded-[24px] bg-white overflow-hidden hover:border-black/25 transition-all">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full p-6 text-left flex justify-between items-center hover:bg-black/[0.03] transition-colors"
            >
              <span className="font-bold text-black text-sm">{faq.q}</span>
              {openIndex === i ? <Minus className="w-5 h-5 text-black flex-shrink-0" /> : <Plus className="w-5 h-5 text-black/30 flex-shrink-0" />}
            </button>
            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 pb-6 text-black/60 leading-relaxed text-sm border-t border-black/10"
                >
                  {faq.a}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
};

export const FinalCTA = () => {
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
        setMessage(data.message || "Welcome to the future of meetings! Check your inbox soon. 🎉");
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
    <section id="waitlist" className="py-32 bg-white text-center border-t border-black/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-bold text-accent uppercase tracking-widest mb-6">GET EARLY ACCESS</p>
        <h2 className="text-5xl lg:text-6xl font-black text-black mb-6 tracking-[-0.06em] leading-tight">Spend less time taking notes</h2>
        <p className="text-black/60 text-lg mb-12 max-w-2xl mx-auto leading-relaxed">Get the Android app today, or join the waitlist to hear when Memovoice comes to iPhone.</p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-6">
          <input
            type="email"
            placeholder="Enter your professional email"
            className="flex-1 px-6 py-4 rounded-full bg-white border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all text-black placeholder-black/30 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-black text-white px-8 py-4 rounded-full font-black hover:bg-black/90 transition-all active:scale-95 uppercase tracking-[0.2em] text-sm whitespace-nowrap disabled:opacity-50"
          >
            {submitting ? 'Joining...' : 'Join Waitlist'}
          </button>
        </form>
        {message && (
          <p className={`font-bold mb-4 text-sm ${submitted ? 'text-black' : 'text-black/60'}`}>{message}</p>
        )}
        <p className="text-black/40 text-xs">Free to start. No credit card required.</p>
      </div>
    </section>
  );
};

export const Footer = () => (
  <footer className="py-20 bg-white border-t border-black/10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid md:grid-cols-4 gap-12 mb-16">
        <div className="col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <Image src="/logo.jpeg" alt="Memovoice" width={32} height={32} className="h-8 w-auto rounded-md" />
            <span className="text-xl font-black text-black tracking-tight uppercase">Memovoice</span>
          </div>
          <p className="text-black/60 max-w-sm mb-8 leading-relaxed text-sm">
            Turn in-person conversations into meeting notes, summaries, and next steps you can use.
          </p>
          <div className="flex gap-4">
            {/* Twitter */}
            <a href="https://x.com/memovoice182704" target="_blank" rel="noopener noreferrer" title="Follow us on X" className="w-10 h-10 rounded-full bg-white border border-black/10 flex items-center justify-center text-black/50 hover:text-black hover:border-black/30 hover:bg-black/[0.03] transition-all cursor-pointer">
              <Twitter className="w-5 h-5" />
            </a>

            {/* LinkedIn - Coming Soon */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white border border-black/10 flex items-center justify-center text-black/25 cursor-not-allowed opacity-50" title="LinkedIn - Coming Soon">
                <Linkedin className="w-5 h-5" />
              </div>
              {/* <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm border border-white/20 rounded px-2 py-1 whitespace-nowrap text-xs text-white/60 font-medium">Coming Soon</div> */}
            </div>

            {/* Instagram - Coming Soon */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white border border-black/10 flex items-center justify-center text-black/25 cursor-not-allowed opacity-50" title="Instagram - Coming Soon">
                <Instagram className="w-5 h-5" />
              </div>
              {/* <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm border border-white/20 rounded px-2 py-1 whitespace-nowrap text-xs text-white/60 font-medium">Coming Soon</div> */}
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-black mb-6 text-sm uppercase tracking-[0.2em]">Product</h4>
          <ul className="space-y-4 text-black/55 text-xs">
            <li><Link href="/#features" className="hover:text-black transition-colors uppercase tracking-[0.2em] font-medium">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-black transition-colors uppercase tracking-[0.2em] font-medium">Pricing</Link></li>
            <li><Link href="/privacy" className="hover:text-black transition-colors uppercase tracking-[0.2em] font-medium">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-black transition-colors uppercase tracking-[0.2em] font-medium">Terms of Service</Link></li>
            <li><Link href="/refunds" className="hover:text-black transition-colors uppercase tracking-[0.2em] font-medium">Refund Policy</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-black mb-6 text-sm uppercase tracking-[0.2em]">Contact</h4>
          <ul className="space-y-4 text-black/55 text-xs">
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <a href="mailto:memovoiceio@gmail.com" className="hover:text-black transition-colors uppercase tracking-[0.2em] font-medium">memovoiceio@gmail.com</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="pt-8 border-t border-black/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs text-black/35">© 2026 Memovoice. All rights reserved.</p>
        <p className="text-xs text-black/35">Built for better follow-through.</p>
      </div>
    </div>
  </footer>
);

