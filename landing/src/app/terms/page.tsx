import React from 'react';
import Navbar from '@/components/Navbar';
import { Footer } from '@/components/BrandSections';

export const metadata = {
  title: 'Terms of Service | Memovoice',
  description: 'Review the legal framework for using the Memovoice intelligence platform.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-32 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl lg:text-5xl font-bold text-primary mb-12 tracking-tight">Terms of Service</h1>
        <p className="text-gray-500 mb-8 italic">Effective Date: April 2026</p>

        <div className="prose prose-lg prose-slate max-w-none space-y-12 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Memovoice mobile application and related web services, you agree to be bound by these Terms of Service. If you are using the service on behalf of an institution or company, you represent that you have the authority to bind that entity to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">2. Description of Service</h2>
            <p>
              Memovoice provides an AI-powered transcription and summarization platform for physical meetings. The service includes audio recording, speaker-labeled transcription, and AI-generated executive summaries. We reserve the right to modify or discontinue features of the service at any time to maintain institutional quality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">3. User Responsibilities</h2>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintaining the confidentiality of your Clerk authentication credentials.</li>
              <li>Ensuring you have the legal right or consent to record the parties involved in your meetings, in accordance with your local and institutional laws.</li>
              <li>All activities that occur under your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">4. Subscription & Payments</h2>
            <p>
              Memovoice offers Free and Pro subscription tiers. Pro subscriptions are billed on a recurring monthly basis. Payments are processed via Paddle. You may cancel your subscription at any time; however, we do not provide refunds for partial billing cycles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">5. Intellectual Property</h2>
            <p>
              All transcripts and AI-generated summaries produced from your recordings are your exclusive intellectual property. Memovoice retains ownership of the underlying software, branding, and proprietary AI synthesis workflows.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">6. Limitation of Liability</h2>
            <p>
              Memovoice provides transcription services for informational purposes. While we strive for 99.9% accuracy, we are not liable for any errors in transcription or summarization, nor for any business decisions made based on such outputs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">7. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the service for violations of these terms, including but not limited to unauthorized commercial exploitation or attempts to circumvent our security infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">8. Contact</h2>
            <p>For legal inquiries or notices, please contact us at:</p>
            <p className="font-bold text-accent">legal@memovoice.app</p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
