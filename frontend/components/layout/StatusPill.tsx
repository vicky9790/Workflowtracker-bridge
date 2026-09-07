'use client';

import React, { useEffect, useState } from 'react';
import { healthApi } from '@/lib/api/health';
import Link from 'next/link';

export function StatusPill() {
  const [latency, setLatency] = useState<number | null>(null);

  const [isOnline, setIsOnline] = useState<boolean>(true);

  const checkHealth = async () => {
    const start = performance.now();
    try {
      const data = await healthApi.check();
      const end = performance.now();
      setLatency(Math.round(end - start));
      setIsOnline(data.status === 'ok');

    } catch {
      setIsOnline(false);
      setLatency(null);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/system-health"
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors text-zinc-700 dark:text-zinc-300"
      title="View System Health"
    >
      <span className="relative flex h-2 w-2">
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isOnline ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </span>
      <span className="font-mono text-[11px]">
        {isOnline ? 'Bridge Online' : 'Bridge Offline'}
      </span>
      {latency !== null && (
        <span className="text-[10px] text-zinc-400 font-mono">
          {latency}ms
        </span>
      )}
    </Link>
  );
}
