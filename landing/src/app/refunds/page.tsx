import React from 'react';
import Navbar from '@/components/Navbar';
import { Footer } from '@/components/BrandSections';

export const metadata = {
  title: 'Refund Policy | Memovoice',
  description: 'Review our institutional refund and subscription cancellation policies.',
};

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-32 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl lg:text-5xl font-black text-black mb-12 tracking-[-0.05em]">Refund Policy</h1>
        <p className="text-black/50 mb-8 italic">Last Updated: April 2026</p>

        <div className="prose prose-lg prose-slate max-w-none space-y-12 text-black/75">
          <section>
            <h2 className="text-2xl font-bold text-black mb-4">1. Subscription Cancellation</h2>
            <p>
              You may cancel your Memovoice Pro subscription at any time via the &quot;Settings&quot; menu in the mobile application. Upon cancellation, your Pro features will remain active until the end of your current billing cycle (monthly or annual).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-4">2. Refund Eligibility</h2>
            <p>
              Due to the immediate provisioning of AI resources (transcription time and LLM processing) required to deliver our service, Memovoice generally does not offer refunds for partial billing periods. However, we consider refund requests on a case-by-case basis under the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Technical Failure:</strong> If a persistent system error prevented the successful processing of your recordings for more than 48 hours.</li>
              <li><strong>Duplicate Billing:</strong> If you were accidentally charged twice for the same subscription period.</li>
              <li><strong>Unauthorized Charge:</strong> In cases of verified fraudulent activity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-4">3. Request Process</h2>
            <p>
              To request a refund review, please contact our support team at <span className="font-bold text-black">memovoiceio@gmail.com</span> within 7 days of the transaction. Please include your account email and the transaction ID provided by Paddle.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-4">4. Processing Time</h2>
            <p>
              Approved refunds are typically processed within 5-10 business days. The funds will be returned via the original payment method used through our processor, Paddle.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-black mb-4">5. Modifications</h2>
            <p>
              Memovoice reserves the right to modify this refund policy to align with institutional standards and the requirements of our payment partners.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
