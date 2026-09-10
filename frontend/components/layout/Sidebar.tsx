'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import { WorkSightLogo } from './WorkSightLogo';
import {
  LayoutDashboard,
  Building2,
  Users,
  Monitor,
  HeartPulse,
  Share2,
  RefreshCw,
  Server,
  History,
  Settings,
  X,
  LogOut,
  Shield,
  Download,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/organizations', label: 'Organizations', icon: Building2 },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/devices', label: 'Devices', icon: Monitor },
  { href: '/agent-health', label: 'Agent Health', icon: HeartPulse },
  { href: '/zoho-connections', label: 'Zoho Creator', icon: Share2 },
  { href: '/synchronization', label: 'Synchronization', icon: RefreshCw },
  { href: '/system-health', label: 'System Health', icon: Server },
  { href: '/audit-logs', label: 'Audit Logs', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/download', label: 'Download Agent', icon: Download },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isCurrent = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-zinc-900 border-r border-zinc-800 transition-transform duration-200 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-zinc-800/80">
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <WorkSightLogo variant="sidebar" />
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Platform Management
          </div>
          {NAV_ITEMS.map((item) => {
            const active = isCurrent(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group select-none',
                  active
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* User / Session Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40">
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/40 border border-zinc-800">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-zinc-700 text-white text-xs font-medium">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-zinc-200 truncate">
                  {user?.email || 'Platform Admin'}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-indigo-400" />
                  {user?.role || 'SUPER_ADMIN'}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
