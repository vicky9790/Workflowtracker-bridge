'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { usePathname } from 'next/navigation';

interface TopBarProps {
  onOpenSidebar: () => void;
}

export function TopBar({ onOpenSidebar }: TopBarProps) {
  const pathname = usePathname();

  const getPageTitle = (path: string) => {
    const segment = path.split('/')[1] || 'dashboard';
    switch (segment) {
      case 'dashboard':
        return 'Overview';
      case 'organizations':
        return 'Organizations';
      case 'employees':
        return 'Employees';
      case 'devices':
        return 'Devices';
      case 'agent-health':
        return 'Agent Health';
      case 'zoho-connections':
        return 'Zoho Connections';
      case 'synchronization':
        return 'Synchronization';
      case 'system-health':
        return 'System Health';
      case 'audit-logs':
        return 'Audit Logs';
      case 'settings':
        return 'Platform Settings';
      default:
        return 'Console';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 px-4 sm:px-6 backdrop-blur-md transition-all">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {getPageTitle(pathname)}
          </h1>
          <span className="hidden sm:inline-block text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
            v1.0.0
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <StatusPill />
      </div>
    </header>
  );
}
