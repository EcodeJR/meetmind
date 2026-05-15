'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-2xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.jpeg" alt="Memovoice" width={32} height={32} className="h-8 w-auto" />
            <span className="text-xl font-bold text-white tracking-tight">MEMOVOICE</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-sm font-medium text-white/60 hover:text-accent transition-colors uppercase tracking-wide">Features</Link>
            <Link href="/#how-it-works" className="text-sm font-medium text-white/60 hover:text-accent transition-colors uppercase tracking-wide">How it Works</Link>
            <Link href="/pricing" className="text-sm font-medium text-white/60 hover:text-accent transition-colors uppercase tracking-wide">Pricing</Link>
            <Link href="/#download" className="text-sm font-medium text-white/60 hover:text-accent transition-colors uppercase tracking-wide">Download</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="#waitlist"
              className="bg-accent text-black px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 active:scale-95 uppercase tracking-wide"
            >
              Get Access
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
