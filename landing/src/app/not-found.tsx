import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Footer } from '@/components/BrandSections';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <div className="flex flex-col items-center justify-center pt-48 pb-32 px-4 text-center">
        <h1 className="text-9xl font-bold text-black/10 mb-8 tracking-tighter">404</h1>
        <h2 className="text-4xl lg:text-5xl font-bold text-primary mb-6 tracking-tight">Memory Gap</h2>
        <p className="text-gray-500 text-xl max-w-md mx-auto mb-12 leading-relaxed">
          It looks like this meeting record doesn&apos;t exist. Let&apos;s get you back to your dashboard.
        </p>
        <Link 
          href="/"
          className="bg-primary text-white px-10 py-4 rounded-2xl font-bold hover:scale-[1.05] transition-all active:scale-95 shadow-xl shadow-primary/20"
        >
          Return Home
        </Link>
      </div>
      <Footer />
    </main>
  );
}
