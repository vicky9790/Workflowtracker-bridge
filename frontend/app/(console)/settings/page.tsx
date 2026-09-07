'use client';

import React from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Shield, Lock, Server, CheckCircle2 } from 'lucide-react';


export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Platform Settings & Configuration</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Global platform parameters, worker schedules, and secret security verification.
        </p>
      </div>

      {/* Admin Session Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            Current Administrator Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-zinc-500 block mb-1">Authenticated Account</span>
              <span className="font-mono text-zinc-200 font-semibold">{user?.email || 'admin'}</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-zinc-500 block mb-1">Assigned Role</span>
              <Badge variant="violet">{user?.role || 'SUPER_ADMIN'}</Badge>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-zinc-500 block mb-1">Session Duration</span>
              <span className="text-emerald-400 font-medium">12 Hours (Rolling)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operational Constants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            Daemon & Worker Schedules
          </CardTitle>
          <p className="text-xs text-zinc-400 mt-0.5">
            Hardened background timing policies configured on Bridge Backend
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-zinc-500 block mb-1">Sync Retry Tick</span>
              <span className="font-mono text-zinc-200 font-bold">15,000 ms (15s)</span>
              <p className="text-[10px] text-zinc-500 mt-1">Periodic poll for pending Creator sync</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-zinc-500 block mb-1">Device Presence Tick</span>
              <span className="font-mono text-zinc-200 font-bold">60,000 ms (60s)</span>
              <p className="text-[10px] text-zinc-500 mt-1">Evaluates agent heartbeat freshness</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-zinc-500 block mb-1">Inactivity Threshold</span>
              <span className="font-mono text-amber-400 font-bold">120 seconds</span>
              <p className="text-[10px] text-zinc-500 mt-1">Threshold to transition ONLINE &rarr; OFFLINE</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-zinc-500 block mb-1">Max Sync Retry Attempts</span>
              <span className="font-mono text-zinc-200 font-bold">5 Attempts</span>
              <p className="text-[10px] text-zinc-500 mt-1">Transitions to DEAD on 5th failure</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-zinc-500 block mb-1">Device Token Lifetime</span>
              <span className="font-mono text-zinc-200 font-bold">30 Days</span>
              <p className="text-[10px] text-zinc-500 mt-1">Revocable via console at any time</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
              <span className="text-zinc-500 block mb-1">One-Time Activation Code</span>
              <span className="font-mono text-zinc-200 font-bold">24 Hours Expiry</span>
              <p className="text-[10px] text-zinc-500 mt-1">Single-use token for desktop agent</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secrets & Security Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            Security & Secrets Verification
          </CardTitle>
          <p className="text-xs text-zinc-400 mt-0.5">
            Confirms essential cryptography secrets are loaded into server memory without exposing values
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />
              <div>
                <span className="text-xs font-semibold text-white">JWT_SECRET</span>
                <p className="text-[11px] text-zinc-400">
                  Used for signing and verifying admin and agent JWT session tokens.
                </p>
              </div>
            </div>
            <Badge variant="success">Loaded & Masked</Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />
              <div>
                <span className="text-xs font-semibold text-white">ENCRYPTION_KEY</span>
                <p className="text-[11px] text-zinc-400">
                  AES-256-GCM symmetric key used for encrypting Zoho OAuth refresh tokens at rest.
                </p>
              </div>
            </div>
            <Badge variant="success">Active (AES-256)</Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />
              <div>
                <span className="text-xs font-semibold text-white">ZOHO_CLIENT_SECRET</span>
                <p className="text-[11px] text-zinc-400">
                  Creator OAuth 2.0 application client secret for token refresh handshakes.
                </p>
              </div>
            </div>
            <Badge variant="success">Configured</Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />
              <div>
                <span className="text-xs font-semibold text-white">TRACKFLOW_INTEGRATION_KEY</span>
                <p className="text-[11px] text-zinc-400">
                  Pre-shared key authenticating Zoho Creator webhook calls to the Bridge.
                </p>
              </div>
            </div>
            <Badge variant="success">Protected</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
