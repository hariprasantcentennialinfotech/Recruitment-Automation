'use client'

import { useState } from 'react'
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FolderSync,
  Table,
  ShieldCheck,
  Zap,
  Coins,
  ChevronRight,
  ExternalLink,
  Layers,
  Search,
  Users,
  FileCheck,
  Clock,
  Building2,
  X,
  Play,
  Check
} from 'lucide-react'
import { SignupCard } from '@/components/auth/signup-card'

interface LandingPageProps {
  onAuthSuccess: (user: any) => void
  onOpenAdminLogin?: () => void
}

export function LandingPage({ onAuthSuccess, onOpenAdminLogin }: LandingPageProps) {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup')
  const [activeFaq, setActiveFaq] = useState<number | null>(null)

  const openAuth = (mode: 'signup' | 'signin') => {
    setAuthMode(mode)
    setAuthModalOpen(true)
  }

  const features = [
    {
      icon: FolderSync,
      title: 'Google Drive Auto-Watcher',
      description:
        'Continuously monitors designated Drive subfolders at configured intervals (e.g. every 5 mins) or on-demand "Run Once" triggers.',
      badge: 'Continuous Sync',
    },
    {
      icon: Cpu,
      title: 'Multimodal Gemini AI Engine',
      description:
        'Resilient extraction across PDF, DOCX, and scanned text with automatic multi-tier model fallbacks (gemini-flash-latest, 3.7, 3.8).',
      badge: '99.9% Model Uptime',
    },
    {
      icon: Table,
      title: 'Dynamic Google Sheets Mapping',
      description:
        'Intelligently reads your existing candidate tracker columns and maps extracted candidate data directly into the exact matching cells.',
      badge: 'Zero Schema Drift',
    },
    {
      icon: ShieldCheck,
      title: 'Anti-Hallucination Verification',
      description:
        'Multi-pass validation prevents parsing errors—candidate names are verified before syncing and never mistaken for section headers.',
      badge: 'Verified Accuracy',
    },
    {
      icon: Coins,
      title: 'Granular Credits Engine',
      description:
        'Transparent 6 credits consumed per processed resume. Enterprise Super Admin portal allows 1-click batch credit replenishment.',
      badge: '6 Credits / Resume',
    },
    {
      icon: Building2,
      title: 'Multi-Tenant B2B Isolation',
      description:
        'Manage individual client company workspaces with customized branding, dedicated candidate pipelines, and quota thresholds.',
      badge: 'White-Label Ready',
    },
  ]

  const faqs = [
    {
      q: 'How does the Google Drive ingestion watcher work?',
      a: 'Once configured with your root Google Drive folder and designated job subfolders, our background runner polls the folder at your selected interval (every 5, 15, 30, or 60 minutes) or immediately via the "Run Once" action. It identifies newly uploaded resumes, extracts the details, and avoids re-processing existing candidates.',
    },
    {
      q: 'How does the 6-credit billing system work?',
      a: 'Each candidate resume that is successfully extracted and synchronized into your candidate tracker consumes exactly 6 credits from your organization account. Administrators can top up individual recruiters or grant bulk credits (e.g. +1,000 credits to all users) directly from the Super Admin portal.',
    },
    {
      q: 'Can I customize which columns get populated in Google Sheets?',
      a: 'Yes! In the Discovered Positions section, you can select which sheet tab and specific columns to retrieve (e.g., Name, Phone, Email, Address, Missing Skills, Match Score). Gemini dynamically structures the output to match your sheet structure.',
    },
    {
      q: 'What happens if a Google Gemini model reaches rate limits?',
      a: 'Our architecture employs an intelligent multi-model fallback cascade. If gemini-flash-latest hits a 429 rate limit or 503 server overload, the request immediately reroutes to backup models (gemini-3.7-flash, gemini-3.8-flash, etc.) without failing the workflow.',
    },
    {
      q: 'How does the system prevent extracting headers like "Highlight of Qualifications" as the candidate name?',
      a: 'We implement rigorous prompt guards and candidate name sanitization. Gemini specifically inspects contact blocks, email usernames, and resume top-level metadata, validating that section titles and skill headers are never mistaken for personal names.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -left-48 size-[500px] rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute top-2/3 -right-48 size-[500px] rounded-full bg-emerald-600/10 blur-3xl" />
      </div>

      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090e]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-md shadow-indigo-500/20">
              <Sparkles className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-lg">TalentFlow AI</span>
                <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/30">
                  RaaS Engine
                </span>
              </div>
              <p className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                Centennial Infotech
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#pipeline" className="transition hover:text-white">
              Pipeline Demo
            </a>
            <a href="#workflow" className="transition hover:text-white">
              How It Works
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Credits & Pricing
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openAuth('signin')}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5 hover:text-white"
            >
              Sign In
            </button>
            <button
              onClick={() => openAuth('signup')}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-20 pb-16 lg:pt-28 lg:pb-24">
        <div className="mx-auto max-w-5xl text-center">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 backdrop-blur-md mb-8">
            <Sparkles className="size-3.5 text-indigo-400" />
            <span>Autonomous Recruitment as a Service (RaaS)</span>
            <span className="text-white/30">•</span>
            <span className="text-emerald-400 font-bold">6 Credits / Resume</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-white">Eliminate Manual Sourcing with </span>
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Autonomous AI Ingestion
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-300 sm:text-xl font-normal leading-relaxed">
            Continuously watch Google Drive folders, extract candidate profiles with multi-tier Google Gemini models, match JD requirements, and sync customized columns to Google Sheets automatically.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => openAuth('signup')}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/30 transition hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Start Free 14-Day Trial</span>
              <ArrowRight className="size-5" />
            </button>

            <a
              href="#pipeline"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-base font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
            >
              <Play className="size-4 text-indigo-400 fill-indigo-400" />
              <span>Explore Live Flow</span>
            </a>
          </div>

          {/* Social Proof / Integrations */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" /> Google Drive Folder Watcher
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" /> Google Gemini 2.0 & Flash
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" /> Custom Sheet Column Mapping
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" /> MongoDB Atlas Multi-Tenant
            </span>
          </div>
        </div>

        {/* Live Interactive Pipeline Visualizer */}
        <div id="pipeline" className="mx-auto mt-16 max-w-6xl">
          <div className="relative rounded-3xl border border-white/15 bg-white/[0.03] p-6 shadow-2xl backdrop-blur-2xl sm:p-8 lg:p-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <span className="flex size-3 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Live Autonomous Workflow Engine
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded-md bg-white/5 px-2.5 py-1 font-mono">Watch Interval: 5 mins</span>
                <span className="rounded-md bg-indigo-500/20 px-2.5 py-1 font-mono text-indigo-300">Cost: 6 Credits / sync</span>
              </div>
            </div>

            {/* Workflow 4-step interactive pipeline */}
            <div className="grid gap-6 md:grid-cols-4">
              {/* Step 1 */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <FolderSync className="size-4" />
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">01</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-white">Drive Folder Watcher</h4>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Monitors root job folders for new PDF/DOCX resumes automatically.
                </p>
                <div className="mt-3 rounded-lg bg-black/40 p-2 text-[11px] font-mono text-slate-300 border border-white/5">
                  📁 /Salesforce-PM/resumes
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                    <Cpu className="size-4" />
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">02</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-white">Gemini Multimodal AI</h4>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Parses complex layouts & OCR with multi-tier fallback resilience.
                </p>
                <div className="mt-3 rounded-lg bg-black/40 p-2 text-[11px] font-mono text-purple-300 border border-white/5">
                  ⚡ gemini-flash-latest
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="size-4" />
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">03</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-white">Anti-Hallucination</h4>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Validates real candidate names and verifies Google Sheet duplicate rows.
                </p>
                <div className="mt-3 rounded-lg bg-black/40 p-2 text-[11px] font-mono text-emerald-300 border border-white/5">
                  ✓ Verified: Shakir Imran
                </div>
              </div>

              {/* Step 4 */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
                    <Table className="size-4" />
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">04</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-white">Dynamic Sheet Sync</h4>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Populates designated columns (Name, Phone, Email, Missing Skills).
                </p>
                <div className="mt-3 rounded-lg bg-black/40 p-2 text-[11px] font-mono text-pink-300 border border-white/5">
                  📊 Row Synced + 6 Credits
                </div>
              </div>
            </div>

            {/* Real Candidate Preview Simulation */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/50 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white text-sm">
                    SI
                  </div>
                  <div>
                    <h5 className="font-bold text-white">Shakir Imran</h5>
                    <p className="text-xs text-slate-400">Senior Salesforce Project Manager · 12 yrs exp</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
                    94% JD Match
                  </span>
                  <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-xs font-bold text-indigo-300">
                    Auto-Synced
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4 text-xs font-mono">
                <div className="rounded-lg bg-white/[0.02] p-2.5 border border-white/5">
                  <span className="text-slate-500 block text-[10px]">PHONE</span>
                  <span className="text-slate-200">+1 (416) 555-0198</span>
                </div>
                <div className="rounded-lg bg-white/[0.02] p-2.5 border border-white/5">
                  <span className="text-slate-500 block text-[10px]">EMAIL</span>
                  <span className="text-slate-200">shakir.imran@example.com</span>
                </div>
                <div className="rounded-lg bg-white/[0.02] p-2.5 border border-white/5">
                  <span className="text-slate-500 block text-[10px]">ADDRESS / LOCATION</span>
                  <span className="text-slate-200">Toronto, ON, Canada</span>
                </div>
                <div className="rounded-lg bg-white/[0.02] p-2.5 border border-white/5">
                  <span className="text-slate-500 block text-[10px]">MISSING SKILLS</span>
                  <span className="text-amber-400 font-sans">Salesforce CPQ (Minor)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative px-6 py-20 border-t border-white/10 bg-white/[0.01]">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-3.5 py-1 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Engine Capabilities
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Engineered for Speed, Precision, and Zero Maintenance
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Say goodbye to messy resume parsing APIs. Our RaaS stack gives recruiting agencies and enterprises end-to-end automation.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feat) => {
              const Icon = feat.icon
              return (
                <div
                  key={feat.title}
                  className="group relative rounded-3xl border border-white/10 bg-white/[0.02] p-7 transition duration-300 hover:border-indigo-500/40 hover:bg-white/[0.04] hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition">
                      <Icon className="size-6" />
                    </span>
                    <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400 border border-white/10">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white group-hover:text-indigo-300 transition">
                    {feat.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 3-Step Workflow */}
      <section id="workflow" className="relative px-6 py-20 border-t border-white/10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-3.5 py-1 text-xs font-bold text-purple-400 uppercase tracking-wider">
              Simple 3-Step Setup
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Launch an Autonomous Ingestion Pipeline in Minutes
            </h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white text-lg">
                1
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">Connect Drive & JD</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Provide your Google Drive root folder. The system auto-discovers job folders and matches JD DOCX files.
              </p>
            </div>

            <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-600 font-bold text-white text-lg">
                2
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">Select Columns & Interval</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Choose which sheet columns to populate and set your active sync interval (e.g. every 5 minutes or run once).
              </p>
            </div>

            <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-emerald-500 font-bold text-white text-lg">
                3
              </div>
              <h3 className="mt-6 text-lg font-bold text-white">Live Candidate Sync</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Candidates are extracted with multi-tier Gemini AI, deduplicated against existing rows, and appended seamlessly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Credits & Pricing Section */}
      <section id="pricing" className="relative px-6 py-20 border-t border-white/10 bg-white/[0.01]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto">
            <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 text-xs font-bold text-amber-400 uppercase tracking-wider">
              Transparent Credit Economics
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              6 Credits per Resume. No Hidden Fees.
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Every resume parsed, matched to JD requirements, and synchronized into your tracking sheet costs exactly 6 credits.
            </p>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-3">
            {/* Starter Plan */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 flex flex-col justify-between">
              <div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                  Starter Recruiter
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">$299</span>
                  <span className="text-slate-400 text-sm">/month</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Ideal for boutique staffing agencies sourcing 5 active positions.
                </p>

                <div className="my-6 border-t border-white/10 pt-6 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span><strong>1,800 Credits</strong> (300 Resumes)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>Up to 5 Active Job Workspaces</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>15-Minute Sync Intervals</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>Google Sheets 2-Way Sync</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openAuth('signup')}
                className="w-full rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Choose Starter
              </button>
            </div>

            {/* Growth Plan (Highlighted) */}
            <div className="relative rounded-3xl border-2 border-indigo-500 bg-gradient-to-b from-indigo-950/40 via-purple-950/20 to-black/40 p-8 flex flex-col justify-between shadow-2xl shadow-indigo-500/20">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md">
                Most Popular
              </div>

              <div>
                <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
                  Agency Growth
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">$799</span>
                  <span className="text-slate-400 text-sm">/month</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  For growing recruiting teams handling up to 20 continuous roles.
                </p>

                <div className="my-6 border-t border-white/10 pt-6 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span><strong>6,000 Credits</strong> (1,000 Resumes)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>Up to 20 Active Job Folders</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>5-Minute High-Frequency Sync</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>Dynamic Custom Column Extractor</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>Super Admin Credit Delegation</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openAuth('signup')}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/50 hover:scale-[1.01]"
              >
                Start Free Trial
              </button>
            </div>

            {/* Enterprise Plan */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 flex flex-col justify-between">
              <div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                  Enterprise RaaS
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">$1,499</span>
                  <span className="text-slate-400 text-sm">/month</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Full white-labeled multi-tenant solution with dedicated model rate limits.
                </p>

                <div className="my-6 border-t border-white/10 pt-6 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span><strong>15,000+ Credits</strong> (2,500+ Resumes)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>Unlimited Active Roles</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>Real-time Ingestion Watcher</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>White-Label Branding & Custom Domains</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-emerald-400" />
                    <span>Dedicated Priority Gemini Tier</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openAuth('signup')}
                className="w-full rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Contact Enterprise
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative px-6 py-20 border-t border-white/10">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-3.5 py-1 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Got Questions?
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="mt-12 space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] transition overflow-hidden"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between p-6 text-left text-base font-semibold text-white transition hover:bg-white/[0.02]"
                  >
                    <span>{faq.q}</span>
                    <ChevronRight
                      className={`size-5 text-slate-400 transition-transform ${
                        isOpen ? 'rotate-90 text-indigo-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-sm text-slate-300 leading-relaxed border-t border-white/5 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Final Conversion Banner */}
      <section className="relative px-6 py-20 border-t border-white/10 overflow-hidden">
        <div className="mx-auto max-w-5xl rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-pink-950/40 p-10 sm:p-16 text-center relative shadow-2xl">
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
              Ready to Automate Your Hiring Workflow?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 leading-relaxed">
              Connect your Google Drive and candidate Google Sheet in 60 seconds. Experience zero-maintenance recruiting automation today.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => openAuth('signup')}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-slate-900 shadow-xl transition hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Get Started Now</span>
                <ArrowRight className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#040609] py-10 px-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">TalentFlow AI</span>
            <span>·</span>
            <span>Centennial Infotech © 2026</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-slate-300">Features</a>
            <a href="#pipeline" className="hover:text-slate-300">Pipeline Demo</a>
            <a href="#pricing" className="hover:text-slate-300">Pricing</a>
            {onOpenAdminLogin && (
              <button
                onClick={onOpenAdminLogin}
                className="text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Super Admin Login
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md animate-in fade-in zoom-in duration-200">
            {/* Close button */}
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute -top-3 -right-3 z-10 flex size-9 items-center justify-center rounded-full border border-white/20 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <X className="size-4" />
            </button>

            <SignupCard
              initialMode={authMode}
              onSuccess={(user) => {
                setAuthModalOpen(false)
                onAuthSuccess(user)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
