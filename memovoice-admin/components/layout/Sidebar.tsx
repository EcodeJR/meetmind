'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: 'grid_view', label: 'Overview' },
  { href: '/dashboard/users', icon: 'group', label: 'Users' },
  { href: '/dashboard/meetings', icon: 'mic', label: 'Meetings' },
  { href: '/dashboard/communications', icon: 'mail', label: 'Communications' },
  { href: '/dashboard/subscriptions', icon: 'payments', label: 'Subscriptions' },
  { href: '/dashboard/system', icon: 'monitor_heart', label: 'System Health' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    document.cookie = 'admin_token=; Max-Age=0; path=/';
    router.push('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[64px] flex flex-col items-center py-6 bg-[#2f3038] z-50">
      {/* Logo mark */}
      <div className="mb-10">
        <span
          className="material-symbols-outlined filled"
          style={{
            color: '#dfe0ff',
            fontSize: '28px',
            fontVariationSettings: "'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24",
          }}
        >
          mic
        </span>
      </div>

      {/* Nav Links */}
      <nav className="flex flex-col gap-2 flex-1 items-center w-full px-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`
              w-full flex items-center justify-center p-2 rounded-xl transition-all duration-150
              ${isActive(item.href)
                ? 'bg-[#ffffff15] text-[#dfe0ff]'
                : 'text-[#757686] hover:text-[#dfe0ff] hover:bg-[#ffffff10]'
              }
            `}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '22px',
                fontVariationSettings: isActive(item.href)
                  ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              {item.icon}
            </span>
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="mt-auto">
        <button
          onClick={handleLogout}
          title="Logout"
          className="p-2 text-[#757686] hover:text-[#ba1a1a] transition-colors rounded-xl hover:bg-[#ffffff10]"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
            logout
          </span>
        </button>
      </div>
    </aside>
  );
}
