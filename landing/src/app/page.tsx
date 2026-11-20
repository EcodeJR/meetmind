import React from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import { SocialProof, Problem, Features } from '@/components/FeatureSections';
import { HowItWorks, Pricing, Testimonials, FAQ, FinalCTA, Footer } from '@/components/BrandSections';
import ContactSection from '@/components/ContactSection';

export const metadata = {
  title: 'Memovoice — AI Meeting Transcription App',
  description: 'Record in-person meetings and get transcripts, summaries, decisions, and tasks. Works offline and needs no meeting bot. Start free.',
  openGraph: {
    title: 'Memovoice — AI Meeting Transcription App',
    description: 'Record in-person meetings and get transcripts, summaries, decisions, and tasks. Works offline and needs no meeting bot. Start free.',
    type: 'website',
    locale: 'en_US',
    url: 'https://memovoice.app',
    siteName: 'Memovoice',
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black selection:bg-black/10 selection:text-black">
      <Navbar />
      <Hero />
      {/* <SocialProof /> */}
      <Problem />
      <Features />
      <HowItWorks />
      <Pricing />
      {/* <Testimonials /> */}
      <FAQ />
      <ContactSection />
      <FinalCTA />
      <Footer />

      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Memovoice",
            "operatingSystem": "Android, iOS",
            "applicationCategory": "BusinessApplication",
            "offers": {
              "@type": "Offer",
              "price": "0.00",
              "priceCurrency": "USD"
            },
            "description": "AI-powered meeting transcription and summarization for professionals."
          })
        }}
      />
    </main>
  );
}
