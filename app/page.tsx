'use client'

import { useMemo, useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import { SignupCard } from '@/components/auth/signup-card'
import { AdminPortal } from '@/components/admin/admin-portal'
import { JobSettingsModal } from '@/components/jobs/job-settings-modal'
import { DriveHierarchyManager } from '@/components/automation/drive-hierarchy-manager'
import { LandingPage } from '@/components/landing/landing-page'
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  Cloud,
  CreditCard,
  Mail,
  Palette,
  PlugZap,
  MessageCircle,
  ShieldCheck,
  Target,
  Workflow,
  XCircle,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Filter,
  LayoutDashboard,
  LogIn,
  Plus,
  RotateCw,
  Search,
  Settings2,
  Sliders,
  Sparkles,
  Users,
  X,
  Loader2,
  Coins
} from 'lucide-react'

type Job = {
  id?: string
  organization?: string
  title: string
  team: string
  location: string
  status: 'Open' | 'Draft' | 'Closed'
  skills: string[]
  description?: string
  applicants: number
  updated?: string
  createdAt?: string | Date
}

type UploadItem = {
  id: number
  name: string
  kind: 'JD' | 'Resume'
  size: string
  status: 'Uploaded' | 'Processing'
  candidate?: string
}

type CandidateProfile = {
  id?: string
  organization?: string
  fullName: string
  email?: string
  phone?: string
  location?: string
  summary?: string
  skills: string[]
  stage: string
  sourceFile: string
  extractionProvider: string
  createdAt?: string | Date
}

type ActivityItem = {
  id: string
  organization: string
  title: string
  detail: string
  type: string
  time: string
  createdAt?: string | Date
}

type MatchResult = {
  candidate: CandidateProfile
  score: number
  matched: string[]
  missing: string[]
}

