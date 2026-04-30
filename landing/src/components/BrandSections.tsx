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

export const HowItWorks = () => (
  <section id="how-it-works" className="py-24 bg-primary text-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <h2 className="text-3xl lg:text-5xl font-bold mb-6 tracking-tight">Three steps to never forget a meeting again</h2>
        <p className="text-blue-200 max-w-2xl mx-auto text-lg">Sophisticated intelligence, simplified for professionals.</p>
      </div>

      <div className="relative">
        {/* Connection Line */}
        <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-blue-900 -translate-y-1/2 z-0" />
        
        <div className="grid lg:grid-cols-3 gap-12 relative z-10">
          {[
            {
              step: "01",
              title: "Open Memovoice and tap Record",
              desc: "Instant initialization. No configuration or external bots required.",
              icon: <Mic className="w-8 h-8" />
            },
            {
              step: "02",
              title: "Have your meeting naturally",
              desc: "Memovoice captures ambient audio while you focus on the human interaction.",
              icon: <Users className="w-8 h-8" />
            },
            {
              step: "03",
              title: "Review your transcript and summary",
              desc: "Receive structured intelligence, action items, and full transcripts instantly.",
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
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-8 border-4 border-primary shadow-xl group-hover:scale-110 transition-transform duration-500">
                {item.icon}
              </div>
              <span className="text-accent font-bold text-sm tracking-widest mb-4">STEP {item.step}</span>
              <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
              <p className="text-blue-100/60 leading-relaxed max-w-xs">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export const Pricing = () => (
  <section id="pricing" className="py-32">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <h2 className="text-3xl lg:text-5xl font-bold text-primary mb-6 tracking-tight">Simple, transparent pricing</h2>
        <p className="text-gray-500 text-lg">Scalable intelligence for individuals and organizations.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Free Plan */}
        <div className="p-10 rounded-[40px] bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500">
          <h3 className="text-xl font-bold text-gray-400 mb-2">FREE PLAN</h3>
          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-4xl font-bold text-primary">$0</span>
            <span className="text-gray-400">/month</span>
          </div>
          
          <ul className="space-y-4 mb-10">
            {['5 meetings per month', 'Basic AI summary', '7 day transcript history'].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-gray-600">
                <Check className="w-5 h-5 text-green-500" />
                {item}
              </li>
            ))}
          </ul>

          <Link href="#download" className="block text-center py-4 rounded-2xl border-2 border-primary text-primary font-bold hover:bg-primary hover:text-white transition-all">
            Get Started Free
          </Link>
        </div>

        {/* Pro Plan */}
        <div className="p-10 rounded-[40px] bg-white border-2 border-accent shadow-2xl shadow-accent/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-accent text-white px-6 py-2 rounded-bl-2xl font-bold text-xs tracking-widest">MOST POPULAR</div>
          
          <h3 className="text-xl font-bold text-accent mb-2">PRO PLAN</h3>
          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-4xl font-bold text-primary">$12</span>
            <span className="text-gray-400">/month</span>
          </div>
          
          <ul className="space-y-4 mb-10">
            {[
              'Unlimited meetings', 
              'Full AI transcripts', 
              'Action item extraction', 
              'Export to PDF and email',
              'Priority processing'
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-gray-600 font-medium">
                <Check className="w-5 h-5 text-accent" />
                {item}
              </li>
            ))}
          </ul>

          <Link href="#download" className="block text-center py-4 rounded-2xl bg-accent text-white font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20">
            Start Pro
          </Link>
        </div>
      </div>
    </div>
  </section>
);

