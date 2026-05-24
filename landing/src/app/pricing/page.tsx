import React from 'react';
import Navbar from '@/components/Navbar';
import { Pricing, Footer } from '@/components/BrandSections';

export const metadata = {
  title: 'Pricing | Memovoice',
  description: 'Choose the right plan for your professional transcription and AI summary needs.',
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="pt-32 pb-20">
        {/* <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16">
          <h1 className="text-4xl lg:text-6xl font-black text-black mb-6 tracking-[-0.06em]">Simple, transparent pricing</h1>
          <p className="text-black/60 text-xl max-w-2xl mx-auto">
            Scale your institutional intelligence with plans designed for individuals and professional teams.
          </p>
        </div> */}
        <Pricing />
        
        {/* Additional Pricing Context */}
        <section className="py-20 bg-white mt-20 border-t border-black/10">
          <div className="max-w-4xl mx-auto px-4 grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xl font-bold text-black mb-4">Enterprise grade security</h3>
              <p className="text-black/60 leading-relaxed">
                All plans include TLS 1.3 encryption, SOC2-compliant data handling, and our strict &quot;Privacy-First&quot; data processing architecture.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-black mb-4">Flexible subscriptions</h3>
              <p className="text-black/60 leading-relaxed">
                Upgrade, downgrade, or cancel at any time. Your professional data remains yours, even if you decide to pause your subscription.
              </p>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
