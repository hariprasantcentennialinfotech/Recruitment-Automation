'use client'

import { useState, useEffect } from 'react'
import { X, Building2, Users, Briefcase, UserCheck, Shield, Sliders, Activity, Sparkles, Settings } from 'lucide-react'
import { ClientCompany } from '@/lib/types'
import { ClientAutomationPanel } from '@/components/admin/client-automation-panel'

interface ClientDetailProps {
  client: ClientCompany
  onClose: () => void
  onNotice: (msg: string) => void
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: Building2 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'jobs', label: 'Jobs', icon: Briefcase },
  { key: 'candidates', label: 'Candidates', icon: UserCheck },
  { key: 'integrations', label: 'Integrations', icon: Shield },
  { key: 'automation', label: 'Automation', icon: Sliders },
  { key: 'usage', label: 'Usage', icon: Activity },
  { key: 'branding', label: 'Branding', icon: Sparkles },
  { key: 'settings', label: 'Settings', icon: Settings },
]

export function ClientDetail({ client, onClose, onNotice }: ClientDetailProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchWithTenant = async (url: string) => {
    const res = await fetch(`${url}?tenantOrg=${encodeURIComponent(client.slug)}`)
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  }

  const loadTabData = async (tab: string) => {
    setLoading(true)
    try {
      switch (tab) {
        case 'overview': {
          const res = await fetch(`/api/admin/clients/${client.id || client._id}`)
          const data = await res.json()
          if (data.client) setStats(data.client)
          break
        }
        case 'users': {
          const res = await fetch(`/api/admin/clients/${client.id || client._id}/users`)
          if (res.ok) {
            const u = await res.json()
            setUsers(u.users || [])
          }
          break
        }
        case 'jobs': {
          const j = await fetchWithTenant('/api/jobs')
          setJobs(j.jobs || [])
          break
        }
        case 'candidates': {
          const c = await fetchWithTenant('/api/candidates')
          setCandidates(c.candidates || [])
          break
        }
        default:
          break
      }
    } catch (e: any) {
      onNotice(e.message || 'Error loading tab data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTabData(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Loading {activeTab} data...
        </div>
      )
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Jobs</p>
                <p className="mt-2 text-2xl font-bold">{stats?.totalJobsCount ?? client.activeJobsCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Open Jobs</p>
                <p className="mt-2 text-2xl font-bold">{stats?.activeJobsCount ?? client.activeJobsCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Candidates</p>
                <p className="mt-2 text-2xl font-bold">{stats?.candidatesCount ?? client.candidatesCount ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Monthly Fee</p>
                <p className="mt-2 text-2xl font-bold">${client.monthlyFee || 499}/mo</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Client Company Information</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Company Name</p>
                  <p className="font-medium mt-0.5">{client.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tenant Slug</p>
                  <p className="font-mono text-xs mt-0.5">{client.slug}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Domain</p>
                  <p className="font-medium mt-0.5">{client.domain || 'Not configured'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact Email</p>
                  <p className="font-medium mt-0.5">{client.contactEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Subscription Plan</p>
                  <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary mt-1">
                    {client.plan}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Account Status</p>
                  <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 mt-1">
                    {client.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )

      case 'users':
        return (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {users.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No users provisioned under this client organization yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => (
                    <tr key={u.id || u._id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{u.fullName || u.name || 'User'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {u.role || 'Member'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Recent'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'jobs':
        return (
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No jobs created for this client organization yet.
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <p className="font-semibold">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.team} · {job.location}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    job.status === 'Open' ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
                  }`}>
                    {job.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )

      case 'candidates':
        return (
          <div className="space-y-3">
            {candidates.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                No candidates imported or processed for this client organization yet.
              </div>
            ) : (
              candidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <p className="font-semibold">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground">{c.email || c.location || 'Profile'}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {c.stage || 'Sourcing'}
                  </span>
                </div>
              ))
            )}
          </div>
        )

      case 'automation':
        return (
          <ClientAutomationPanel
            clientId={client.id || client._id || ''}
            clientName={client.name}
            onNotice={onNotice}
          />
        )

      default:
        return (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} configuration for {client.name} is active and managed via tenant settings.
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 items-center justify-center rounded-xl text-sm font-bold text-white shadow-xs"
              style={{ backgroundColor: client.brandColor || '#2563eb' }}
            >
              {client.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground">{client.name}</h2>
              <p className="text-xs text-muted-foreground">{client.domain || client.slug} · Management Console</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-border px-6 gap-1 scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">{renderTabContent()}</div>
      </div>
    </div>
  )
}
