"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Download, 
  Apple, 
  Monitor, 
  CheckCircle2, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowRight,
  Sparkles,
  Info
} from "lucide-react";
import { WorkSightLogo } from "@/components/layout/WorkSightLogo";

const WIN_DOWNLOAD_URL = "https://github.com/vicky9790/Workflowtracker-Agent/releases/download/v1.0.0/WorkSight-Agent-Setup-1.0.0.exe";
const MAC_DOWNLOAD_URL = "https://github.com/vicky9790/Workflowtracker-Agent/releases/download/v1.0.0/WorkSight-Agent-1.0.0.dmg";

export default function DownloadPage() {
  const [detectedOS, setDetectedOS] = useState<"mac" | "windows" | "other">("other");
  const [activeTab, setActiveTab] = useState<"windows" | "mac">("windows");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("mac")) {
        setDetectedOS("mac");
        setActiveTab("mac");
      } else if (ua.includes("win")) {
        setDetectedOS("windows");
        setActiveTab("windows");
      }
    }
  }, []);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-1/3 -left-48 w-96 h-96 bg-purple-600/10 blur-3xl rounded-full" />
        <div className="absolute bottom-10 -right-48 w-96 h-96 bg-blue-600/10 blur-3xl rounded-full" />
      </div>

      {/* Navigation Header */}
      <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <WorkSightLogo variant="sidebar" />
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900/80 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all shadow-sm cursor-pointer"
              title="Copy download page link to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{copied ? "Link Copied!" : "Share Link"}</span>
            </button>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all shadow-sm shadow-blue-500/20"
            >
              <span>Admin Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full flex flex-col items-center">
        {/* Release Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-medium text-blue-400 mb-6 shadow-inner backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
          <span>WorkSight Agent v1.0.0 Now Available</span>
          <span className="w-1 h-1 rounded-full bg-blue-400" />
          <span className="text-zinc-400">Latest Release</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl font-extrabold text-center tracking-tight max-w-3xl text-balance">
          Download the{" "}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            WorkSight Agent
          </span>
        </h1>
        <p className="mt-4 text-center text-zinc-400 text-base sm:text-lg max-w-2xl text-balance leading-relaxed">
          Connect your workstation to your organization&apos;s WorkSight workspace. Seamless, secure, and privacy-governed workforce telemetry for macOS and Windows.
        </p>

        {/* Detected OS Callout */}
        {detectedOS !== "other" && (
          <div className="mt-6 text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 px-4 py-1.5 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Detected OS:{" "}
              <strong className="text-zinc-200 uppercase font-semibold">{detectedOS}</strong> — Recommended installer highlighted below
            </span>
          </div>
        )}

        {/* Download Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 w-full max-w-4xl">
          
          {/* Windows Card */}
          <div className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 transition-all duration-200 backdrop-blur-xl ${
            detectedOS === "windows"
              ? "border-blue-500/60 bg-gradient-to-b from-blue-950/30 via-zinc-900/90 to-zinc-900 shadow-xl shadow-blue-500/10 ring-1 ring-blue-500/30"
              : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80"
          }`}>
            {detectedOS === "windows" && (
              <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white shadow-md shadow-blue-600/30">
                Recommended for your device
              </span>
            )}
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-none">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Windows</h3>
                <p className="text-xs text-zinc-400">Windows 10 / 11 (64-bit)</p>
              </div>
            </div>

            <div className="mt-6 space-y-2.5 text-xs text-zinc-300 flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-none" />
                <span>Standard executable installer (.exe)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-none" />
                <span>Runs quietly in system tray with live status</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-none" />
                <span>Automatic startup on system login</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-800/80 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span>Format: Installer (.exe)</span>
                <span>Size: ~89 MB</span>
              </div>
              <a
                href={WIN_DOWNLOAD_URL}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white transition-all shadow-lg shadow-blue-600/25 group cursor-pointer"
              >
                <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
                <span>Download for Windows (.exe)</span>
              </a>
            </div>
          </div>

          {/* macOS Card */}
          <div className={`relative flex flex-col rounded-2xl border p-6 sm:p-8 transition-all duration-200 backdrop-blur-xl ${
            detectedOS === "mac"
              ? "border-indigo-500/60 bg-gradient-to-b from-indigo-950/30 via-zinc-900/90 to-zinc-900 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/30"
              : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80"
          }`}>
            {detectedOS === "mac" && (
              <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                Recommended for your device
              </span>
            )}
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-none">
                <Apple className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">macOS</h3>
                <p className="text-xs text-zinc-400">macOS 11+ (Apple Silicon & Intel)</p>
              </div>
            </div>

            <div className="mt-6 space-y-2.5 text-xs text-zinc-300 flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-none" />
                <span>Apple Disk Image package (.dmg)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-none" />
                <span>Native menu bar icon with connection pill</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-none" />
                <span>Universal binary (optimized for M1/M2/M3/M4 & Intel)</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-800/80 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
                <span>Format: Disk Image (.dmg)</span>
                <span>Size: ~261 MB</span>
              </div>
              <a
                href={MAC_DOWNLOAD_URL}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white transition-all shadow-lg shadow-indigo-600/25 group cursor-pointer"
              >
                <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
                <span>Download for macOS (.dmg)</span>
              </a>
            </div>
          </div>

        </div>

        {/* Monitoring Terms & Telemetry Disclosure Box */}
        <div className="mt-10 w-full max-w-4xl rounded-2xl border border-blue-900/40 bg-gradient-to-br from-blue-950/30 to-zinc-900/60 p-6 sm:p-7 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-none mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-white">Workforce Monitoring & Privacy Consent Notice</h4>
              <p className="mt-1.5 text-sm text-zinc-300 leading-relaxed">
                WorkSight is designed to collect workplace activity metrics for your organization during active working sessions. Monitored telemetry includes:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 text-xs text-zinc-400">
                <div className="flex items-center gap-2 bg-zinc-900/60 px-3 py-2 rounded-lg border border-zinc-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <span><strong>Browser Activity:</strong> Visited URLs &amp; tab titles</span>
                </div>
                <div className="flex items-center gap-2 bg-zinc-900/60 px-3 py-2 rounded-lg border border-zinc-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span><strong>Input Telemetry:</strong> Mouse time, clicks &amp; keystroke counts (no keylogging)</span>
                </div>
                <div className="flex items-center gap-2 bg-zinc-900/60 px-3 py-2 rounded-lg border border-zinc-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  <span><strong>Periodic Screenshots:</strong> Configured workstation captures</span>
                </div>
                <div className="flex items-center gap-2 bg-zinc-900/60 px-3 py-2 rounded-lg border border-zinc-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span><strong>App Telemetry:</strong> Active software &amp; session hours</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                <em>Upon initial launch, users must review and acknowledge these monitoring terms before proceeding to device activation.</em>
              </p>
            </div>
          </div>
        </div>

        {/* Enrollment Instructions Box */}
        <div className="mt-10 w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-7 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-none mt-0.5">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-white">Important: Connecting to your Organization</h4>
              <p className="mt-1 text-sm text-zinc-400 leading-relaxed">
                After installing, launch WorkSight Agent. When prompted, enter your{" "}
                <span className="text-zinc-200 font-medium">Organization Code</span> and{" "}
                <span className="text-zinc-200 font-medium">Employee ID</span> provided by your administrator.
                If you do not have these credentials, please reach out to your team administrator or manager.
              </p>
            </div>
          </div>
        </div>

        {/* Installation Instructions Tabbed Guide */}
        <div className="mt-12 w-full max-w-4xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-white">Installation Instructions</h3>
              <p className="text-xs text-zinc-400 mt-1">Step-by-step guidance for getting up and running</p>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
              <button
                onClick={() => setActiveTab("windows")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeTab === "windows"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Windows</span>
              </button>
              <button
                onClick={() => setActiveTab("mac")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeTab === "mac"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                <span>macOS</span>
              </button>
            </div>
          </div>

          {activeTab === "windows" ? (
            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-600/20 text-xs font-bold text-blue-400 border border-blue-500/30">
                  1
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-zinc-200">Download & Run Setup</h5>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Click the <strong>Download for Windows</strong> button above to get <code className="text-blue-400 bg-zinc-800 px-1 py-0.5 rounded">WorkSight-Agent-Setup-1.0.0.exe</code>. Once downloaded, double-click the file to open the setup wizard.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-600/20 text-xs font-bold text-blue-400 border border-blue-500/30">
                  2
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-zinc-200">SmartScreen Warning (First run)</h5>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    If Windows Defender SmartScreen displays a blue &ldquo;Windows protected your PC&rdquo; prompt, click <strong>More info</strong> and then click <strong>Run anyway</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-600/20 text-xs font-bold text-blue-400 border border-blue-500/30">
                  3
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-zinc-200">Activate Agent</h5>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    The WorkSight icon will appear in your system tray (bottom-right near the clock). Click it to enter your Organization Code and Employee ID to link your device.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-indigo-600/20 text-xs font-bold text-indigo-400 border border-indigo-500/30">
                  1
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-zinc-200">Download & Open DMG</h5>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Click <strong>Download for macOS</strong> to download <code className="text-indigo-400 bg-zinc-800 px-1 py-0.5 rounded">WorkSight-Agent-1.0.0.dmg</code>. Double-click the file to open the disk image.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-indigo-600/20 text-xs font-bold text-indigo-400 border border-indigo-500/30">
                  2
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-zinc-200">Drag to Applications</h5>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    In the window that opens, drag the <strong>WorkSight Agent</strong> icon into the <strong>Applications</strong> shortcut folder. Once copied, eject the disk image.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30">
                <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-indigo-600/20 text-xs font-bold text-indigo-400 border border-indigo-500/30">
                  3
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-zinc-200">Launch & Grant Permissions</h5>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Launch WorkSight Agent from Applications. macOS will prompt you to grant <strong>Accessibility</strong> and <strong>Screen Recording</strong> permissions in <em>System Settings &rarr; Privacy &amp; Security</em> to enable accurate activity tracking.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security & Privacy Commitment */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 text-xs text-zinc-400 w-full max-w-4xl">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-none" />
            <span>
              <strong>Enterprise Privacy Protection:</strong> WorkSight only collects activity permitted by your organization&apos;s configured governance policies.
            </span>
          </div>
          <a
            href="https://github.com/vicky9790/Workflowtracker-Agent/releases/tag/v1.0.0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-zinc-300 hover:text-white underline underline-offset-4 flex-none"
          >
            <span>View Release on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} ZoFlowX WorkSight. All rights reserved.</span>
          <span className="font-mono text-[11px] text-zinc-600">Agent Release v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
