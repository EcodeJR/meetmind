'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/users': 'Users',
  '/dashboard/meetings': 'Meetings',
  '/dashboard/communications': 'Communications',
  '/dashboard/subscriptions': 'Subscriptions',
  '/dashboard/system': 'System Health',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/dashboard/users/') && pathname !== '/dashboard/users') {
    return 'User Detail';
  }
  return pageTitles[pathname] || 'Admin';
}

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState('');
  const [adminInitials] = useState('MA');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
        ' · ' +
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      );
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-64px)] h-[72px] bg-surface border-b border-outline-variant/40 z-40 transition-all">
      <div className="flex justify-between items-center px-4 md:px-8 h-full max-w-[1440px]">
        {/* Page Title & Mobile Toggle */}
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            className="md:hidden p-2 -ml-2 text-outline hover:text-on-surface hover:bg-surface-container-low rounded-xl transition-colors"
            onClick={onMenuClick}
            title="Menu"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>menu</span>
          </button>
          <h1 className="text-title-lg md:text-headline-lg font-geist font-bold text-on-surface truncate">
            {getPageTitle(pathname)}
          </h1>
          <span className="hidden md:block text-label-sm text-outline bg-surface-container px-3 py-1 rounded-full">
            {currentTime}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <button
            className="relative p-2 rounded-full hover:bg-surface-container-low transition-all"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-outline" style={{ fontSize: '22px' }}>
              notifications
            </span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface" />
          </button>

          {/* Admin avatar */}
          <div className="flex items-center gap-3 pl-4 border-l border-outline-variant">
            <div className="text-right hidden sm:block">
              <p className="text-label-sm font-semibold text-on-surface">Admin</p>
              <p className="text-[10px] text-outline">Memovoice</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs border-2 border-primary-fixed">
              {adminInitials}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
