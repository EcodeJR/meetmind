'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Target, 
  MessageSquare, 
  ShieldCheck, 
  Globe, 
  Sparkles,
  AlertCircle,
  FileText,
  Mic
} from 'lucide-react';

export const SocialProof = () => (
  <div className="py-12 bg-black border-y border-white/5">
    <div className="max-w-7xl mx-auto px-4 text-center">
      <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-8">Trusted by professionals in 10+ countries</p>
      <div className="flex flex-wrap justify-center items-center gap-12 opacity-30 grayscale">
        {/* Placeholder Company Logos */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg" />
            <div className="w-24 h-4 bg-white/20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const Problem = () => (
  <section className="py-24 bg-black">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">THE CHALLENGE</p>
        <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 tracking-tight">Manual notes don&apos;t cut it anymore</h2>
        <p className="text-white/50 max-w-2xl mx-auto text-lg leading-relaxed">Focus on the conversation, not the transcription. Memovoice bridges the memory gap in professional settings.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {[
          {
            title: "You forget 90% of what was discussed",
            desc: "Human memory is fallible. Critical details discussed in the room are often lost within the first 24 hours.",
            icon: <AlertCircle className="w-6 h-6 text-white/40" />
          },
          {
            title: "Action items get lost after the meeting",
            desc: "Without an automated system, follow-ups depend on manual entry, leading to missed deadlines and forgotten tasks.",
            icon: <Target className="w-6 h-6 text-white/40" />
          },
          {
            title: "Writing notes means missing the conversation",
            desc: "Active listening is impossible when you're head-down typing. Engagement drops when note-taking begins.",
            icon: <MessageSquare className="w-6 h-6 text-white/40" />
          }
        ].map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -5 }}
            className="p-6 rounded-lg bg-dark-50 border border-white/5 hover:border-white/10 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-6">
              {item.icon}
            </div>
            <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
            <p className="text-white/50 leading-relaxed text-sm">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export const Features = () => (
  <section id="features" className="py-24 bg-black">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">CAPABILITIES</p>
        <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 tracking-tight">Everything you need from every meeting</h2>
        <p className="text-white/50 max-w-2xl mx-auto text-lg leading-relaxed">Sophisticated AI intelligence wrapped in a minimalist mobile interface.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            title: "One-Tap Recording",
            desc: "Start recording instantly, no setup needed. Capture high-fidelity audio from any physical environment.",
            icon: <Mic className="w-6 h-6" />
          },
          {
            title: "AI Transcription",
            desc: "Accurate speaker-labeled transcripts generated within seconds of meeting completion.",
            icon: <FileText className="w-6 h-6" />
          },
          {
            title: "Smart Summaries",
            desc: "Our AI condenses hours of discussion into concise, high-impact executive summaries.",
            icon: <Sparkles className="w-6 h-6" />
          },
          {
            title: "Action Items",
            desc: "Automated extraction of decisions and tasks. Never miss a follow-up or deadline again.",
            icon: <Target className="w-6 h-6" />
          },
          {
            title: "Works Offline",
            desc: "No internet needed during the meeting. Data syncs securely once you're back on the network.",
            icon: <Globe className="w-6 h-6" />
          },
          {
            title: "Privacy First",
            desc: "No bots, no intrusion. Your audio and data stay securely within your institutional control.",
            icon: <ShieldCheck className="w-6 h-6" />
          }
        ].map((feat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group p-6 rounded-lg bg-dark-50 border border-white/5 hover:border-accent/50 hover:bg-dark-100 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-6 group-hover:bg-accent group-hover:text-black transition-all duration-300 text-accent">
              {feat.icon}
            </div>
            <h3 className="text-lg font-bold text-white mb-3">{feat.title}</h3>
            <p className="text-white/50 leading-relaxed text-sm">{feat.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
