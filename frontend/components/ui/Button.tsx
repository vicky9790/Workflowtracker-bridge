import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border border-indigo-500/20 active:translate-y-[0.5px]',
    secondary:
      'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/60',
    outline:
      'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700',
    ghost:
      'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-transparent',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-sm border border-rose-500/20',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-xs h-8 px-2.5 rounded-lg gap-1.5',
    md: 'text-sm h-9 px-3.5 rounded-lg gap-2',
    lg: 'text-base h-11 px-5 rounded-xl gap-2.5',
    icon: 'h-9 w-9 p-0 rounded-lg justify-center',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}
