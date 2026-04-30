'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Target, 
  MessageSquare, 
  ShieldCheck, 
  Globe, 
  Sparkles,
  AlertCircle,
  FileText,
  Users,
  Mic
} from 'lucide-react';

export const SocialProof = () => (
  <div className="py-12 bg-white/50 border-y border-gray-100">
    <div className="max-w-7xl mx-auto px-4 text-center">
      <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">Trusted by professionals in 10+ countries</p>
      <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale">
        {/* Placeholder Company Logos */}
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-400 rounded-lg" />
            <div className="w-24 h-4 bg-gray-400 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const Problem = () => (
  <section className="py-24 bg-gray-50/50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-3xl lg:text-4xl font-bold text-primary mb-4 tracking-tight">Manual notes don't cut it anymore</h2>
        <p className="text-gray-500 max-w-2xl mx-auto">Focus on the conversation, not the transcription. Memovoice bridges the memory gap in professional settings.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {[
          {
            title: "You forget 90% of what was discussed",
            desc: "Human memory is fallible. Critical details discussed in the room are often lost within the first 24 hours.",
            icon: <AlertCircle className="w-6 h-6 text-red-500" />
          },
          {
            title: "Action items get lost after the meeting",
            desc: "Without an automated system, follow-ups depend on manual entry, leading to missed deadlines and forgotten tasks.",
            icon: <Target className="w-6 h-6 text-orange-500" />
          },
          {
            title: "Writing notes means missing the conversation",
            desc: "Active listening is impossible when you're head-down typing. Engagement drops when note-taking begins.",
            icon: <MessageSquare className="w-6 h-6 text-blue-500" />
          }
        ].map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -5 }}
            className="p-8 rounded-3xl bg-white border border-gray-100 shadow-sm"
          >
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-6">
              {item.icon}
            </div>
            <h3 className="text-xl font-bold text-primary mb-3">{item.title}</h3>
            <p className="text-gray-600 leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export const Features = () => (
  <section id="features" className="py-24">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <h2 className="text-3xl lg:text-5xl font-bold text-primary mb-6 tracking-tight">Everything you need from every meeting</h2>
        <p className="text-gray-500 max-w-2xl mx-auto text-lg">Sophisticated AI intelligence wrapped in a minimalist mobile interface.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[
          {
            title: "One-Tap Recording",
            desc: "Start recording instantly, no setup needed. Capture high-fidelity audio from any physical environment.",
            icon: <Mic className="w-6 h-6 text-accent" />
          },
          {
            title: "AI Transcription",
            desc: "Accurate speaker-labeled transcripts generated within seconds of meeting completion.",
            icon: <FileText className="w-6 h-6 text-accent" />
          },
          {
            title: "Smart Summaries",
            desc: "Our AI condenses hours of discussion into concise, high-impact executive summaries.",
            icon: <Sparkles className="w-6 h-6 text-accent" />
          },
          {
            title: "Action Items",
            desc: "Automated extraction of decisions and tasks. Never miss a follow-up or deadline again.",
            icon: <Target className="w-6 h-6 text-accent" />
          },
          {
            title: "Works Offline",
            desc: "No internet needed during the meeting. Data syncs securely once you're back on the network.",
            icon: <Globe className="w-6 h-6 text-accent" />
          },
          {
            title: "Privacy First",
            desc: "No bots, no intrusion. Your audio and data stay securely within your institutional control.",
            icon: <ShieldCheck className="w-6 h-6 text-accent" />
          }
        ].map((feat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group p-8 rounded-[32px] hover:bg-white hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent/5 flex items-center justify-center mb-8 group-hover:bg-accent group-hover:text-white transition-colors duration-500">
              {feat.icon}
            </div>
            <h3 className="text-2xl font-bold text-primary mb-4">{feat.title}</h3>
            <p className="text-gray-600 leading-relaxed text-lg">{feat.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