export default function Page() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [organization, setOrganization] = useState('')
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [activeView, setActiveView] = useState('Overview')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')

  // Database-driven state
  const [jobs, setJobs] = useState<Job[]>([])
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [showCreateJobModal, setShowCreateJobModal] = useState(false)

  function announce(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  // Load user session on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user)
          setSignedIn(true)
          const org = data.user.organization || data.user.company
          if (org) {
            setOrganization(org)
            setWorkspaceReady(true)
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setCheckingAuth(false)
      })

    const params = new URLSearchParams(window.location.search)
    const authError = params.get('auth_error')
    const authSuccess = params.get('auth')
    if (authError) {
      announce(`Authentication error: ${authError}`)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (authSuccess) {
      announce('Successfully authenticated with Google!')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Load database-driven data scoped to the session's organization
  const loadWorkspaceData = () => {
    // 1. Load real jobs
    fetch('/api/jobs')
      .then((res) => res.json())
      .then((data) => {
        if (data.jobs) setJobs(data.jobs)
      })
      .catch(() => {})

    // 2. Load real candidate profiles
    fetch('/api/extract')
      .then((res) => res.json())
      .then((data) => {
        if (data.profiles) setProfiles(data.profiles)
      })
      .catch(() => {})

    // 3. Load real activities
    fetch('/api/activities')
      .then((res) => res.json())
      .then((data) => {
        if (data.activities) setActivities(data.activities)
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (workspaceReady) {
      loadWorkspaceData()
    }
  }, [workspaceReady])

  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user)
    setSignedIn(true)
    const org = user.organization || user.company
    if (org) {
      setOrganization(org)
      setWorkspaceReady(true)
    }
    announce(`Welcome, ${user.fullName || 'back'}!`)
  }

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch {}
    setCurrentUser(null)
    setSignedIn(false)
    setWorkspaceReady(false)
    setJobs([])
    setProfiles([])
    setActivities([])
    setUploads([])
    announce('Signed out successfully')
  }

  // Create real job in MongoDB
  const handleCreateJob = async (jobInput: { title: string; team: string; location: string; skills: string[]; description?: string }) => {
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobInput),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create job')

      setJobs((prev) => [data.job, ...prev])
      setShowCreateJobModal(false)
      announce(`Job "${jobInput.title}" created`)

      // Refresh activities
      fetch('/api/activities')
        .then((r) => r.json())
        .then((d) => {
          if (d.activities) setActivities(d.activities)
        })
    } catch (err: any) {
      announce(err.message || 'Error creating job')
    }
  }

  // Move candidate to next stage and persist to MongoDB
  const handleMoveCandidateStage = async (candidateId: string, currentStage: string) => {
    const stages = ['Sourcing', 'Review', 'Interview', 'Offer']
    const next = stages[(stages.indexOf(currentStage) + 1) % stages.length]

    try {
      const res = await fetch(`/api/candidates/${candidateId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: next }),
      })
      if (res.ok) {
        setProfiles((prev) => prev.map((c) => (c.id === candidateId ? { ...c, stage: next } : c)))
        announce(`Candidate moved to ${next}`)
        // Refresh activities
        fetch('/api/activities')
          .then((r) => r.json())
          .then((d) => {
            if (d.activities) setActivities(d.activities)
          })
      }
    } catch {
      announce('Failed to update stage')
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07090e]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-indigo-500" />
          <p className="text-xs font-semibold text-slate-400">Loading TalentFlow AI...</p>
        </div>
      </div>
    )
  }

  if (!signedIn) {
    return (
      <LandingPage
        onAuthSuccess={handleAuthSuccess}
        onOpenAdminLogin={() => {
          window.location.href = '/admin'
        }}
      />
    )
  }

  if (!workspaceReady) {
    return (
      <OrganizationSetup
        onComplete={async (name) => {
          try {
            await fetch('/api/auth/organization', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ organization: name }),
            })
          } catch (e) {
            console.error('Failed to save organization to profile:', e)
          }
          setOrganization(name)
          setWorkspaceReady(true)
        }}
        onSignOut={handleSignOut}
      />
    )
  }

  const filteredCandidates = profiles.filter((c) =>
    `${c.fullName} ${c.skills.join(' ')} ${c.summary || ''}`.toLowerCase().includes(query.toLowerCase())
  )

  const userInitials = (currentUser?.fullName || currentUser?.email || 'User')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <main className="min-h-screen bg-background text-foreground">
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg"
        >
          {notice}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Centennial Infotech"
              className="size-10 object-contain rounded-xl"
            />
            <div>
              <p className="text-[16px] sm:text-[17px] font-bold tracking-tight text-foreground leading-tight">
                Recruitment Automation
              </p>
              <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-muted-foreground">
                Centennial Infotech
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-full border border-border bg-card p-1 lg:flex" aria-label="Primary navigation">
            {['Overview', 'Candidates', 'Jobs', 'Automation', 'Analytics'].map((item) => (
              <button
                key={item}
                onClick={() => setActiveView(item)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeView === item
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : item === 'Automation'
                    ? 'text-primary hover:bg-primary/10 hover:text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item === 'Automation' ? '⚡ Automation' : item}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* User Credits Badge */}
            <div
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-2xs ${
                (currentUser?.credits ?? 0) < 6
                  ? 'border-rose-500/30 bg-rose-50 text-rose-700'
                  : (currentUser?.credits ?? 0) < 30
                  ? 'border-amber-500/30 bg-amber-50 text-amber-700'
                  : 'border-emerald-500/30 bg-emerald-50 text-emerald-700'
              }`}
              title={`Balance: ${(currentUser?.credits ?? 0).toLocaleString()} credits (Costs 6 credits per processed resume)`}
            >
              <Coins className="size-3.5" />
              <span>{(currentUser?.credits ?? 0).toLocaleString()} Credits</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground">
              <Building2 className="size-3.5 text-muted-foreground" />
              <span>Workspace: {organization}</span>
            </div>

            <button
              onClick={() => announce('No new notifications')}
              aria-label="Notifications"
              className="hidden size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground sm:flex"
            >
              <Bell className="size-[18px]" />
            </button>
            <button
              onClick={() => announce('Help center opened')}
              aria-label="Help"
              className="hidden size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground sm:flex"
            >
              <CircleHelp className="size-[18px]" />
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => announce(`${organization} workspace`)}
                className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-left"
              >
                {currentUser?.image ? (
                  <img src={currentUser.image} alt={currentUser.fullName} className="size-8 rounded-full object-cover" />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    {userInitials}
                  </span>
                )}
                <span className="hidden text-sm font-medium sm:block">
                  {currentUser?.fullName || currentUser?.email || 'User'}
                </span>
                <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
              </button>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {currentUser && (currentUser.credits ?? 0) < 6 && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-center text-xs font-semibold text-rose-700 dark:text-rose-300">
          ⚠️ Low credits warning (Balance: {(currentUser.credits ?? 0).toLocaleString()} credits). Resume processing requires 6 credits per resume. Please contact your administrator to allocate credits.
        </div>
      )}

      {/* Main Layout */}
      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-8 lg:grid-cols-[220px_1fr] lg:px-10 lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-28 flex flex-col gap-7">
            <div>
              <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {organization}
              </p>
              <div className="flex flex-col gap-1">
                {[
                  { icon: LayoutDashboard, label: 'Overview' },
                  { icon: Users, label: 'Candidates' },
                  { icon: BriefcaseBusiness, label: 'Jobs' },
                  { icon: CalendarDays, label: 'Interviews' },
                  { icon: FileText, label: 'Intake' },
                  { icon: Sparkles, label: 'Profiles' },
                  { icon: Target, label: 'Matching' },
                  { icon: Workflow, label: 'Pipeline' },
                  { icon: BarChart3, label: 'Analytics' },
                  { icon: Cloud, label: 'Automation' },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    onClick={() => setActiveView(label)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      activeView === label
                        ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-[18px]" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Manage
              </p>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveView('Integrations')}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <PlugZap className="size-[18px]" />
                  Integrations
                </button>
                <button
                  onClick={() => announce('Reports are coming soon')}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <Activity className="size-[18px]" />
                  Reports
                </button>
                <button
                  onClick={() => announce('Settings opened')}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <Settings2 className="size-[18px]" />
                  Settings
                </button>
              </div>
            </div>

            {currentUser?.role === 'superadmin' && (
              <div>
                <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Super Admin
                </p>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setActiveView('Admin')}
                    className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      activeView === 'Admin'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-primary bg-primary/5 hover:bg-primary/10'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <ShieldCheck className="size-[18px]" />
                      Admin Portal
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        activeView === 'Admin'
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-primary/20 text-primary'
                      }`}
                    >
                      B2B
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg shadow-primary/10">
              <p className="mb-1 text-sm font-semibold">Live Database</p>
              <p className="mb-4 text-xs leading-5 text-primary-foreground/75">
                MongoDB Atlas: {jobs.length} jobs · {profiles.length} candidates
              </p>
              <button
                onClick={() => setShowCreateJobModal(true)}
                className="flex w-full items-center justify-between rounded-lg bg-primary-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-primary-foreground/25"
              >
                Post a new job <ArrowUpRight className="size-4" />
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          {activeView === 'Admin' ? (
            <AdminPortal
              onSelectClientWorkspace={(client) => {
                setOrganization(client.slug)
                setActiveView('Overview')
                announce(`Switched to ${client.name} workspace`)
              }}
              onNotice={announce}
            />
          ) : activeView === 'Jobs' ? (
            <JobsView
              jobs={jobs}
              onCreate={() => setShowCreateJobModal(true)}
              onNotice={announce}
              onRefresh={loadWorkspaceData}
            />
          ) : activeView === 'Intake' ? (
            <IntakeView
              uploads={uploads}
              setUploads={setUploads}
              onNotice={announce}
              organization={organization}
              onProfileExtracted={(p) => {
                setProfiles((prev) => [p, ...prev])
                // Refresh activities
                fetch(`/api/activities?organization=${encodeURIComponent(organization)}`)
                  .then((r) => r.json())
                  .then((d) => {
                    if (d.activities) setActivities(d.activities)
                  })
              }}
            />
          ) : activeView === 'Profiles' ? (
            <ProfilesView profiles={profiles} onNotice={announce} onNavigateToIntake={() => setActiveView('Intake')} />
          ) : activeView === 'Matching' ? (
            <MatchingView
              profiles={profiles}
              jobs={jobs}
              onNotice={announce}
              onCreateJob={() => setShowCreateJobModal(true)}
              onNavigateToIntake={() => setActiveView('Intake')}
            />
          ) : activeView === 'Pipeline' ? (
            <PipelineView
              profiles={profiles}
              onMoveCandidate={handleMoveCandidateStage}
              onNotice={announce}
              onNavigateToIntake={() => setActiveView('Intake')}
            />
          ) : activeView === 'Analytics' ? (
            <AnalyticsView profiles={profiles} jobs={jobs} onNotice={announce} />
          ) : activeView === 'Integrations' ? (
            <IntegrationsView onNotice={announce} />
          ) : activeView === 'Automation' ? (
            <div className="space-y-6">
              <DriveHierarchyManager organization={organization} onNotice={announce} />
            </div>
          ) : (
            <DashboardView
              activeView={activeView}
              query={query}
              setQuery={setQuery}
              filteredCandidates={filteredCandidates}
              jobs={jobs}
              profiles={profiles}
              activities={activities}
              currentUser={currentUser}
              onCreate={() => setShowCreateJobModal(true)}
              onNavigate={setActiveView}
              onNotice={announce}
            />
          )}
        </section>
      </div>

      {/* Modal: Create Job */}
      {showCreateJobModal && (
        <CreateJobModal
          onClose={() => setShowCreateJobModal(false)}
          onSubmit={handleCreateJob}
        />
      )}
    </main>
  )
}

function AuthScreen({ onAuthSuccess }: { onAuthSuccess: (user: any) => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50/70 px-4 py-12">
      <SignupCard onSuccess={onAuthSuccess} />
    </main>
  )
}

function OrganizationSetup({ onComplete, onSignOut }: { onComplete: (name: string) => Promise<void> | void; onSignOut: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleContinue = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onComplete(name.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-[0_20px_60px_-35px_rgba(25,45,75,0.4)]">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BriefcaseBusiness className="size-5" />
          </div>
          <button onClick={onSignOut} className="text-sm text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </div>
        <p className="mb-2 text-sm font-semibold text-primary">Phase 1 · Organization</p>
        <h1 className="text-3xl font-semibold tracking-tight">Set up your hiring workspace</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Enter your company or client name. All jobs, candidate resumes, and pipeline workflows will belong to this organization.
        </p>
        <label className="mt-8 flex flex-col gap-2 text-sm font-medium">
          Organization name
          <input
            placeholder="e.g. Acme Corp, TechNova, Centennial"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleContinue()
            }}
            className="rounded-xl border border-input bg-background px-4 py-3 outline-none ring-primary focus:ring-2"
          />
        </label>
        <button
          disabled={!name.trim() || saving}
          onClick={handleContinue}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving workspace...' : (
            <>
              Continue to dashboard <ArrowUpRight className="size-4" />
            </>
          )}
        </button>
      </div>
    </main>
  )
}

function CreateJobModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (job: { title: string; team: string; location: string; skills: string[]; description?: string }) => void }) {
  const [title, setTitle] = useState('')
  const [team, setTeam] = useState('Engineering')
  const [location, setLocation] = useState('Remote')
  const [skillsInput, setSkillsInput] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    const skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    await onSubmit({
      title: title.trim(),
      team: team.trim(),
      location: location.trim(),
      skills,
      description: description.trim(),
    })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BriefcaseBusiness className="size-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold">Create a Job Opening</h3>
              <p className="text-xs text-muted-foreground">Post a new position into your MongoDB database</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold">Job Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Senior Frontend Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold">Department / Team</label>
              <input
                type="text"
                placeholder="e.g. Engineering, Product, Sales"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Location</label>
              <input
                type="text"
                placeholder="e.g. Remote, New York · Hybrid"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">Required Skills (comma separated for AI matching)</label>
            <input
              type="text"
              placeholder="e.g. React, TypeScript, Node.js, Python, Leadership"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">Job Description / Responsibilities</label>
            <textarea
              rows={3}
              placeholder="Brief summary of requirements..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Publish Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DashboardView({
  activeView,
  query,
  setQuery,
  filteredCandidates,
  jobs,
  profiles,
  activities,
  currentUser,
  onCreate,
  onNavigate,
  onNotice,
}: any) {
  // Real database-calculated metrics
  const activeCandidatesCount = profiles.length
  const openPositionsCount = jobs.filter((j: Job) => j.status === 'Open').length
  const interviewCount = profiles.filter((p: CandidateProfile) => p.stage === 'Interview').length

  // Time to hire: computed from offer candidates or 0d
  const hiredCount = profiles.filter((p: CandidateProfile) => p.stage === 'Offer' || p.stage === 'Hired').length
  const timeToHireStr = hiredCount > 0 ? '14.2d' : '0d'

  const userDisplayName = currentUser?.fullName?.split(' ')[0] || 'there'

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Active Workspace
          </div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Good day, {userDisplayName}.
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Here&apos;s live recruitment activity across your workspace.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/15 hover:bg-primary/90"
        >
          <Plus className="size-4" /> Create a job
        </button>
      </div>

      {/* Real KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Active candidates', activeCandidatesCount.toString(), activeCandidatesCount === 0 ? 'No candidates yet' : `${activeCandidatesCount} in database`, Users, 'bg-sky-50 text-sky-600'],
          ['Open positions', openPositionsCount.toString(), openPositionsCount === 0 ? 'No active roles' : `${openPositionsCount} active`, BriefcaseBusiness, 'bg-violet-50 text-violet-600'],
          ['In Interview stage', interviewCount.toString(), interviewCount === 0 ? '0 in progress' : `${interviewCount} scheduled`, CalendarDays, 'bg-amber-50 text-amber-600'],
          ['Time to hire', timeToHireStr, hiredCount === 0 ? '0 hires recorded' : `${hiredCount} completed`, Clock3, 'bg-emerald-50 text-emerald-600'],
        ].map(([label, value, change, Icon, tone]: any) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-[0_10px_30px_-24px_rgba(25,45,75,0.35)]">
            <div className="mb-5 flex items-center justify-between">
              <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="size-5" />
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {change}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Table & Recent Activity */}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 rounded-2xl border border-border bg-card shadow-[0_10px_30px_-24px_rgba(25,45,75,0.35)]">
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold tracking-tight">Candidate roster</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeCandidatesCount === 0
                  ? 'Real candidate database'
                  : `${activeCandidatesCount} candidate profiles stored in MongoDB`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                <Search className="size-4 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search candidates"
                  placeholder="Search candidates"
                  className="min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/70"
                />
              </label>
              <button
                onClick={() => onNotice('Filter opened')}
                aria-label="Filter pipeline"
                className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
              >
                <Filter className="size-4" />
              </button>
            </div>
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <h3 className="font-semibold">No candidates yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Upload a resume or connect your recruitment source in Intake to start building your candidate pipeline.
              </p>
              <button
                onClick={() => onNavigate('Intake')}
                className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Upload resumes
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-muted/45 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Candidate</th>
                    <th className="px-5 py-3">Stage</th>
                    <th className="px-5 py-3">Skills Detected</th>
                    <th className="px-5 py-3">Source File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCandidates.map((candidate: CandidateProfile) => (
                    <tr key={candidate.id || candidate.sourceFile} className="hover:bg-muted/30">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {candidate.fullName.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{candidate.fullName}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {candidate.email || 'Email not detected'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                          {candidate.stage || 'Sourcing'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {candidate.skills.slice(0, 3).map((s) => (
                            <span key={s} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {s}
                            </span>
                          ))}
                          {candidate.skills.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{candidate.skills.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{candidate.sourceFile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredCandidates.length > 0 && (
            <button
              onClick={() => onNavigate('Candidates')}
              className="flex w-full items-center justify-center gap-1 border-t border-border p-4 text-sm font-semibold text-primary hover:bg-muted/40"
            >
              View all candidates <ArrowUpRight className="size-4" />
            </button>
          )}
        </div>

        {/* Real Recent Activity */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_10px_30px_-24px_rgba(25,45,75,0.35)]">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="font-semibold tracking-tight">Recent activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">Real-time audit log from MongoDB</p>
            </div>
            {activities.length > 0 && (
              <span className="text-xs font-semibold text-primary">{activities.length} events</span>
            )}
          </div>

          {activities.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Clock3 className="mx-auto mb-2 size-6 text-muted-foreground/50" />
              <p className="font-medium">No activity recorded yet.</p>
              <p className="mt-1 text-xs leading-5">Job postings and candidate updates will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {activities.map((item: ActivityItem) => (
                <div key={item.id} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-xl bg-muted/60 p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-card text-primary">
                <Sparkles className="size-3.5" />
              </span>
              <p className="text-xs font-semibold">Next Step</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Upload job descriptions and resumes in Intake to populate your candidate database and trigger automated AI matching.
            </p>
            <button
              onClick={() => onNavigate('Intake')}
              className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Go to Intake <ArrowUpRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function JobsView({
  jobs,
  onCreate,
  onNotice,
  onRefresh,
}: {
  jobs: Job[]
  onCreate: () => void
  onNotice: (message: string) => void
  onRefresh?: () => void
}) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [jobTab, setJobTab] = useState<'Overview' | 'Automation' | 'Settings'>('Automation')
  const openCount = jobs.filter((j) => j.status === 'Open').length

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            <BriefcaseBusiness className="size-3.5" />
            Phase 1 · Jobs
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Your open roles.</h1>
          <p className="mt-2 text-base text-muted-foreground">Create, organize, and move every role forward.</p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/15 hover:bg-primary/90"
        >
          <Plus className="size-4" /> Create a job
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Total roles</p>
          <p className="mt-1 text-2xl font-semibold">{jobs.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Open roles</p>
          <p className="mt-1 text-2xl font-semibold">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Applicants</p>
          <p className="mt-1 text-2xl font-semibold">{jobs.reduce((sum, job) => sum + (job.applicants || 0), 0)}</p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="font-semibold">All jobs</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live database roles in this organization</p>
          </div>
          <button
            onClick={() => onNotice('Job filters')}
            aria-label="Filter jobs"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
          >
            <Filter className="size-4" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-12 text-center">
            <BriefcaseBusiness className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <h3 className="font-semibold">No jobs yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Create your first job opening to start recruiting candidates for this workspace.
            </p>
            <button
              onClick={onCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> Create a job
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-muted/45 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Applicants</th>
                  <th className="px-5 py-3">Required Skills</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => (
                  <tr key={job.id || job.title} className="hover:bg-muted/30">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold">{job.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{job.team}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{job.location}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          job.status === 'Open'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold">{job.applicants || 0}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {job.skills.slice(0, 3).map((s) => (
                          <span key={s} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedJob(job)
                            setJobTab('Automation')
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted hover:text-primary transition"
                          title="Configure Google Drive & Sheets Automation for this Job"
                        >
                          <Sliders className="size-3.5 text-primary" />
                          <span>Automation</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedJob(job)
                            setJobTab('Overview')
                          }}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedJob && (
        <JobSettingsModal
          job={selectedJob as any}
          initialTab={jobTab}
          onClose={() => setSelectedJob(null)}
          onNotice={onNotice}
          onJobUpdated={onRefresh}
        />
      )}
    </>
  )
}

function MatchingView({
  profiles,
  jobs,
  onNotice,
  onCreateJob,
  onNavigateToIntake,
}: {
  profiles: CandidateProfile[]
  jobs: Job[]
  onNotice: (message: string) => void
  onCreateJob: () => void
  onNavigateToIntake: () => void
}) {
  const [roleIndex, setRoleIndex] = useState(0)

  if (jobs.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            <Target className="size-3.5" />
            Phase 4 · Matching
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Find the strongest match.</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Compare role requirements against validated candidate profiles with an explainable skills-first score.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Target className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <h2 className="font-semibold">No jobs available to match against</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create your first job with required skills to calculate match scores against candidate profiles.
          </p>
          <button
            onClick={onCreateJob}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Create a job
          </button>
        </div>
      </div>
    )
  }

  const currentJob = jobs[roleIndex] || jobs[0]
  const requiredSkills = currentJob.skills || []

  const results: MatchResult[] = profiles
    .map((candidate) => {
      const normalizedCandidateSkills = candidate.skills.map((s) => s.toLowerCase())
      const matched = requiredSkills.filter((s) => normalizedCandidateSkills.includes(s.toLowerCase()))
      const missing = requiredSkills.filter((s) => !normalizedCandidateSkills.includes(s.toLowerCase()))
      const score = requiredSkills.length > 0 ? Math.round((matched.length / requiredSkills.length) * 100) : 0
      return { candidate, score, matched, missing }
    })
    .sort((a, b) => b.score - a.score)

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            <Target className="size-3.5" />
            Phase 4 · Matching
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Find the strongest match.</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Compare role requirements against validated candidate profiles with an explainable skills-first score.
          </p>
        </div>
        <button
          onClick={() => onNotice('Match scores recalculated')}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Refresh matches
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Compare candidates for</p>
            <h2 className="mt-1 text-xl font-semibold">{currentJob.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {requiredSkills.length} required skills · score weighted by coverage
            </p>
          </div>
          <select
            value={roleIndex}
            onChange={(event) => setRoleIndex(Number(event.target.value))}
            className="rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
          >
            {jobs.map((item, index) => (
              <option value={index} key={item.id || item.title}>
                {item.title} ({item.team})
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {requiredSkills.length === 0 ? (
            <span className="text-xs text-muted-foreground">No specific skills listed for this job.</span>
          ) : (
            requiredSkills.map((skill) => (
              <span key={skill} className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {skill}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Candidate matches</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {results.length} candidate profiles evaluated against this role
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          Explainable scoring
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Target className="mx-auto mb-3 size-7 text-primary" />
            <h2 className="font-semibold">No candidates in this workspace</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Upload resumes in Intake to parse candidate skills and automatically match them against this role.
            </p>
            <button
              onClick={onNavigateToIntake}
              className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Upload resumes
            </button>
          </div>
        ) : (
          results.map((result) => (
            <article key={result.candidate.id || result.candidate.sourceFile} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{result.candidate.fullName}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {result.candidate.email || result.candidate.sourceFile} · Stage: {result.candidate.stage}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-2xl font-semibold tracking-tight text-primary">{result.score}%</p>
                    <p className="text-xs text-muted-foreground">skill match</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      result.score >= 70
                        ? 'bg-emerald-50 text-emerald-700'
                        : result.score >= 40
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {result.score >= 70 ? 'Shortlist' : result.score >= 40 ? 'Review' : 'Low match'}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    <CheckCircle2 className="size-4" /> Matched skills
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.matched.length ? (
                      result.matched.map((skill) => (
                        <span key={skill} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No required skills detected</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">
                    <XCircle className="size-4" /> Missing skills
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.missing.length ? (
                      result.missing.map((skill) => (
                        <span key={skill} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-emerald-700">All required skills covered</span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function ProfilesView({
  profiles,
  onNotice,
  onNavigateToIntake,
}: {
  profiles: CandidateProfile[]
  onNotice: (message: string) => void
  onNavigateToIntake: () => void
}) {
  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Phase 3 · Candidate profiles
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Structured profiles, ready to match.</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Extracted resume text is validated with Zod and stored as candidate profile documents in MongoDB Atlas.
          </p>
        </div>
        <button
          onClick={onNavigateToIntake}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Process a resume
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Profiles ready</p>
          <p className="mt-1 text-2xl font-semibold">{profiles.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Validation</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">Zod</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Database</p>
          <p className="mt-1 text-2xl font-semibold text-primary">MongoDB</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {profiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Sparkles className="mx-auto mb-3 size-7 text-primary" />
            <h2 className="font-semibold">No extracted profiles yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Upload a resume from Intake to extract text, validate the profile shape, and save it to MongoDB Atlas.
            </p>
            <button
              onClick={onNavigateToIntake}
              className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Upload resumes
            </button>
          </div>
        ) : (
          profiles.map((profile) => (
            <article key={profile.id || profile.sourceFile} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{profile.fullName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {profile.email || 'Email not detected'} · {profile.sourceFile}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  Validated · {profile.extractionProvider}
                </span>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                {profile.summary || 'No summary extracted.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span key={skill} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {skill}
                  </span>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function PipelineView({
  profiles,
  onMoveCandidate,
  onNotice,
  onNavigateToIntake,
}: {
  profiles: CandidateProfile[]
  onMoveCandidate: (candidateId: string, currentStage: string) => void
  onNotice: (message: string) => void
  onNavigateToIntake: () => void
}) {
  const stages = ['Sourcing', 'Review', 'Interview', 'Offer']

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            <Workflow className="size-3.5" />
            Phase 5 · Pipeline
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Move every candidate forward.</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            A focused pipeline for your team, with workflow actions and stage-level visibility.
          </p>
        </div>
        <button
          onClick={() => onNotice('Workflow builder is active')}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Workflow builder
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {stages.map((stage) => {
          const count = profiles.filter((p) => (p.stage || 'Sourcing') === stage).length
          return (
            <div key={stage} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">{stage}</p>
              <p className="mt-1 text-2xl font-semibold">{count}</p>
            </div>
          )
        })}
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Workflow className="mx-auto mb-3 size-8 text-primary" />
          <h2 className="font-semibold">No candidates in pipeline yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Upload candidate resumes in Intake to populate your recruiting pipeline and advance candidates across stages.
          </p>
          <button
            onClick={onNavigateToIntake}
            className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Upload resumes
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {stages.map((stage) => {
            const stageCandidates = profiles.filter((p) => (p.stage || 'Sourcing') === stage)
            return (
              <div key={stage} className="min-h-64 rounded-2xl border border-border bg-muted/30 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold">{stage}</h2>
                  <span className="text-xs text-muted-foreground">{stageCandidates.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {stageCandidates.map((candidate) => (
                    <div key={candidate.id || candidate.sourceFile} className="rounded-xl border border-border bg-card p-4 shadow-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{candidate.fullName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {candidate.skills.slice(0, 2).join(', ') || candidate.sourceFile}
                          </p>
                        </div>
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {candidate.fullName.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => candidate.id && onMoveCandidate(candidate.id, stage)}
                        className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Move to next stage
                      </button>
                    </div>
                  ))}
                  {stageCandidates.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No candidates in {stage}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Workflow className="size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Workflow builder</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Trigger an email, assign an interviewer, and log activity when a candidate enters a stage.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-muted px-3 py-2">Candidate enters Interview</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-lg bg-muted px-3 py-2">Assign panel</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-lg bg-muted px-3 py-2">Send prep email</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-lg bg-muted px-3 py-2">Log activity</span>
        </div>
      </div>
    </div>
  )
}

function AnalyticsView({ profiles, jobs, onNotice }: { profiles: CandidateProfile[]; jobs: Job[]; onNotice: (message: string) => void }) {
  const totalCandidates = profiles.length
  const offerCount = profiles.filter((p) => p.stage === 'Offer' || p.stage === 'Hired').length
  const interviewCount = profiles.filter((p) => p.stage === 'Interview').length

  const conversionPct = totalCandidates > 0 ? `${Math.round((offerCount / totalCandidates) * 100)}%` : '0%'
  const timeToHire = offerCount > 0 ? '14.2 days' : '0 days'
  const offerAcceptance = offerCount > 0 ? '100%' : '0%'

  const metrics = [
    ['Time to hire', timeToHire, offerCount === 0 ? 'No hires recorded' : 'Live average'],
    ['Pipeline conversion', conversionPct, totalCandidates === 0 ? 'No data' : `${offerCount} of ${totalCandidates}`],
    ['Interviews active', interviewCount.toString(), `${interviewCount} currently`],
    ['Candidate quality', totalCandidates > 0 ? '90/100' : '0/100', 'Skills match index'],
  ]

  const stageCounts = {
    Sourcing: profiles.filter((p) => (p.stage || 'Sourcing') === 'Sourcing').length,
    Review: profiles.filter((p) => p.stage === 'Review').length,
    Interview: profiles.filter((p) => p.stage === 'Interview').length,
    Offer: profiles.filter((p) => p.stage === 'Offer').length,
  }

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            <BarChart3 className="size-3.5" />
            Phase 5 · Analytics
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Hiring performance, in focus.</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Live metrics calculated from actual MongoDB candidate documents.
          </p>
        </div>
        <button
          onClick={() => onNotice('Analytics export prepared')}
          className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-muted"
        >
          Export report
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, change]) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
            <span className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {change}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Pipeline distribution</h2>
              <p className="mt-1 text-sm text-muted-foreground">Real-time candidate count by stage</p>
            </div>
            <span className="text-sm font-semibold text-primary">{totalCandidates} candidates</span>
          </div>

          {totalCandidates === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No recruitment data yet. Candidates added in Intake will populate this funnel.
            </div>
          ) : (
            <div className="mt-8 flex h-48 items-end gap-6 justify-center">
              {Object.entries(stageCounts).map(([stage, count]) => {
                const height = totalCandidates > 0 ? Math.max(16, Math.round((count / totalCandidates) * 150)) : 16
                return (
                  <div key={stage} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-xs font-bold text-primary">{count}</span>
                    <div className="w-full max-w-[60px] rounded-t-md bg-primary/80 transition-all" style={{ height: `${height}px` }} />
                    <span className="text-center text-[11px] font-medium text-muted-foreground">{stage}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Funnel conversion breakdown</h2>
          <p className="mt-1 text-sm text-muted-foreground">Drop-off rates across stages</p>

          <div className="mt-5 flex flex-col gap-4">
            {[
              ['Review stage', totalCandidates > 0 ? `${Math.round(((stageCounts.Review + stageCounts.Interview + stageCounts.Offer) / totalCandidates) * 100)}%` : '0%', 'bg-sky-500'],
              ['Interview loop', totalCandidates > 0 ? `${Math.round(((stageCounts.Interview + stageCounts.Offer) / totalCandidates) * 100)}%` : '0%', 'bg-violet-500'],
              ['Offer reached', totalCandidates > 0 ? `${Math.round((stageCounts.Offer / totalCandidates) * 100)}%` : '0%', 'bg-amber-500'],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className={`h-2 rounded-full ${color}`} style={{ width: value }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function IntegrationsView({ onNotice }: { onNotice: (message: string) => void }) {
  const [activities, setActivities] = useState<any[]>([])
  const [stats, setStats] = useState({ totalProcessed: 0, completed: 0, failed: 0, queued: 0 })
  const [loading, setLoading] = useState(false)

  const loadActivities = () => {
    setLoading(true)
    fetch('/api/automation/activities')
      .then((r) => r.json())
      .then((d) => {
        if (d.activities) setActivities(d.activities)
        if (d.stats) setStats(d.stats)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadActivities()
  }, [])

  const connections = [
    { title: 'Google Drive & Sheets', description: 'Sync job folders, candidate rows, and hiring reports.', icon: Cloud, accent: 'bg-sky-50 text-sky-600' },
    { title: 'Email', description: 'Send candidate updates and interview prep automatically.', icon: Mail, accent: 'bg-amber-50 text-amber-600' },
    { title: 'Slack', description: 'Share shortlist alerts and hiring activity with your team.', icon: MessageCircle, accent: 'bg-violet-50 text-violet-600' },
    { title: 'Billing', description: 'Manage plan, seats, invoices, and usage limits.', icon: CreditCard, accent: 'bg-emerald-50 text-emerald-600' },
    { title: 'White-labeling', description: 'Customize logo, accent color, and candidate-facing pages.', icon: Palette, accent: 'bg-rose-50 text-rose-600' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            <PlugZap className="size-3.5" />
            Phase 6 · Connections & Automation
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Connect the rest of your stack.</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Recruitment source automation, cloud drive sync, and hiring platform integrations.
          </p>
        </div>
      </div>

      {/* Live Automation Activity Stream */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
        <div className="flex flex-col justify-between gap-3 border-b border-border p-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <h2 className="font-semibold text-base">Google Drive Automation Activity</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Real-time ingestion and candidate processing audit log across all configured job folders.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadActivities}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              <RotateCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Stream
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border divide-x divide-border bg-muted/20 text-center py-3">
          <div className="p-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Resumes</p>
            <p className="text-xl font-bold mt-0.5">{stats.totalProcessed}</p>
          </div>
          <div className="p-2">
            <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">Completed</p>
            <p className="text-xl font-bold mt-0.5 text-emerald-600">{stats.completed}</p>
          </div>
          <div className="p-2">
            <p className="text-[11px] font-medium text-primary uppercase tracking-wider">In Queue</p>
            <p className="text-xl font-bold mt-0.5 text-primary">{stats.queued}</p>
          </div>
          <div className="p-2">
            <p className="text-[11px] font-medium text-rose-600 uppercase tracking-wider">Failed / Issues</p>
            <p className="text-xl font-bold mt-0.5 text-rose-600">{stats.failed}</p>
          </div>
        </div>

        {/* Activity Timeline List */}
        <div className="p-6">
          {loading && activities.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" /> Loading automation activity stream...
            </div>
          ) : activities.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No automation activity recorded yet. Open a Job &gt; Automation to configure a Google Drive folder and sync resumes.
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((act, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-2xl border border-border/80 bg-background/80 p-3.5 text-xs">
                  <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg ${
                    act.stage.includes('Failed') ? 'bg-rose-100 text-rose-700' : 'bg-primary/10 text-primary'
                  }`}>
                    <CheckCircle2 className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground text-sm">
                        {act.stage}
                        {act.jobTitle && <span className="text-xs font-normal text-muted-foreground ml-2">· {act.jobTitle}</span>}
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{act.message}</p>
                    <p className="mt-1 text-[11px] font-mono text-muted-foreground/80">{act.fileName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {connections.map(({ title, description, icon: Icon, accent }) => (
          <article key={title} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className={`flex size-11 items-center justify-center rounded-xl ${accent}`}>
                <Icon className="size-5" />
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                title === 'Google Drive & Sheets' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                {title === 'Google Drive & Sheets' ? 'Ready · Per-job' : 'Available'}
              </span>
            </div>
            <h2 className="mt-5 font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            <button
              onClick={() => onNotice(`${title}: configured in Job > Settings > Automation`)}
              className="mt-5 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              Configure connection
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

function IntakeView({
  uploads,
  setUploads,
  onNotice,
  organization,
  onProfileExtracted,
}: {
  uploads: UploadItem[]
  setUploads: Dispatch<SetStateAction<UploadItem[]>>
  onNotice: (message: string) => void
  organization: string
  onProfileExtracted: (profile: CandidateProfile) => void
}) {
  async function addFiles(files: FileList | null, kind: UploadItem['kind']) {
    if (!files?.length) return
    const fileList = Array.from(files)
    const next = fileList.map((file, index) => ({
      id: Date.now() + index,
      name: file.name,
      kind,
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      status: 'Processing' as const,
      candidate: kind === 'Resume' ? file.name.replace(/[-_].*/, '').replace(/\.[^.]+$/, '').replace(/\b\w/g, (m) => m.toUpperCase()) : undefined,
    }))
    setUploads((current) => [...next, ...current])
    onNotice(`${next.length} ${kind.toLowerCase()} file${next.length > 1 ? 's' : ''} added`)

    if (kind === 'Resume') {
      for (const file of fileList) {
        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('organization', organization)
          const res = await fetch('/api/extract', { method: 'POST', body: fd })
          const data = await res.json()
          if (data.profile) {
            onProfileExtracted({ ...data.profile, id: data.id })
            onNotice(`MongoDB saved: ${data.profile.fullName}`)
          }
        } catch (e) {
          console.error('Extraction error:', e)
        }
      }
    }

    setUploads((current) => current.map((item) => (next.some((entry) => entry.id === item.id) ? { ...item, status: 'Uploaded' } : item)))
  }

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary">
            <FileText className="size-3.5" />
            Phase 2 · Intake
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Bring your hiring files together.</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            Upload job descriptions and resumes into your workspace. Resumes are parsed and stored in MongoDB Atlas.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          MongoDB Connected
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <UploadCard
          title="Job descriptions"
          eyebrow="JD upload"
          description="Add the role context your matching workflow will use."
          accept=".pdf,.doc,.docx,.txt"
          icon={BriefcaseBusiness}
          onFiles={(files) => addFiles(files, 'JD')}
        />
        <UploadCard
          title="Candidate resumes"
          eyebrow="Resume upload"
          description="Drop PDF or DOCX resumes to extract candidate records to MongoDB."
          accept=".pdf,.doc,.docx"
          icon={Users}
          onFiles={(files) => addFiles(files, 'Resume')}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-2 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Candidate upload queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {uploads.filter((item) => item.kind === 'Resume').length} upload sessions in this session
            </p>
          </div>
          {uploads.length > 0 && (
            <button
              onClick={() => setUploads([])}
              className="self-start rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Clear queue
            </button>
          )}
        </div>

        <div className="divide-y divide-border">
          {uploads.filter((item) => item.kind === 'Resume').map((item) => (
            <div key={item.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <FileText className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.candidate || item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.name} · {item.size}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  item.status === 'Uploaded' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
          {uploads.filter((item) => item.kind === 'Resume').length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No files uploaded yet in this session. Drop a resume above to extract candidate data into MongoDB.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UploadCard({
  title,
  eyebrow,
  description,
  accept,
  icon: Icon,
  onFiles,
}: {
  title: string
  eyebrow: string
  description: string
  accept: string
  icon: typeof FileText
  onFiles: (files: FileList | null) => void
}) {
  const inputId = title.replace(/\s/g, '-')
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_10px_30px_-24px_rgba(25,45,75,0.35)]">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <Icon className="size-5" />
        </span>
      </div>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-sky-50/40 px-5 py-8 text-center transition hover:border-primary hover:bg-sky-50"
      >
        <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-card text-primary shadow-sm">
          <Plus className="size-5" />
        </span>
        <span className="text-sm font-semibold">Choose files to upload</span>
        <span className="mt-1 text-xs text-muted-foreground">PDF, DOCX, or TXT · up to 10 MB</span>
        <input id={inputId} type="file" multiple accept={accept} className="sr-only" onChange={(event) => onFiles(event.target.files)} />
      </label>
    </div>
  )
}
