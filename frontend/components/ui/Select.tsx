import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, children, options, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full h-9 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 pr-8 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors cursor-pointer disabled:opacity-50 disabled:bg-zinc-50 dark:disabled:bg-zinc-900',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute right-3 pointer-events-none text-zinc-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        {hint && !error && <p className="text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
