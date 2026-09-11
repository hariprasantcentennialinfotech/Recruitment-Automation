'use client'

import { useState, useEffect } from 'react'
import {
  Building2,
  Users,
  BriefcaseBusiness,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  DollarSign,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Palette,
  Settings2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Eye,
  Coins,
  CreditCard,
  Wallet,
  CheckSquare,
  Square,
  UserCheck,
  SendHorizontal,
  Zap,
  Clock,
  Activity,
  Cpu,
  RefreshCw
} from 'lucide-react'
import { ClientDetail } from '@/components/admin/client-detail'
import { ClientCompany, SubscriptionPlan, ClientStatus } from '@/lib/types'

interface AdminPortalProps {
  // Pass the whole client object so the page can switch context by slug and display name
  onSelectClientWorkspace: (client: { slug: string; name: string }) => void
  onNotice: (message: string) => void
  onSignOut?: () => void
}

interface AdminUserItem {
  id: string
  fullName: string
  email: string
  organization: string
  company: string
  role: string
  credits: number
  lastCreditUpdate?: string | null
  createdAt?: string | null
}

interface ModelAnalyticsData {
  overview: {
    totalInvocations: number
    totalTokensConsumed: number
    overallSuccessRate: number
    avgOverallLatencyMs: number
    modelsTrackedCount: number
  }
  models: Array<{
    model: string
    totalCalls: number
    successCalls: number
    rateLimitedCalls: number
    overloadedCalls: number
    errorCalls: number
    totalPromptTokens: number
    totalCandidatesTokens: number
    totalTokens: number
    avgDurationMs: number
    successRate: number
    sharePercentage: number
  }>
  operations: Array<{
    name: string
    calls: number
    tokens: number
    successRate: number
  }>
  recentLogs: Array<{
    id: string
    model: string
    operation: string
    status: string
    statusCode: number
    tokens: number
    durationMs: number
    timestamp: string
    errorMessage: string | null
  }>
}

