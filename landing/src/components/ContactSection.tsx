'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageSquare, Send, User } from 'lucide-react';

const ContactSection = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://memovoice.onrender.com/api';
      const res = await fetch(`${apiUrl}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setSubmitted(false), 5000);
      } else {
        setErrorMsg(data.error || 'Failed to send message. Please try again.');
      }
    } catch (err) {
      setErrorMsg('Could not connect to support service. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 relative overflow-hidden bg-black border-t border-white/5">
      {/* Decorative Glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[350px] h-[350px] bg-accent/5 rounded-full blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-accent text-xs font-bold tracking-widest uppercase border border-accent/20 px-3 py-1.5 rounded-full bg-accent/5">
              Get In Touch
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-white mt-4 tracking-tight">
              Have Questions? <span className="text-accent">Contact Us</span>
            </h2>
            <p className="text-lg text-white/50 mt-4 max-w-xl mx-auto font-light leading-relaxed">
              We&apos;d love to hear from you. Fill out the form below and our team will get back to you within 24 hours.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 sm:p-12 backdrop-blur-md shadow-2xl"
        >
          {submitted ? (
            <div className="text-center py-12">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-accent/10 border border-accent/30 rounded-full flex items-center justify-center mx-auto mb-6 text-accent"
              >
                <Send className="w-8 h-8" />
              </motion.div>
              <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
              <p className="text-white/60">
                Thank you for contacting Memovoice. We have received your request and will follow up shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-white/70 mb-2">
                    Name <span className="text-accent">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-white/30">
                      <User className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Your Name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={submitting}
                      className="w-full pl-11 pr-4 py-3 rounded-lg border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all text-white placeholder-white/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white/70 mb-2">
                    Email <span className="text-accent">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-white/30">
                      <Mail className="w-5 h-5" />
                    </span>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={submitting}
                      className="w-full pl-11 pr-4 py-3 rounded-lg border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all text-white placeholder-white/30"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">Subject</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-white/30">
                    <MessageSquare className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    name="subject"
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={handleChange}
                    disabled={submitting}
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all text-white placeholder-white/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Message <span className="text-accent">*</span>
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us details of your inquiry..."
                  value={formData.message}
                  onChange={handleChange}
                  disabled={submitting}
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all text-white placeholder-white/30 resize-none"
                />
              </div>

              {errorMsg && <p className="text-sm font-semibold text-red-500">{errorMsg}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent text-black py-4 rounded-lg font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2 active:scale-98 uppercase tracking-wide disabled:opacity-50"
              >
                {submitting ? (
                  <>Sending Message...</>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default ContactSection;

