'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckSquare, FileText, Mic, ShieldCheck, Users, WifiOff, AlertCircle, MessageSquare } from 'lucide-react';
import Image from 'next/image';

type RevealProps = { children: React.ReactNode; delay?: number; className?: string };

const Reveal = ({ children, delay = 0, className }: RevealProps) => {
  const reduceMotion = useReducedMotion();
  return <motion.div initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>{children}</motion.div>;
};

// Kept for backwards compatibility with the page composition. We do not show
// made-up customer logos or usage claims on the public site.
export const SocialProof = () => null;

export const Problem = () => (
  <section className="py-24 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Reveal className="text-center mb-16">
        <p className="text-xs font-bold text-black uppercase tracking-[0.3em] mb-4">WHY MEMOVOICE</p>
        <h2 className="text-4xl lg:text-5xl font-black text-black mb-6 tracking-[-0.05em]">Stay in the conversation. Keep the details.</h2>
        <p className="text-black/60 max-w-2xl mx-auto text-lg leading-relaxed">You should not have to choose between listening to people and taking useful notes.</p>
      </Reveal>
      <div className="grid md:grid-cols-3 gap-6">
        {[
          { title: 'Details are easy to lose', desc: 'A good conversation can move quickly. Memovoice gives you a record you can return to after the meeting.', icon: <AlertCircle className="w-6 h-6" /> },
          { title: 'Follow-ups need a home', desc: 'Keep decisions and next steps with the meeting, so everyone knows what needs to happen next.', icon: <CheckSquare className="w-6 h-6" /> },
          { title: 'Typing pulls you out of the room', desc: 'Record first, then review. You can stay present while the conversation is happening.', icon: <MessageSquare className="w-6 h-6" /> },
        ].map((item, index) => (
          <Reveal key={item.title} delay={index * 0.08}>
            <motion.div whileHover={{ y: -6 }} transition={{ duration: 0.2 }} className="group h-full p-6 rounded-3xl bg-white border border-black/10 hover:border-black/25 transition-colors shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <motion.div whileHover={{ rotate: -8, scale: 1.06 }} className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center mb-6 text-black">{item.icon}</motion.div>
              <h3 className="text-lg font-bold text-black mb-3 tracking-tight">{item.title}</h3><p className="text-black/60 leading-relaxed text-sm">{item.desc}</p>
            </motion.div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export const Features = () => (
  <section id="features" className="py-24 bg-white overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Reveal className="text-center mb-20">
        <p className="text-xs font-bold text-black uppercase tracking-[0.3em] mb-4">BUILT FOR THE WHOLE FOLLOW-UP</p>
        <h2 className="text-4xl lg:text-5xl font-black text-black mb-6 tracking-[-0.05em]">From recording to shared next steps</h2>
        <p className="text-black/60 max-w-2xl mx-auto text-lg leading-relaxed">Capture an in-person meeting, turn it into notes you can use, then keep the people involved on the same page.</p>
      </Reveal>
      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
        <Reveal><div className="rounded-[32px] border border-black/10 p-4 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.04)]"><div className="grid gap-4">
          {[
            { title: 'Record without staying in the app', subtitle: 'Start in one tap and keep recording while you check another app.', image: '/images/Phone-recording-screen-one.jpg' },
            { title: 'Read the conversation clearly', subtitle: 'Review the transcript, summary, and key points in one place.', image: '/images/Phone-meeting-summary.jpg' },
            { title: 'Turn notes into follow-through', subtitle: 'Keep decisions, tasks, and meeting details ready to share.', image: '/images/Phone-meeting-key-notes.jpg' },
          ].map((frame, index) => (
            <motion.div key={frame.title} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.45, delay: index * 0.1 }} whileHover={{ y: -4 }} className="rounded-[24px] overflow-hidden border border-black/10 bg-white">
              <div className="h-48 flex items-center justify-center bg-black/80 overflow-hidden"><Image src={frame.image} alt={frame.title} width={900} height={560} className="w-full h-full object-contain transition-transform duration-500 hover:scale-[1.03]" /></div>
              <div className="p-4"><p className="text-[10px] uppercase tracking-[0.25em] text-black/45 font-bold">0{index + 1}</p><h3 className="text-lg font-bold text-black tracking-tight mt-1">{frame.title}</h3><p className="text-sm text-black/60 mt-2 leading-relaxed">{frame.subtitle}</p></div>
            </motion.div>
          ))}
        </div></div></Reveal>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { title: 'Background recording', desc: 'Keep recording while you move to another app. Stop when you are ready.', icon: <Mic className="w-6 h-6" /> },
            { title: 'Clear transcripts', desc: 'Read the conversation in clear sections and correct important details before sharing.', icon: <FileText className="w-6 h-6" /> },
            { title: 'Summaries and tasks', desc: 'See the main points, decisions, and follow-ups without replaying the whole meeting.', icon: <CheckSquare className="w-6 h-6" /> },
            { title: 'Works when you are offline', desc: 'Record without internet. Your meeting waits on your device until it can be processed.', icon: <WifiOff className="w-6 h-6" /> },
            { title: 'Workspaces for teams', desc: 'Invite teammates, share meetings, discuss notes, and keep work together.', icon: <Users className="w-6 h-6" /> },
            { title: 'Controls that stay with you', desc: 'Choose how long to keep meetings, export what you need, or delete your account in the app.', icon: <ShieldCheck className="w-6 h-6" /> },
          ].map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.06}>
              <motion.div whileHover={{ y: -6 }} transition={{ duration: 0.2 }} className="group h-full p-6 rounded-[28px] bg-white border border-black/10 hover:border-black/25 transition-colors shadow-[0_12px_34px_rgba(0,0,0,0.03)]">
                <motion.div whileHover={{ rotate: -8, scale: 1.08 }} className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mb-6 group-hover:bg-black group-hover:text-white transition-colors duration-300 text-black">{feature.icon}</motion.div>
                <h3 className="text-lg font-bold text-black mb-3 tracking-tight">{feature.title}</h3><p className="text-black/60 leading-relaxed text-sm">{feature.desc}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  </section>
);
