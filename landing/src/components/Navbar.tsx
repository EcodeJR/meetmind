'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-black/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.jpeg" alt="Memovoice" width={32} height={32} className="h-8 w-auto rounded-md" />
            <span className="text-xl font-bold text-black tracking-tight">MEMOVOICE</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-sm font-medium text-black/60 hover:text-black transition-colors uppercase tracking-wide">Features</Link>
            <Link href="/#how-it-works" className="text-sm font-medium text-black/60 hover:text-black transition-colors uppercase tracking-wide">How it Works</Link>
            <Link href="/pricing" className="text-sm font-medium text-black/60 hover:text-black transition-colors uppercase tracking-wide">Pricing</Link>
            <Link href="/#contact" className="text-sm font-medium text-black/60 hover:text-black transition-colors uppercase tracking-wide">Contact</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="#contact"
              className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-black/90 transition-all active:scale-95 uppercase tracking-wide border border-black"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
