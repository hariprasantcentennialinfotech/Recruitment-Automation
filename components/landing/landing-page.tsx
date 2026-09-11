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
  Play,
  Check,
  Search,
  Briefcase,
  SlidersHorizontal,
  X,
  Building2,
  ExternalLink,
  Layers,
  FileText
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
  const [searchQuery, setSearchQuery] = useState('')

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
      a: 'Once configured with your root Google Drive folder and designated job subfolders, our background runner polls the folder at your selected interval (every 5, 10, 15, 30, or 60 minutes) or immediately via the "Run Once" action. It identifies newly uploaded resumes, extracts the details, and avoids re-processing existing candidates.',
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 selection:bg-sky-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-gradient-to-tr from-sky-200/40 via-blue-100/30 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -left-48 size-[500px] rounded-full bg-cyan-100/30 blur-3xl" />
        <div className="absolute top-2/3 -right-48 size-[500px] rounded-full bg-blue-100/25 blur-3xl" />
      </div>

      {/* Floating Header as seen in the theme screenshot */}
      <div className="sticky top-0 z-40 px-4 pt-3 pb-2">
        <header className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-slate-200/80 bg-white/95 px-6 py-3.5 shadow-xs backdrop-blur-md">
          {/* Logo & Website Title */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Centennial Logo"
              className="h-8 w-auto object-contain"
            />
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                Centennial
              </span>
              <span className="text-xl font-extrabold tracking-tight text-[#0284c7]">
                Recruitment Automation
              </span>
            </div>
          </div>

          {/* Navigation Links with active underline style */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a
              href="#search-bar"
              className="relative py-1 text-[#0284c7] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[#0284c7]"
            >
              Overview
            </a>
            <a href="#features" className="py-1 transition hover:text-[#0284c7]">
              Features
            </a>
            <a href="#pipeline" className="py-1 transition hover:text-[#0284c7]">
              Pipeline Demo
            </a>
            <a href="#pricing" className="py-1 transition hover:text-[#0284c7]">
              Credits & Pricing
            </a>
            <a href="#faq" className="py-1 transition hover:text-[#0284c7]">
              FAQ
            </a>
          </nav>

          {/* Authentication Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => openAuth('signin')}
              className="text-sm font-bold text-slate-700 transition hover:text-[#0284c7] px-3 py-1.5"
            >
              Sign In
            </button>
            <button
              onClick={() => openAuth('signup')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0284c7] px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-500/20 transition hover:bg-[#0369a1] hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section className="relative px-6 pt-14 pb-12 lg:pt-20 lg:pb-16 text-center">
        <div className="mx-auto max-w-4xl">
          {/* Eyebrow badge styled exactly like the screenshot */}
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 border border-sky-200/80 px-4 py-1.5 text-xs font-extrabold text-[#0284c7] tracking-wider uppercase shadow-2xs mb-6">
            <span className="size-1.5 rounded-full bg-[#0284c7]" />
            <span>DISCOVER AUTONOMOUS RECRUITMENT AUTOMATION</span>
          </div>

          {/* Headline matching screenshot typography */}
          <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-6xl lg:text-7xl leading-tight">
            Recruitment <span className="text-[#0284c7]">Automation</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Where talent sourcing learns, grows, and connects with opportunities at Centennial through intelligent Google Gemini AI.
          </p>

          {/* Floating Pill Search & Filter Bar as shown in the user screenshot */}
          <div id="search-bar" className="mx-auto mt-9 max-w-3xl">
            <div className="flex flex-col sm:flex-row items-center rounded-2xl sm:rounded-full border border-slate-200 bg-white p-2 sm:p-2.5 shadow-md shadow-slate-200/50">
              {/* Search Input */}
              <div className="relative flex-1 w-full sm:w-auto px-4 py-2 sm:py-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by role, company, or skills (e.g. Salesforce PM, UI Designer)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent pl-7 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none"
                />
              </div>

              {/* Divider */}
              <div className="hidden sm:block h-6 w-[1px] bg-slate-200" />

              {/* Categories */}
              <div className="flex items-center gap-2 px-4 py-2 sm:py-0 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer w-full sm:w-auto justify-between sm:justify-start">
                <Briefcase className="size-4 text-slate-400" />
                <span>All Categories</span>
              </div>

              {/* Divider */}
              <div className="hidden sm:block h-6 w-[1px] bg-slate-200" />

              {/* Filter Types */}
              <div className="flex items-center gap-2 px-4 py-2 sm:py-0 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer w-full sm:w-auto justify-between sm:justify-start">
                <SlidersHorizontal className="size-4 text-slate-400" />
                <span>All Types</span>
              </div>

              {/* Action Button */}
              <button
                onClick={() => openAuth('signup')}
                className="w-full sm:w-auto rounded-xl sm:rounded-full bg-[#0284c7] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0369a1] transition"
              >
                Search
              </button>
            </div>
          </div>

          {/* Quick Stats / Trust Indicators */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" /> Google Drive Folder Watcher
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" /> Multimodal Gemini 2.0 AI
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" /> Custom Sheet Column Mapping
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" /> 6 Credits / Resume
            </span>
          </div>
        </div>

        {/* Live Interactive Pipeline Visualizer (Light Centennial Theme) */}
        <div id="pipeline" className="mx-auto mt-14 max-w-5xl text-left">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <span className="flex size-3 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Live Autonomous Workflow Engine
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-slate-700">Watch Interval: 5 mins</span>
                <span className="rounded-md bg-sky-50 border border-sky-100 px-2.5 py-1 font-mono text-[#0284c7] font-bold">Cost: 6 Credits / sync</span>
              </div>
            </div>

            {/* Workflow 4-step pipeline */}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {/* Step 1 */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-sky-100 text-[#0284c7]">
                    <FolderSync className="size-4" />
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-400">01</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900">Drive Watcher</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Monitors root job subfolders for newly uploaded resumes.
                </p>
                <div className="mt-3 rounded-lg bg-white p-2 text-[11px] font-mono text-slate-700 border border-slate-200">
                  📁 /Salesforce-PM/resumes
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                    <Cpu className="size-4" />
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-400">02</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900">Gemini AI Parser</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Extracts candidate details with automatic model fallbacks.
                </p>
                <div className="mt-3 rounded-lg bg-white p-2 text-[11px] font-mono text-purple-700 border border-purple-200">
                  ⚡ gemini-flash-latest
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="size-4" />
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-400">03</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900">Anti-Hallucination</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Validates candidate names and verifies duplicate sheet rows.
                </p>
                <div className="mt-3 rounded-lg bg-white p-2 text-[11px] font-mono text-emerald-700 border border-emerald-200">
                  ✓ Verified: Shakir Imran
                </div>
              </div>

              {/* Step 4 */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-sky-100 text-[#0284c7]">
                    <Table className="size-4" />
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-400">04</span>
                </div>
                <h4 className="mt-3 text-sm font-bold text-slate-900">Dynamic Sheet Sync</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Fills designated columns (Name, Phone, Email, Missing Skills).
                </p>
                <div className="mt-3 rounded-lg bg-white p-2 text-[11px] font-mono text-sky-700 border border-sky-200">
                  📊 Row Synced + 6 Credits
                </div>
              </div>
            </div>

            {/* Candidate Card Preview */}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#0284c7] font-bold text-white text-sm shadow-xs">
                    SI
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900">Shakir Imran</h5>
                    <p className="text-xs text-slate-500">Senior Salesforce Project Manager · 12 yrs experience</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-100 border border-emerald-300/60 px-3 py-1 text-xs font-bold text-emerald-800">
                    94% JD Match
                  </span>
                  <span className="rounded-full bg-sky-100 border border-sky-300/60 px-3 py-1 text-xs font-bold text-[#0284c7]">
                    Auto-Synced
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4 text-xs font-mono">
                <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-sans font-semibold">PHONE</span>
                  <span className="text-slate-800 font-bold">+1 (416) 555-0198</span>
                </div>
                <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-sans font-semibold">EMAIL</span>
                  <span className="text-slate-800 font-bold">shakir.imran@example.com</span>
                </div>
                <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-sans font-semibold">ADDRESS / LOCATION</span>
                  <span className="text-slate-800 font-bold">Toronto, ON, Canada</span>
                </div>
                <div className="rounded-xl bg-white p-3 border border-slate-200 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-sans font-semibold">MISSING SKILLS</span>
                  <span className="text-amber-600 font-sans font-semibold">Salesforce CPQ (Minor)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative px-6 py-16 border-t border-slate-200/80 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="rounded-full bg-sky-50 border border-sky-200 px-3.5 py-1 text-xs font-bold text-[#0284c7] uppercase tracking-wider">
              Engine Capabilities
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900">
              Engineered for Speed, Precision, and Zero Maintenance
            </h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base">
              Say goodbye to manual resume screening. Our RaaS stack gives recruiting agencies and enterprises end-to-end automation.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feat) => {
              const Icon = feat.icon
              return (
                <div
                  key={feat.title}
                  className="group relative rounded-2xl border border-slate-200 bg-white p-6 transition duration-200 hover:border-[#0284c7]/50 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-[#0284c7] group-hover:bg-[#0284c7] group-hover:text-white transition">
                      <Icon className="size-5" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-[#0284c7] transition">
                    {feat.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing / Credits Economics */}
      <section id="pricing" className="relative px-6 py-16 border-t border-slate-200/80 bg-[#f8fafc]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-sky-50 border border-sky-200 px-3.5 py-1 text-xs font-bold text-[#0284c7] uppercase tracking-wider">
              Transparent Credit Economics
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900">
              6 Credits per Resume. No Hidden Fees.
            </h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base">
              Every resume parsed, matched to JD requirements, and synchronized into your tracking sheet costs exactly 6 credits.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {/* Starter Plan */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 flex flex-col justify-between shadow-xs">
              <div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Starter Recruiter
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">$299</span>
                  <span className="text-slate-500 text-sm font-medium">/month</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Ideal for boutique staffing agencies sourcing up to 5 active positions.
                </p>

                <div className="my-6 border-t border-slate-100 pt-6 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span><strong>1,800 Credits</strong> (300 Resumes)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>Up to 5 Active Job Workspaces</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>15-Minute Sync Intervals</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>Google Sheets 2-Way Sync</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openAuth('signup')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
              >
                Choose Starter
              </button>
            </div>

            {/* Growth Plan (Featured) */}
            <div className="relative rounded-3xl border-2 border-[#0284c7] bg-white p-7 flex flex-col justify-between shadow-lg shadow-sky-100">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#0284c7] px-4 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                Most Popular
              </div>

              <div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-[#0284c7]">
                  Agency Growth
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">$799</span>
                  <span className="text-slate-500 text-sm font-medium">/month</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  For growing recruiting teams handling up to 20 continuous roles.
                </p>

                <div className="my-6 border-t border-slate-100 pt-6 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span><strong>6,000 Credits</strong> (1,000 Resumes)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>Up to 20 Active Job Folders</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>5-Minute High-Frequency Sync</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>Dynamic Custom Column Extractor</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>Super Admin Credit Allocation</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openAuth('signup')}
                className="w-full rounded-xl bg-[#0284c7] py-3 text-sm font-bold text-white shadow-md shadow-sky-500/25 transition hover:bg-[#0369a1] hover:scale-[1.01]"
              >
                Start Free Trial
              </button>
            </div>

            {/* Enterprise Plan */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 flex flex-col justify-between shadow-xs">
              <div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  Enterprise RaaS
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">$1,499</span>
                  <span className="text-slate-500 text-sm font-medium">/month</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Full white-labeled multi-tenant solution with custom quotas.
                </p>

                <div className="my-6 border-t border-slate-100 pt-6 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span><strong>15,000+ Credits</strong> (2,500+ Resumes)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>Unlimited Active Roles</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>Real-time Ingestion Watcher</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="size-4 text-[#0284c7]" />
                    <span>White-Label Branding & Domains</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openAuth('signup')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
              >
                Contact Enterprise
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative px-6 py-16 border-t border-slate-200/80 bg-white">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="rounded-full bg-sky-50 border border-sky-200 px-3.5 py-1 text-xs font-bold text-[#0284c7] uppercase tracking-wider">
              Got Questions?
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-white transition overflow-hidden shadow-2xs"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-slate-900 transition hover:bg-slate-50"
                  >
                    <span>{faq.q}</span>
                    <ChevronRight
                      className={`size-4 text-slate-400 transition-transform ${
                        isOpen ? 'rotate-90 text-[#0284c7]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Final Conversion CTA */}
      <section className="relative px-6 py-16 border-t border-slate-200 bg-gradient-to-r from-sky-600 to-blue-700 text-white text-center">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-extrabold sm:text-5xl tracking-tight">
            Ready to Automate Your Hiring Workflow?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-sky-100 leading-relaxed">
            Connect your Google Drive and candidate Google Sheet in 60 seconds. Experience zero-maintenance recruiting automation today.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => openAuth('signup')}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-extrabold text-[#0284c7] shadow-lg transition hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Get Started Now</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Centennial Logo" className="h-6 w-auto object-contain" />
            <span className="font-bold text-slate-800">Centennial Recruitment Automation</span>
            <span>·</span>
            <span>© 2026 Centennial Infotech</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#pipeline" className="hover:text-slate-900">Pipeline Demo</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
            {onOpenAdminLogin && (
              <button
                onClick={onOpenAdminLogin}
                className="text-[#0284c7] hover:underline font-bold"
              >
                Super Admin Login
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute -top-3 -right-3 z-10 flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-100 hover:text-slate-900"
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
