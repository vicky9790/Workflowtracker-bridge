'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function CopyButton({ text, className, size = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      className={cn(
        'inline-flex items-center justify-center rounded p-1 transition-colors text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer',
        size === 'sm' ? 'w-6 h-6' : 'w-8 h-8',
        className
      )}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
