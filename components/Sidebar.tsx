'use client';

import React, { useState, useEffect } from 'react';
import { BarChart2, Activity, FileText, Settings, Search, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useLang } from './LangContext';

const STORAGE_KEY = 'vault:sidebar';

export function Sidebar() {
  const { t } = useLang();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'open') setCollapsed(false);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, next ? 'collapsed' : 'open');
  };

  // Don't show on login page
  if (pathname === '/login') return null;

  const links = [
    { href: '/vault', icon: <Shield size={18} />, label: 'Dashboard' },
    { href: '/analytics', icon: <BarChart2 size={18} />, label: t.dashboard.analytics },
    { href: '/monitoring', icon: <Activity size={18} />, label: t.dashboard.monitoring },
    { href: '/docs', icon: <FileText size={18} />, label: t.dashboard.docs },
    { href: '/settings', icon: <Settings size={18} />, label: t.dashboard.settings },
    { href: '/query', icon: <Search size={18} />, label: t.dashboard.keyLookup.replace(' →', '') },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 flex flex-col bg-white border-r border-black/8 transition-all duration-200 ease-out ${
        collapsed ? 'w-[52px]' : 'w-[180px]'
      }`}
    >
      {/* Logo area */}
      <div className={`flex items-center h-14 border-b border-black/5 ${collapsed ? 'justify-center' : 'px-4 gap-2.5'}`}>
        <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
          <Shield size={14} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-[13px] font-bold tracking-tight truncate">Token Bank</span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {links.map(({ href, icon, label }) => {
          const active = pathname === href || (href !== '/vault' && pathname?.startsWith(href));
          return (
            <a
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-lg transition-all duration-150 ${
                collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
              } ${
                active
                  ? 'bg-black text-white shadow-sm'
                  : 'text-black/40 hover:text-black hover:bg-black/10'
              }`}
            >
              <span className={`flex-shrink-0 transition-transform duration-150 ${!active ? 'group-hover:scale-110' : ''}`}>{icon}</span>
              {!collapsed && <span className="text-[13px] font-medium truncate">{label}</span>}
              {collapsed && (
                <span className="pointer-events-none absolute left-full ml-2 px-2.5 py-1 rounded-md bg-black text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-50">
                  {label}
                </span>
              )}
            </a>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="flex items-center justify-center h-10 border-t border-black/5 text-black/30 hover:text-black hover:bg-black/5 transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}

/** Wrapper to offset page content for sidebar width */
export function SidebarOffset({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') return <>{children}</>;

  return (
    <div className="pl-[52px]">
      {children}
    </div>
  );
}
