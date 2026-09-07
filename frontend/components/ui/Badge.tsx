import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'violet' | 'blue';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
}

export function Badge({
  variant = 'neutral',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    neutral: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    violet: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  };

  const dotStyles: Record<BadgeVariant, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    neutral: 'bg-zinc-400',
    violet: 'bg-indigo-500',
    blue: 'bg-sky-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide select-none',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', dotStyles[variant])} />
      )}
      {children}
    </span>
  );
}
