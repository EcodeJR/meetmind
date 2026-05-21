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
    <section id="contact" className="py-24 relative overflow-hidden bg-white border-t border-black/10">
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[350px] h-[350px] bg-black/[0.03] rounded-full blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-black text-xs font-bold tracking-[0.3em] uppercase border border-black/10 px-3 py-1.5 rounded-full bg-white">
              Get In Touch
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-black mt-4 tracking-[-0.05em]">
              Have Questions? <span className="text-black/60">Contact Us</span>
            </h2>
            <p className="text-lg text-black/60 mt-4 max-w-xl mx-auto font-light leading-relaxed">
              We&apos;d love to hear from you. Fill out the form below and our team will get back to you within 24 hours.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white border border-black/10 rounded-[32px] p-8 sm:p-12 shadow-[0_24px_80px_rgba(0,0,0,0.06)]"
        >
          {submitted ? (
            <div className="text-center py-12">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-black/5 border border-black/10 rounded-full flex items-center justify-center mx-auto mb-6 text-black"
              >
                <Send className="w-8 h-8" />
              </motion.div>
              <h3 className="text-2xl font-bold text-black mb-2">Message Sent!</h3>
              <p className="text-black/60">
                Thank you for contacting Memovoice. We have received your request and will follow up shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-black/75 mb-2 uppercase tracking-[0.2em]">
                    Name <span className="text-black">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/30">
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
                      className="w-full pl-11 pr-4 py-3 rounded-full border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all text-black placeholder-black/35"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-black/75 mb-2 uppercase tracking-[0.2em]">
                    Email <span className="text-black">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/30">
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
                      className="w-full pl-11 pr-4 py-3 rounded-full border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all text-black placeholder-black/35"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-black/75 mb-2 uppercase tracking-[0.2em]">Subject</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-black/30">
                    <MessageSquare className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    name="subject"
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={handleChange}
                    disabled={submitting}
                    className="w-full pl-11 pr-4 py-3 rounded-full border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all text-black placeholder-black/35"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-black/75 mb-2 uppercase tracking-[0.2em]">
                  Message <span className="text-black">*</span>
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us details of your inquiry..."
                  value={formData.message}
                  onChange={handleChange}
                  disabled={submitting}
                  className="w-full px-4 py-3 rounded-[24px] border border-black/10 bg-white focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all text-black placeholder-black/35 resize-none"
                />
              </div>

              {errorMsg && <p className="text-sm font-semibold text-black/70">{errorMsg}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-black text-white py-4 rounded-full font-bold hover:bg-black/90 transition-all flex items-center justify-center gap-2 active:scale-95 uppercase tracking-[0.2em] disabled:opacity-50"
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