export function AdminPortal({ onSelectClientWorkspace, onNotice, onSignOut }: AdminPortalProps) {
  const [portalTab, setPortalTab] = useState<'users' | 'clients' | 'models'>('users')

  // Model Analytics State
  const [modelAnalytics, setModelAnalytics] = useState<ModelAnalyticsData | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  // Users & Credits State
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [userStats, setUserStats] = useState({ totalUsers: 0, totalCredits: 0, lowCreditUsers: 0 })
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [allocateMode, setAllocateMode] = useState<'selected' | 'all'>('selected')
  const [allocateAmount, setAllocateAmount] = useState<number>(1000)
  const [allocateNote, setAllocateNote] = useState('')
  const [allocating, setAllocating] = useState(false)

  // Clients State
  const [clients, setClients] = useState<ClientCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientCompany | null>(null)
  const [selectedDetailClient, setSelectedDetailClient] = useState<ClientCompany | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Automation summary map: clientId -> summary
  const [automationMap, setAutomationMap] = useState<Record<string, any>>({})

  // New Client Form state
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    contactPerson: '',
    domain: '',
    plan: 'Growth' as SubscriptionPlan,
    status: 'Active' as ClientStatus,
    brandColor: '#2563eb',
    whiteLabelName: '',
    maxJobs: 20,
    maxCandidates: 500,
  })

  const loadClients = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/clients')
      const data = await res.json()
      if (data.clients) {
        setClients(data.clients)
      }
    } catch (err) {
      console.error('Failed to load clients:', err)
      onNotice('Failed to load client companies')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.users) {
        setUsers(data.users)
        if (data.stats) setUserStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to load users:', err)
      onNotice('Failed to load user accounts')
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadModelAnalytics = async () => {
    try {
      setLoadingAnalytics(true)
      const res = await fetch('/api/admin/analytics/models')
      const data = await res.json()
      if (res.ok && data.overview) {
        setModelAnalytics(data)
      } else {
        console.error('Failed to load model analytics:', data)
      }
    } catch (err) {
      console.error('Failed to fetch model analytics:', err)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const handleAllocateCredits = async (amount: number, userIds?: string[], allUsers?: boolean) => {
    try {
      setAllocating(true)
      const res = await fetch('/api/admin/credits/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          userIds,
          allUsers,
          note: allocateNote || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to allocate credits')
      onNotice(data.message || `Allocated ${amount} credits successfully`)
      setShowAllocateModal(false)
      setSelectedUserIds([])
      setAllocateNote('')
      loadUsers()
    } catch (err: any) {
      onNotice(err.message || 'Error allocating credits')
    } finally {
      setAllocating(false)
    }
  }

  useEffect(() => {
    loadClients()
    loadUsers()
    loadModelAnalytics()
  }, [])

  // When clients load, fetch automation summary for each
  useEffect(() => {
    if (clients.length === 0) return
    clients.forEach(async (c) => {
      if (!c.id) return
      try {
        const res = await fetch(`/api/admin/clients/${c.id}/automation`)
        if (!res.ok) return
        const data = await res.json()
        if (data.summary) {
          setAutomationMap((prev) => ({ ...prev, [c.id!]: data.summary }))
        }
      } catch {}
    })
  }, [clients])

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.contactEmail) return

    try {
      setSubmitting(true)
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create client')

      onNotice(`Client "${formData.name}" onboarded successfully`)
      setShowAddModal(false)
      setFormData({
        name: '',
        contactEmail: '',
        contactPerson: '',
        domain: '',
        plan: 'Growth',
        status: 'Active',
        brandColor: '#2563eb',
        whiteLabelName: '',
        maxJobs: 20,
        maxCandidates: 500,
      })
      loadClients()
    } catch (err: any) {
      onNotice(err.message || 'Error creating client')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateClient = async (id: string, updates: Partial<ClientCompany>) => {
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update client')
      onNotice('Client updated')
      setEditingClient(null)
      loadClients()
    } catch (err: any) {
      onNotice(err.message || 'Failed to update')
    }
  }

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove client "${name}"?`)) return
    try {
      const res = await fetch(`/api/admin/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete client')
      onNotice(`Client "${name}" removed`)
      loadClients()
    } catch (err: any) {
      onNotice(err.message || 'Failed to delete')
    }
  }

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.domain && c.domain.toLowerCase().includes(search.toLowerCase())) ||
      c.contactEmail.toLowerCase().includes(search.toLowerCase())

    const matchesPlan = planFilter === 'All' || c.plan === planFilter
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter
    return matchesSearch && matchesPlan && matchesStatus
  })

  // Metrics
  const totalRevenue = clients.reduce((acc, c) => (c.status === 'Active' ? acc + (c.monthlyFee || 499) : acc), 0)
  const totalJobs = clients.reduce((acc, c) => acc + (c.activeJobsCount || 0), 0)
  const totalCandidates = clients.reduce((acc, c) => acc + (c.candidatesCount || 0), 0)

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase()
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.organization.toLowerCase().includes(q) ||
      u.company.toLowerCase().includes(q)
    )
  })

  const isAllSelected = filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id))
    }
  }

  const handleToggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="size-3.5" />
            Centennial Infotech · Super Admin
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {portalTab === 'users'
              ? 'User Accounts & Credits System'
              : portalTab === 'models'
              ? 'Google Gemini Model Telemetry & Usage'
              : 'Multi-Tenant Client Management'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {portalTab === 'users'
              ? 'Manage all platform users, monitor activity, and allocate resume processing credits (6 credits consumed per resume).'
              : portalTab === 'models'
              ? 'Real-time telemetry and token analytics across Google Gemini models, rate-limit fallback rates, and API latencies.'
              : 'Recruitment Automation as a Service (RaaS) · Manage client tenant workspaces, quotas, and white-labeling.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {portalTab === 'users' ? (
            <>
              <button
                onClick={() => {
                  setAllocateMode('all')
                  setAllocateAmount(1000)
                  setShowAllocateModal(true)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-amber-700"
              >
                <Coins className="size-4" /> +1,000 Credits to All
              </button>
              <button
                onClick={() => {
                  setAllocateMode(selectedUserIds.length > 0 ? 'selected' : 'all')
                  setAllocateAmount(1000)
                  setShowAllocateModal(true)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90"
              >
                <Wallet className="size-4" /> Allocate Credits
              </button>
            </>
          ) : portalTab === 'models' ? (
            <button
              onClick={loadModelAnalytics}
              disabled={loadingAnalytics}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${loadingAnalytics ? 'animate-spin text-primary' : ''}`} />
              Refresh Telemetry
            </button>
          ) : (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90"
            >
              <Plus className="size-4" /> Onboard Client Company
            </button>
          )}

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Sign out Admin
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <button
          onClick={() => setPortalTab('users')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            portalTab === 'users'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Users className="size-4" />
          User Management & Credits
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              portalTab === 'users'
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
          >
            {users.length}
          </span>
        </button>

        <button
          onClick={() => {
            setPortalTab('models')
            loadModelAnalytics()
          }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            portalTab === 'models'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Cpu className="size-4" />
          Google Model Analytics
          {modelAnalytics && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                portalTab === 'models'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {modelAnalytics.overview.totalInvocations} calls
            </span>
          )}
        </button>

        <button
          onClick={() => setPortalTab('clients')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            portalTab === 'clients'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building2 className="size-4" />
          Client Workspaces (B2B)
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              portalTab === 'clients'
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
          >
            {clients.length}
          </span>
        </button>
      </div>

      {portalTab === 'users' ? (
        /* USERS & CREDITS TAB */
        <div className="space-y-6">
          {/* User & Credit KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Users className="size-5" />
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  Registered
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total System Users
              </p>
              <p className="mt-1 text-2xl font-bold">{users.length}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Coins className="size-5" />
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  Active
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Credits in Circulation
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {userStats.totalCredits.toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <AlertTriangle className="size-5" />
                </span>
                <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                  &lt; 30 Credits
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Low Credit Accounts
              </p>
              <p className="mt-1 text-2xl font-bold">{userStats.lowCreditUsers}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CreditCard className="size-5" />
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Standard Rate
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Processing Cost
              </p>
              <p className="mt-1 text-2xl font-bold">6 Credits <span className="text-sm font-normal text-muted-foreground">/ resume</span></p>
            </div>
          </div>

          {/* User Search & Bulk Selection Bar */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users by name, email, or organization..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {selectedUserIds.length > 0 && (
                <button
                  onClick={() => {
                    setAllocateMode('selected')
                    setAllocateAmount(1000)
                    setShowAllocateModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Coins className="size-3.5" />
                  Allocate to {selectedUserIds.length} Selected
                </button>
              )}
              <button
                onClick={loadUsers}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Refresh Users
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="text-base font-semibold">User Roster & Credit Balances</h2>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredUsers.length} of {users.length} registered user accounts
                </p>
              </div>
              {selectedUserIds.length > 0 && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {selectedUserIds.length} user(s) selected
                </span>
              )}
            </div>

            {loadingUsers ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No users found matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-left">
                  <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="w-12 px-4 py-3 text-center">
                        <button
                          onClick={handleToggleSelectAll}
                          className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                          title={isAllSelected ? 'Deselect All' : 'Select All'}
                        >
                          {isAllSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4" />
                          )}
                        </button>
                      </th>
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Workspace / Org</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Credit Balance</th>
                      <th className="px-5 py-3 text-right">Quick Allocate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {filteredUsers.map((u) => {
                      const isSelected = selectedUserIds.includes(u.id)
                      const isLowCredits = u.credits < 30
                      const isExhausted = u.credits < 6

                      return (
                        <tr
                          key={u.id}
                          className={`transition ${
                            isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => handleToggleSelectUser(u.id)}
                              className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              {isSelected ? (
                                <CheckSquare className="size-4 text-primary" />
                              ) : (
                                <Square className="size-4" />
                              )}
                            </button>
                          </td>

                          {/* User Info */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                                {u.fullName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{u.fullName}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Org */}
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                              <Building2 className="size-3 text-muted-foreground" />
                              {u.organization || u.company || 'Personal'}
                            </span>
                          </td>

                          {/* Role */}
                          <td className="px-5 py-4">
                            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold capitalize text-foreground">
                              {u.role}
                            </span>
                          </td>

                          {/* Credits Balance */}
                          <td className="px-5 py-4">
                            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-2xs border">
                              <Coins className="size-3.5" />
                              <span
                                className={
                                  isExhausted
                                    ? 'text-rose-600'
                                    : isLowCredits
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }
                              >
                                {u.credits.toLocaleString()} Credits
                              </span>
                            </div>
                            {isExhausted && (
                              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                                ⚠️ Blocked (&lt;6 credits)
                              </p>
                            )}
                          </td>

                          {/* Quick Actions */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleAllocateCredits(100, [u.id])}
                                className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
                                title="Add 100 credits"
                              >
                                +100
                              </button>
                              <button
                                onClick={() => handleAllocateCredits(500, [u.id])}
                                className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
                                title="Add 500 credits"
                              >
                                +500
                              </button>
                              <button
                                onClick={() => handleAllocateCredits(1000, [u.id])}
                                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-500/15"
                                title="Add 1,000 credits"
                              >
                                +1,000
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUserIds([u.id])
                                  setAllocateMode('selected')
                                  setAllocateAmount(1000)
                                  setShowAllocateModal(true)
                                }}
                                className="rounded-lg border border-border p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Custom credit amount"
                              >
                                <Settings2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : portalTab === 'models' ? (
        /* GOOGLE MODEL ANALYTICS TAB */
        <div className="space-y-8">
          {/* Overview KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                  <Cpu className="size-5" />
                </span>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  {modelAnalytics?.overview.modelsTrackedCount || 0} Models Tracked
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total API Invocations
              </p>
              <p className="mt-1 text-2xl font-bold">
                {modelAnalytics?.overview.totalInvocations || 0}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <CheckCircle2 className="size-3" />
                  {modelAnalytics?.models.reduce((acc, m) => acc + m.successCalls, 0) || 0} Success
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                  <AlertTriangle className="size-3" />
                  {modelAnalytics?.models.reduce((acc, m) => acc + m.rateLimitedCalls + m.overloadedCalls, 0) || 0} Fallbacks
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <Zap className="size-5" />
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  Usage
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Tokens Consumed
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                {(modelAnalytics?.overview.totalTokensConsumed || 0).toLocaleString()}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Prompt: {(modelAnalytics?.models.reduce((acc, m) => acc + m.totalPromptTokens, 0) || 0).toLocaleString()} · Output: {(modelAnalytics?.models.reduce((acc, m) => acc + m.totalCandidatesTokens, 0) || 0).toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Activity className="size-5" />
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  (modelAnalytics?.overview.overallSuccessRate ?? 100) >= 90
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}>
                  Reliability
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Overall Success Rate
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {modelAnalytics?.overview.overallSuccessRate ?? 100}%
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Across primary & fallback model tiers
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                  <Clock className="size-5" />
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Latency
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Mean Roundtrip Latency
              </p>
              <p className="mt-1 text-2xl font-bold">
                {modelAnalytics?.overview.avgOverallLatencyMs || 0} <span className="text-sm font-normal text-muted-foreground">ms</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Avg end-to-end extraction response time
              </p>
            </div>
          </div>

          {/* Model Breakdown Section */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="flex flex-col justify-between gap-2 border-b border-border p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold">Gemini Model Breakdown & Tier Performance</h2>
                <p className="text-xs text-muted-foreground">
                  Individual telemetry per model ID with rate-limit and server-overload detection
                </p>
              </div>
              <button
                onClick={loadModelAnalytics}
                disabled={loadingAnalytics}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RefreshCw className={`size-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loadingAnalytics && !modelAnalytics ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : !modelAnalytics?.models || modelAnalytics.models.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No Gemini model calls recorded yet. Telemetry will automatically log when resumes or jobs are processed.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Model</th>
                      <th className="px-5 py-3">Traffic Share</th>
                      <th className="px-5 py-3">Invocations</th>
                      <th className="px-5 py-3">429 Rate Limits</th>
                      <th className="px-5 py-3">503 Overloads</th>
                      <th className="px-5 py-3">Total Tokens</th>
                      <th className="px-5 py-3">Avg Latency</th>
                      <th className="px-5 py-3 text-right">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {modelAnalytics.models.map((m) => {
                      const isHighSuccess = m.successRate >= 90
                      const isMediumSuccess = m.successRate >= 75
                      return (
                        <tr key={m.model} className="transition hover:bg-muted/20">
                          {/* Model */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-xs">
                                <Cpu className="size-4" />
                              </span>
                              <div>
                                <p className="font-mono text-xs font-bold text-foreground">{m.model}</p>
                                <p className="text-[11px] text-muted-foreground">Google Generative Language</p>
                              </div>
                            </div>
                          </td>

                          {/* Traffic Share */}
                          <td className="px-5 py-4">
                            <div className="w-28">
                              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                <span>{m.sharePercentage}%</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                                <div
                                  className="h-1.5 rounded-full bg-primary"
                                  style={{ width: `${m.sharePercentage}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Invocations */}
                          <td className="px-5 py-4">
                            <span className="font-semibold text-foreground">{m.totalCalls}</span>
                            <span className="text-xs text-muted-foreground"> calls</span>
                          </td>

                          {/* Rate limits 429 */}
                          <td className="px-5 py-4">
                            {m.rateLimitedCalls > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                                <AlertTriangle className="size-3" />
                                {m.rateLimitedCalls}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </td>

                          {/* Overloads 503 */}
                          <td className="px-5 py-4">
                            {m.overloadedCalls > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600">
                                <AlertTriangle className="size-3" />
                                {m.overloadedCalls}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </td>

                          {/* Total Tokens */}
                          <td className="px-5 py-4">
                            <p className="font-semibold text-foreground">{m.totalTokens.toLocaleString()}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {m.totalPromptTokens.toLocaleString()} in / {m.totalCandidatesTokens.toLocaleString()} out
                            </p>
                          </td>

                          {/* Avg Latency */}
                          <td className="px-5 py-4">
                            <span className="font-medium text-foreground">{m.avgDurationMs}</span>
                            <span className="text-xs text-muted-foreground"> ms</span>
                          </td>

                          {/* Success Rate */}
                          <td className="px-5 py-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                                isHighSuccess
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : isMediumSuccess
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {m.successRate}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Operation Distribution and Telemetry Log */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Operations Breakdown */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs lg:col-span-1">
              <div className="border-b border-border p-5">
                <h3 className="text-sm font-bold">Operation Distribution</h3>
                <p className="text-xs text-muted-foreground">Workload breakdown by AI task</p>
              </div>
              <div className="divide-y divide-border p-2">
                {!modelAnalytics?.operations || modelAnalytics.operations.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">No operations recorded yet.</p>
                ) : (
                  modelAnalytics.operations.map((op) => {
                    const labelMap: Record<string, string> = {
                      extract_candidate_from_resume: 'Standard Resume Parser',
                      extract_candidate_pdf_buffer: 'Multimodal PDF OCR',
                      extract_candidate_custom_columns: 'Dynamic Column Mapping',
                      analyze_job_description: 'Job Description Analyzer',
                    }
                    const displayName = labelMap[op.name] || op.name

                    return (
                      <div key={op.name} className="flex items-center justify-between p-3 transition hover:bg-muted/30 rounded-xl">
                        <div>
                          <p className="text-xs font-semibold text-foreground">{displayName}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{op.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-foreground">{op.calls} calls</p>
                          <p className="text-[11px] text-muted-foreground">{op.tokens.toLocaleString()} tokens</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Live Invocations Stream */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs lg:col-span-2">
              <div className="border-b border-border p-5">
                <h3 className="text-sm font-bold">Recent Model Invocations Stream</h3>
                <p className="text-xs text-muted-foreground">Last 20 Google Gemini API calls with latency and HTTP status</p>
              </div>
              {!modelAnalytics?.recentLogs || modelAnalytics.recentLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No invocation logs available yet.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted/90 text-muted-foreground font-semibold uppercase tracking-wider backdrop-blur-xs">
                      <tr>
                        <th className="px-4 py-2.5">Time</th>
                        <th className="px-4 py-2.5">Model</th>
                        <th className="px-4 py-2.5">Operation</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Tokens</th>
                        <th className="px-4 py-2.5 text-right">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {modelAnalytics.recentLogs.map((log) => {
                        const isSuccess = log.status === 'success'
                        const is429 = log.statusCode === 429
                        const is503 = log.statusCode === 503

                        return (
                          <tr key={log.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-2 font-semibold text-foreground">
                              {log.model}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground font-sans text-[11px]">
                              {log.operation.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isSuccess
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : is429
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : is503
                                    ? 'bg-orange-500/10 text-orange-600'
                                    : 'bg-rose-500/10 text-rose-600'
                                }`}
                              >
                                {isSuccess ? '200 OK' : is429 ? '429 Quota' : is503 ? '503 Overload' : `Err ${log.statusCode || ''}`}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {log.tokens > 0 ? log.tokens.toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-2 text-right text-foreground font-semibold">
                              {log.durationMs}ms
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* CLIENTS TAB */
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Building2 className="size-5" />
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {clients.filter((c) => c.status === 'Active').length} Active
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Client Companies</p>
              <p className="mt-1 text-2xl font-bold">{clients.length}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarSign className="size-5" />
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  MRR
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Monthly Service Revenue</p>
              <p className="mt-1 text-2xl font-bold">${totalRevenue.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Users className="size-5" />
                </span>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                  MongoDB Pool
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Candidates Analyzed</p>
              <p className="mt-1 text-2xl font-bold">{totalCandidates}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <BriefcaseBusiness className="size-5" />
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  Live Roles
                </span>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Managed Open Positions</p>
              <p className="mt-1 text-2xl font-bold">{totalJobs}</p>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search client companies by name, domain, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="All">All Plans</option>
                <option value="Starter">Starter ($299)</option>
                <option value="Growth">Growth ($799)</option>
                <option value="Enterprise">Enterprise ($1499)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Trial">Trial</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Clients Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <div className="border-b border-border p-5">
              <h2 className="text-base font-semibold">Client Organization Roster</h2>
              <p className="text-xs text-muted-foreground">Showing {filteredClients.length} of {clients.length} client companies</p>
            </div>

            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No client companies found matching the filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-left">
                  <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Client Company</th>
                      <th className="px-5 py-3">Plan / Fee</th>
                      <th className="px-5 py-3">Jobs Quota</th>
                      <th className="px-5 py-3">Candidates Parsed</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Drive</th>
                      <th className="px-4 py-3 text-center">JD</th>
                      <th className="px-4 py-3 text-center">Automation</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {filteredClients.map((client) => {
                      const jobPct = Math.min(100, Math.round(((client.activeJobsCount || 0) / client.maxJobs) * 100))
                      const candPct = Math.min(100, Math.round(((client.candidatesCount || 0) / client.maxCandidates) * 100))

                      return (
                        <tr key={client.id} className="transition hover:bg-muted/20">
                          {/* Client Info */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span
                                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-xs"
                                style={{ backgroundColor: client.brandColor || '#2563eb' }}
                              >
                                {client.name.slice(0, 2).toUpperCase()}
                              </span>
                              <div>
                                <p className="font-semibold text-foreground">{client.name}</p>
                                <p className="text-xs text-muted-foreground">{client.contactEmail}</p>
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-5 py-4">
                            <span className="font-medium">{client.plan}</span>
                            <p className="text-xs text-muted-foreground">${client.monthlyFee || 499}/mo</p>
                          </td>

                          {/* Jobs Quota */}
                          <td className="px-5 py-4">
                            <div className="w-32">
                              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                <span>{client.activeJobsCount || 0} active</span>
                                <span>{client.maxJobs} max</span>
                              </div>
                              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                                <div
                                  className="h-1.5 rounded-full bg-primary"
                                  style={{ width: `${jobPct}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Candidates Quota */}
                          <td className="px-5 py-4">
                            <div className="w-36">
                              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                <span>{client.candidatesCount || 0} profiles</span>
                                <span>{client.maxCandidates} cap</span>
                              </div>
                              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                                <div
                                  className="h-1.5 rounded-full bg-emerald-500"
                                  style={{ width: `${candPct}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                client.status === 'Active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : client.status === 'Trial'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  client.status === 'Active'
                                    ? 'bg-emerald-500'
                                    : client.status === 'Trial'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                              />
                              {client.status}
                            </span>
                          </td>

                          {/* Automation Columns */}
                          {(['drive', 'jd', 'automation'] as const).map((key) => {
                            const autoSummary = automationMap[client.id!]
                            const status: string = autoSummary ? autoSummary[key] : 'NOT_CONFIGURED'
                            return (
                              <td key={key} className="px-4 py-4 text-center">
                                {!autoSummary ? (
                                  <Loader2 className="mx-auto size-3.5 animate-spin text-muted-foreground" />
                                ) : status === 'CONFIGURED' || status === 'ACTIVE' ? (
                                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" title="Connected">
                                    <CheckCircle2 className="size-3.5" />
                                  </span>
                                ) : status === 'PARTIAL' ? (
                                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-100 text-amber-700" title="Partially configured">
                                    <AlertTriangle className="size-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground" title="Not configured">
                                    <X className="size-3.5" />
                                  </span>
                                )}
                              </td>
                            )
                          })}

                          {/* Actions */}
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedDetailClient(client)}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="View automation settings and users"
                              >
                                <Eye className="size-3.5" />
                                <span>Inspect</span>
                              </button>

                              <button
                                onClick={() =>
                                  onSelectClientWorkspace({
                                    slug: client.slug,
                                    name: client.name,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                                title="Switch workspace to this client"
                              >
                                <span>Open Workspace</span>
                                <ArrowRight className="size-3" />
                              </button>

                              <button
                                onClick={() => setEditingClient(client)}
                                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Edit client quotas and branding"
                              >
                                <Settings2 className="size-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteClient(client.id!, client.name)}
                                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                                title="Remove client"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Allocate Credits */}
      {showAllocateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Coins className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold">Allocate User Credits</h3>
                  <p className="text-xs text-muted-foreground">Resume processing costs 6 credits per candidate</p>
                </div>
              </div>
              <button
                onClick={() => setShowAllocateModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Allocation Target Selection */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Target Recipients</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAllocateMode('selected')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                      allocateMode === 'selected'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <CheckSquare className="size-3.5" />
                    Selected ({selectedUserIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocateMode('all')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                      allocateMode === 'all'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Users className="size-3.5" />
                    All Users ({users.length})
                  </button>
                </div>
              </div>

              {/* Amount Presets */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Credit Amount</label>
                <div className="mb-2 flex items-center gap-2">
                  {[100, 500, 1000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAllocateAmount(amt)}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-bold transition ${
                        allocateAmount === amt
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  value={allocateAmount}
                  onChange={(e) => setAllocateAmount(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter credit amount (e.g. 1000)"
                />
              </div>

              {/* Note */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Grant Note (Optional)</label>
                <input
                  type="text"
                  value={allocateNote}
                  onChange={(e) => setAllocateNote(e.target.value)}
                  placeholder="e.g. Initial grant, Monthly replenishment"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700">
                <p className="font-semibold">Allocation Preview:</p>
                <p className="mt-0.5">
                  {allocateMode === 'all'
                    ? `Each of all ${users.length} registered user(s) will receive +${allocateAmount.toLocaleString()} credits.`
                    : selectedUserIds.length > 0
                    ? `Each of the ${selectedUserIds.length} selected user(s) will receive +${allocateAmount.toLocaleString()} credits.`
                    : 'No users selected. Please select users from the table or choose "All Users".'}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={allocating || (allocateMode === 'selected' && selectedUserIds.length === 0)}
                  onClick={() =>
                    handleAllocateCredits(
                      allocateAmount,
                      allocateMode === 'selected' ? selectedUserIds : undefined,
                      allocateMode === 'all'
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {allocating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Allocating...
                    </>
                  ) : (
                    <>
                      <Coins className="size-4" /> Grant {allocateAmount.toLocaleString()} Credits
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Onboard Client */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold">Onboard New Client Company</h3>
                  <p className="text-xs text-muted-foreground">Provision a dedicated recruitment workspace</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Global"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Domain / Subdomain</label>
                  <input
                    type="text"
                    placeholder="e.g. apex.com"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Contact Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="recruiter@client.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Primary contact name"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Subscription Plan</label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value as SubscriptionPlan })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Starter">Starter ($299/mo · 5 jobs · 100 resumes)</option>
                    <option value="Growth">Growth ($799/mo · 20 jobs · 500 resumes)</option>
                    <option value="Enterprise">Enterprise ($1499/mo · 50 jobs · 1000 resumes)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ClientStatus })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Active">Active</option>
                    <option value="Trial">14-Day Free Trial</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* White-label branding */}
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">White-Label Branding</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Custom Portal Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Apex TalentFlow"
                      value={formData.whiteLabelName}
                      onChange={(e) => setFormData({ ...formData, whiteLabelName: e.target.value })}
                      className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Brand Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.brandColor}
                        onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                        className="size-8 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                      />
                      <span className="text-xs text-muted-foreground font-mono">{formData.brandColor}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Provision Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Client */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-bold">Edit Client Settings: {editingClient.name}</h3>
              <button
                onClick={() => setEditingClient(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">Subscription Plan</label>
                <select
                  value={editingClient.plan}
                  onChange={(e) => setEditingClient({ ...editingClient, plan: e.target.value as SubscriptionPlan })}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm"
                >
                  <option value="Starter">Starter ($299/mo)</option>
                  <option value="Growth">Growth ($799/mo)</option>
                  <option value="Enterprise">Enterprise ($1499/mo)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Account Status</label>
                <select
                  value={editingClient.status}
                  onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value as ClientStatus })}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm"
                >
                  <option value="Active">Active</option>
                  <option value="Trial">Trial</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Max Jobs Cap</label>
                  <input
                    type="number"
                    value={editingClient.maxJobs}
                    onChange={(e) => setEditingClient({ ...editingClient, maxJobs: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Max Candidates Cap</label>
                  <input
                    type="number"
                    value={editingClient.maxCandidates}
                    onChange={(e) => setEditingClient({ ...editingClient, maxCandidates: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">White-label Portal Title</label>
                <input
                  type="text"
                  value={editingClient.whiteLabelName || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, whiteLabelName: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateClient(editingClient.id!, editingClient)}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedDetailClient && (
        <ClientDetail
          client={selectedDetailClient}
          onClose={() => setSelectedDetailClient(null)}
          onNotice={onNotice}
        />
      )}
    </div>
  )
}
