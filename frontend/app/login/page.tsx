'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Shield, AlertCircle, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDefaultCredentials = () => {
    setEmail('super@example.com');
    setPassword('SuperAdmin@123');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-950 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/25 text-white font-bold text-lg mb-4 ring-4 ring-indigo-600/20">
              TF
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">TrackFlow Bridge Console</h1>
            <p className="text-xs text-zinc-400 mt-1.5">
              Internal Platform Administration & Operations
            </p>
          </div>

          {/* Error notice */}
          {error && (
            <div className="mb-6 flex items-start gap-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-none mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Admin Email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2 text-sm font-semibold"
            >
              Sign In to Console
            </Button>
          </form>

          {/* Quick seed credentials helper */}
          <div className="mt-6 pt-5 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Default Super Admin</span>
              </div>
              <button
                type="button"
                onClick={fillDefaultCredentials}
                className="text-xs font-mono text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
              >
                Auto-fill
              </button>
            </div>
            <p className="text-[11px] font-mono text-zinc-500 mt-1">
              super@example.com / SuperAdmin@123
            </p>
          </div>
        </div>

        {/* Security footer */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
          <Shield className="w-3.5 h-3.5 text-zinc-500" />
          <span>Strictly authorized access only. All sessions are audited.</span>
        </div>
      </div>
    </div>
  );
}