export const Testimonials = () => (
  <section className="py-24 bg-gray-50/50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-4 tracking-tight">What professionals are saying</h2>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
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
            quote: "Action item extraction is a lifesaver. My team knows exactly what to do the moment the meeting ends. It&apos;s seamless."
          }
        ].map((t, i) => (
          <div key={i} className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gray-100" />
              <div>
                <p className="font-bold text-primary">{t.name}</p>
                <p className="text-xs text-gray-500">{t.role}</p>
              </div>
            </div>
            <p className="text-gray-600 italic leading-relaxed">&quot;{t.quote}&quot;</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: "Does Memovoice work without internet?", a: "Yes. You can record your meetings completely offline. Your data will be processed once you reconnect to a secure network." },
    { q: "How accurate is the transcription?", a: "We utilize a triple-fallback AI synthesis model (OpenAI, Claude, and Gemini) to achieve 99.9% accuracy, even with accents and technical jargon." },
    { q: "Is my meeting data private and secure?", a: "Absolutely. We employ institutional-grade encryption and a privacy-first architecture. We do not use bots and never listen to your recordings." },
    { q: "What languages are supported?", a: "Currently we support English, Spanish, French, German, and Portuguese with high-fidelity accuracy." },
    { q: "Can I use Memovoice on iPhone?", a: "We are currently launched on Android, with an iOS version scheduled for release in late 2026." },
    { q: "How do I cancel my subscription?", a: "You can cancel any time directly through the app settings. Your Pro features will remain active until the end of your billing cycle." }
  ];

  return (
    <section className="py-24 max-w-3xl mx-auto px-4">
      <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-12 text-center tracking-tight">Frequently asked questions</h2>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="border border-gray-100 rounded-2xl bg-white overflow-hidden">
            <button 
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full p-6 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
            >
              <span className="font-bold text-primary">{faq.q}</span>
              {openIndex === i ? <Minus className="w-5 h-5 text-accent" /> : <Plus className="w-5 h-5 text-gray-400" />}
            </button>
            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 pb-6 text-gray-600 leading-relaxed"
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
    <section id="waitlist" className="py-32 bg-accent text-white text-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl lg:text-6xl font-bold mb-6 tracking-tight">Start remembering every meeting</h2>
        <p className="text-blue-100 text-xl mb-12 max-w-2xl mx-auto">Join thousands of professionals using Memovoice to scale their institutional intelligence.</p>
        
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-6">
          <input
            type="email"
            placeholder="Enter your professional email"
            className="flex-1 px-6 py-4 rounded-2xl text-primary focus:outline-none focus:ring-4 focus:ring-white/20 transition-all font-medium"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button 
            type="submit"
            className="bg-primary text-white px-8 py-4 rounded-2xl font-bold hover:scale-[1.05] transition-all active:scale-95 shadow-xl shadow-primary/20"
          >
            Join Waitlist
          </button>
        </form>
        {submitted && (
          <p className="text-white font-bold mb-4">Welcome to the future of meetings! Check your inbox soon. 🎉</p>
        )}
        <p className="text-blue-200 text-sm">Free to start. No credit card required.</p>
      </div>
    </section>
  );
};

export const Footer = () => (
  <footer className="py-20 bg-white border-t border-gray-100">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid md:grid-cols-4 gap-12 mb-16">
        <div className="col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Mic className="w-6 h-6 text-accent" />
            <span className="text-xl font-bold text-primary tracking-tight">Memovoice</span>
          </div>
          <p className="text-gray-500 max-w-sm mb-8 leading-relaxed">
            Institutional-grade audio recording and AI synthesis for modern professionals. Capture, transcribe, and summarize every physical interaction with precision.
          </p>
          <div className="flex gap-4">
            {[Linkedin, Twitter, Instagram].map((Icon, i) => (
              <div key={i} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-accent hover:bg-accent/5 transition-all cursor-pointer">
                <Icon className="w-5 h-5" />
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="font-bold text-primary mb-6">Product</h4>
          <ul className="space-y-4 text-gray-500 text-sm">
            <li><Link href="/#features" className="hover:text-accent transition-colors">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-accent transition-colors">Pricing</Link></li>
            <li><Link href="/privacy" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-accent transition-colors">Terms of Service</Link></li>
            <li><Link href="/refunds" className="hover:text-accent transition-colors">Refund Policy</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-primary mb-6">Contact</h4>
          <ul className="space-y-4 text-gray-500 text-sm">
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <a href="mailto:hello@memovoice.app" className="hover:text-accent transition-colors">hello@memovoice.app</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-sm text-gray-400">© 2026 Memovoice. All rights reserved.</p>
        <p className="text-sm text-gray-400">Standardizing institutional memory since 2026.</p>
      </div>
    </div>
  </footer>
);
