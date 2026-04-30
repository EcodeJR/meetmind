'use client';

import React from 'react';
import Link from 'next/link';
import { Mic } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <Mic className="w-6 h-6 text-accent" />
            <span className="text-xl font-bold text-primary tracking-tight">Memovoice</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-gray-600 hover:text-accent transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-accent transition-colors">How it Works</Link>
            <Link href="#pricing" className="text-sm font-medium text-gray-600 hover:text-accent transition-colors">Pricing</Link>
            <Link href="#download" className="text-sm font-medium text-gray-600 hover:text-accent transition-colors">Download</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="#waitlist"
              className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 active:scale-95"
            >
              Get Early Access
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
