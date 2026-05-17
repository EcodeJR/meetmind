import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F0F4F8] text-on-surface">
      <Sidebar />
      <Header />
      <main className="ml-[64px] mt-[72px] p-8 max-w-[1440px]">
        {children}
      </main>
    </div>
  );
}
