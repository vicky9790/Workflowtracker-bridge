import React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/70 shadow-sm backdrop-blur-sm transition-all',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 pb-3 flex flex-col gap-1.5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('p-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between', className)}
      {...props}
    >
      {children}
    </div>
  );
}
