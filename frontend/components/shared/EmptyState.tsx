import React from 'react';
import { cn } from '@/lib/utils';
import { FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = <FolderOpen className="w-8 h-8 text-zinc-400" />,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30',
        className
      )}
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4 ring-8 ring-zinc-50 dark:ring-zinc-900">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h4>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
