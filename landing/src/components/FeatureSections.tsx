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
  Mic,
  Hexagon,
  Triangle,
  Circle,
  Square,
  Octagon,
  ArrowRight
} from 'lucide-react';
import Image from 'next/image';

export const SocialProof = () => (
  <div className="py-12 bg-white border-y border-black/10">
    <div className="max-w-7xl mx-auto px-4 text-center">
      <p className="text-xs font-bold text-black/45 uppercase tracking-[0.3em] mb-8">Trusted by professionals in 10+ countries</p>
      <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-35 grayscale hover:grayscale-0 transition-all duration-500 text-black">
        {[
          { name: "Acme Corp", icon: <Hexagon className="w-6 md:w-8 h-6 md:h-8" /> },
          { name: "Globex", icon: <Triangle className="w-6 md:w-8 h-6 md:h-8" /> },
          { name: "Initech", icon: <Circle className="w-6 md:w-8 h-6 md:h-8" /> },
          { name: "Soylent", icon: <Square className="w-6 md:w-8 h-6 md:h-8" /> },
          { name: "Massive", icon: <Octagon className="w-6 md:w-8 h-6 md:h-8" /> }
        ].map((company) => (
          <div key={company.name} className="flex items-center gap-2 font-bold text-lg md:text-xl tracking-tight">
            {company.icon}
            <span>{company.name}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const Problem = () => (
  <section className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <p className="text-xs font-bold text-black uppercase tracking-[0.3em] mb-4">THE CHALLENGE</p>
        <h2 className="text-4xl lg:text-5xl font-black text-black mb-6 tracking-[-0.05em]">Manual notes don&apos;t cut it anymore</h2>
        <p className="text-black/60 max-w-2xl mx-auto text-lg leading-relaxed">Focus on the conversation, not the transcription. Memovoice bridges the memory gap in professional settings.</p>
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
            className="p-6 rounded-3xl bg-white border border-black/10 hover:border-black/25 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.03)]"
          >
            <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center mb-6 text-black">
              {item.icon}
            </div>
            <h3 className="text-lg font-bold text-black mb-3 tracking-tight">{item.title}</h3>
            <p className="text-black/60 leading-relaxed text-sm">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export const Features = () => (
  <section id="features" className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <p className="text-xs font-bold text-black uppercase tracking-[0.3em] mb-4">CAPABILITIES</p>
        <h2 className="text-4xl lg:text-5xl font-black text-black mb-6 tracking-[-0.05em]">Everything you need from every meeting</h2>
        <p className="text-black/60 max-w-2xl mx-auto text-lg leading-relaxed">Sophisticated AI intelligence wrapped in a minimalist mobile interface.</p>
      </div>

      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-[32px] border border-black/10 p-4 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.04)]"
        >
          <div className="grid gap-4">
            {[
              { title: 'Recording frame', subtitle: 'Background capture without the visual noise.', image: '/images/Phone-recording-screen-one.jpg' },
              { title: 'Transcript frame', subtitle: 'Readable output with clean hierarchy.', image: '/images/Phone-meeting-summary.jpg' },
              { title: 'Summary frame', subtitle: 'Images replace video placeholders for a calmer page.', image: '/images/Phone-meeting-key-notes.jpg' },
            ].map((frame, index) => (
              <div key={frame.title} className="rounded-[24px] overflow-hidden border border-black/10 bg-white">
                <Image src={frame.image} alt={frame.title} width={900} height={560} className="w-full h-48 object-cover" />
                <div className="p-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-black/45 font-bold">0{index + 1}</p>
                    <h3 className="text-lg font-bold text-black tracking-tight mt-1">{frame.title}</h3>
                    <p className="text-sm text-black/60 mt-2 leading-relaxed">{frame.subtitle}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-black/40 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
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
            className="group p-6 rounded-[28px] bg-white border border-black/10 hover:border-black/25 transition-all duration-300 shadow-[0_12px_34px_rgba(0,0,0,0.03)]"
          >
            <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-all duration-300 text-black">
              {feat.icon}
            </div>
            <h3 className="text-lg font-bold text-black mb-3 tracking-tight">{feat.title}</h3>
            <p className="text-black/60 leading-relaxed text-sm">{feat.desc}</p>
          </motion.div>
        ))}
        </div>
      </div>
    </div>
  </section>
);
