'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/lib/auth/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/20 text-white font-bold text-base">
            TF
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // AuthContext handles redirect to /login
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Fixed Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Workspace Area (offset by sidebar width on lg screens) */}
      <div className="flex flex-col flex-1 lg:pl-64">
        <TopBar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
