'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/20 text-white font-bold text-base">
          TF
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    </div>
  );
}
