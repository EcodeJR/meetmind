import React from 'react';
import Navbar from '@/components/Navbar';
import { Footer } from '@/components/BrandSections';

export const metadata = {
  title: 'Privacy Policy | Memovoice',
  description: 'Learn how Memovoice protects your institutional meeting data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-32 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl lg:text-5xl font-black text-black mb-12 tracking-[-0.05em]">Privacy Policy</h1>
        <p className="text-black/50 mb-8 italic">Last Updated: April 2026</p>

        <div className="prose prose-lg prose-slate max-w-none space-y-12 text-black/75">
          <section>
            <h2 className="text-2xl font-bold text-black mb-4">1. Commitment to Privacy</h2>
            <p>
              At Memovoice, we understand that professional meetings contain highly sensitive institutional knowledge. Our architecture is designed with a &quot;Privacy-First&quot; philosophy, ensuring that your audio data remains under your control at all times.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-4">2. Data Collection</h2>
            <p>We collect only the essential information required to provide our transcription and summarization services:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Identity Data:</strong> Your email address and professional profile information, managed securely via Clerk.</li>
              <li><strong>Audio Recordings:</strong> Voice data captured during your recording sessions, temporarily stored for processing.</li>
              <li><strong>Metadata:</strong> Meeting titles, durations, and system-generated timestamps.</li>
              <li><strong>Device Information:</strong> Basic technical data to ensure app performance and stability.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-4">3. Data Storage & Infrastructure</h2>
            <p>Your data is stored using industry-standard encrypted cloud infrastructure:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Database:</strong> Transactional data and summaries are stored in MongoDB Atlas with TLS 1.3 encryption.</li>
              <li><strong>Audio/Images:</strong> Media assets are stored in Cloudinary&apos;s secure object storage with restricted access controls.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-4">4. Third-Party Intelligence Services</h2>
            <p>To provide high-fidelity transcription and AI analysis, we utilize selected institutional partners:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Groq:</strong> High-speed transcription processing.</li>
              <li><strong>Google Gemini / Anthropic Claude:</strong> Advanced AI summarization and action item extraction.</li>
              <li><strong>Clerk:</strong> Secure authentication and identity management.</li>
              <li><strong>Paddle:</strong> PCI-compliant payment and subscription processing.</li>
            </ul>
            <p className="mt-4 italic">Note: These partners are contractually bound to process data only for the purpose of fulfilling the requested service and do not retain your data for training their models.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-4">5. User Rights & Data Governance</h2>
            <p>You maintain full sovereignty over your data:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> You may request a copy of all data associated with your identity.</li>
              <li><strong>Deletion:</strong> You can purge your account and all associated recordings at any time via the &quot;Dissolve Account&quot; feature in app settings.</li>
              <li><strong>Portability:</strong> You can export your transcripts and summaries to external formats (PDF, Email) at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-4">6. Contact</h2>
            <p>For privacy requests or inquiries regarding our data governance practices, please contact our Data Privacy Officer at:</p>
            <p className="font-bold text-black">memovoiceio@gmail.com</p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
