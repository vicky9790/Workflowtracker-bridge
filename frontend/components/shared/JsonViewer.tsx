'use client';

import React, { useState } from 'react';
import { CopyButton } from './CopyButton';

export function JsonViewer({ data, title }: { data: any; title?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
        <span className="font-mono font-medium text-[11px]">{title || 'Payload'}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[11px] hover:text-zinc-200 px-1.5 py-0.5 rounded"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <CopyButton text={jsonString} />
        </div>
      </div>
      {!collapsed && (
        <pre className="p-3 overflow-x-auto text-emerald-400 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto">
          {jsonString}
        </pre>
      )}
    </div>
  );
}
