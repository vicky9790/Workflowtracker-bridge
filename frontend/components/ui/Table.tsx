import React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm text-left border-collapse', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-zinc-50/70 dark:bg-zinc-800/40 border-y border-zinc-200 dark:border-zinc-800', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-zinc-100 dark:divide-zinc-800/60', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 data-[state=selected]:bg-zinc-100',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-10 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 select-none align-middle whitespace-nowrap',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-3 align-middle text-zinc-700 dark:text-zinc-300 text-sm whitespace-nowrap', className)}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableEmpty({ colSpan, message = 'No records found' }: { colSpan: number; message?: string }) {
  return (
    <tr className="hover:bg-transparent">
      <td colSpan={colSpan} className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <div className="flex flex-col items-center justify-center gap-1.5">
          <p className="font-medium text-zinc-600 dark:text-zinc-300">{message}</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">Try adjusting your filters or search query.</p>
        </div>
      </td>
    </tr>
  );
}
