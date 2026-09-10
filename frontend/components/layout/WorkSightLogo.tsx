import React from 'react';

interface WorkSightLogoProps {
  /** 'full' = icon + "WorkSight by ZoFlowX" text, 'icon' = icon only, 'sidebar' = icon + compact stacked text */
  variant?: 'full' | 'icon' | 'sidebar';
  className?: string;
}

/** SVG recreation of the WorkSight by ZoFlowX logo */
export function WorkSightLogo({ variant = 'full', className = '' }: WorkSightLogoProps) {
  const Icon = (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="WorkSight logo icon"
    >
      {/* Corner brackets */}
      {/* Top-left blue */}
      <path d="M4 4h14v4H8v10H4V4Z" fill="#2563EB" />
      {/* Top-right red */}
      <path d="M60 4H46v4h10v10h4V4Z" fill="#DC2626" />
      {/* Bottom-left yellow */}
      <path d="M4 60h14v-4H8V46H4V60Z" fill="#D97706" />
      {/* Bottom-right blue */}
      <path d="M60 60H46v-4h10V46h4V60Z" fill="#2563EB" />

      {/* Eye outline */}
      <ellipse cx="32" cy="32" rx="18" ry="12" stroke="#1E293B" strokeWidth="3.5" fill="none" />
      {/* Iris */}
      <circle cx="32" cy="32" r="7" fill="#1E293B" />
      {/* Pupil highlight */}
      <circle cx="34" cy="30" r="2.2" fill="white" />

      {/* Bar chart inside iris area — shifted slightly right-bottom */}
      <rect x="27" y="36" width="3" height="6" rx="1" fill="#D97706" />
      <rect x="31.5" y="33" width="3" height="9" rx="1" fill="#DC2626" />
      <rect x="36" y="30" width="3" height="12" rx="1" fill="#2563EB" />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <span className={`inline-flex items-center justify-center ${className}`}>
        {Icon}
      </span>
    );
  }

  if (variant === 'sidebar') {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`}>
        <span className="inline-flex h-8 w-8 flex-none">{Icon}</span>
        <span className="flex flex-col leading-none">
          <span className="font-bold text-sm text-white tracking-tight">
            Work<span className="text-blue-400">Sight</span>
          </span>
          <span className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase">
            Bridge Console
          </span>
        </span>
      </span>
    );
  }

  // 'full' variant — icon + stacked text block like the real logo
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className="inline-flex h-14 w-14 flex-none">{Icon}</span>
      <span className="flex flex-col leading-none">
        <span className="font-extrabold text-2xl text-zinc-900 dark:text-white tracking-tight">
          Work<span className="text-blue-500">Sight</span>
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          by{' '}
          <span className="font-semibold">
            <span className="text-blue-500">Zo</span>
            <span className="text-zinc-900 dark:text-white">Flow</span>
            <span className="text-red-500">X</span>
          </span>
        </span>
      </span>
    </span>
  );
}
