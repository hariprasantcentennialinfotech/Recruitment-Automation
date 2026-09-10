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
  Eye
} from 'lucide-react'
import { ClientDetail } from '@/components/admin/client-detail'
import { ClientCompany, SubscriptionPlan, ClientStatus } from '@/lib/types'

interface AdminPortalProps {
  // Pass the whole client object so the page can switch context by slug and display name
  onSelectClientWorkspace: (client: { slug: string; name: string }) => void
  onNotice: (message: string) => void
}

export function AdminPortal({ onSelectClientWorkspace, onNotice }: AdminPortalProps) {
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

  useEffect(() => {
    loadClients()
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
            Multi-Tenant Client Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recruitment Automation as a Service (RaaS) · Manage client tenant workspaces, quotas, and white-labeling.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90"
        >
          <Plus className="size-4" /> Onboard Client Company
        </button>
      </div>

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
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Candidate Profiles</p>
          <p className="mt-1 text-2xl font-bold">{totalCandidates.toLocaleString()}</p>
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
                            <p className="text-xs text-muted-foreground">
                              {client.domain || client.slug} · {client.contactEmail}
                            </p>
                            {client.whiteLabelName && (
                              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Palette className="size-3 text-primary" /> {client.whiteLabelName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-4">
                        <div>
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              client.plan === 'Enterprise'
                                ? 'bg-blue-50 text-blue-700'
                                : client.plan === 'Growth'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {client.plan}
                          </span>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">${client.monthlyFee}/mo</p>
                        </div>
                      </td>

                      {/* Jobs Quota */}
                      <td className="px-5 py-4">
                        <div className="w-36">
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
                            ) : status === 'CONNECTED' || status === 'CONFIGURED' ? (
                              <CheckCircle2 className="mx-auto size-4 text-emerald-600" />
                            ) : status === 'ERROR' ? (
                              <AlertTriangle className="mx-auto size-4 text-rose-500" />
                            ) : status === 'DISABLED' ? (
                              <span className="text-[10px] font-semibold text-amber-600">OFF</span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400">—</span>
                            )}
                          </td>
                        )
                      })}

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedDetailClient(client)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                            title="Inspect client detail and automation"
                          >
                            <Eye className="size-3.5" /> Details
                          </button>

                          <button
                            onClick={() => onSelectClientWorkspace({ slug: client.slug, name: client.name })}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                            title="Switch dashboard to this client's workspace"
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
