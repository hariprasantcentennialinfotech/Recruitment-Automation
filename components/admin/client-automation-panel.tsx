'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  HelpCircle,
  Loader2,
  Play,
  Pause,
  Plug,
  FileText,
  TestTube2,
  ScrollText,
  RefreshCw,
} from 'lucide-react'
import type { ClientAutomationSummary, JobAutomationSummary, AutomationReadinessStatus } from '@/lib/types'

interface ClientAutomationPanelProps {
  clientId: string
  clientName: string
  onNotice: (msg: string) => void
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AutomationReadinessStatus,
  { label: string; className: string; Icon: React.ElementType }
> = {
  NOT_CONFIGURED: {
    label: 'Not Configured',
    className: 'bg-slate-100 text-slate-600',
    Icon: HelpCircle,
  },
  CONFIGURED: {
    label: 'Configured',
    className: 'bg-blue-50 text-blue-700',
    Icon: CheckCircle2,
  },
  CONNECTED: {
    label: 'Connected',
    className: 'bg-emerald-50 text-emerald-700',
    Icon: CheckCircle2,
  },
  ERROR: {
    label: 'Error',
    className: 'bg-rose-50 text-rose-700',
    Icon: XCircle,
  },
  DISABLED: {
    label: 'Disabled',
    className: 'bg-amber-50 text-amber-700',
    Icon: MinusCircle,
  },
}

function StatusBadge({ status }: { status: AutomationReadinessStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_CONFIGURED
  const Icon = cfg.Icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
    >
      <Icon className="size-3" />
      {cfg.label}
    </span>
  )
}

// ─── Rolled-up column icon ────────────────────────────────────────────────────

function ColStatus({ status }: { status: AutomationReadinessStatus }) {
  if (status === 'CONNECTED') return <CheckCircle2 className="size-4 text-emerald-600" />
  if (status === 'CONFIGURED') return <CheckCircle2 className="size-4 text-blue-500" />
  if (status === 'ERROR') return <XCircle className="size-4 text-rose-600" />
  if (status === 'DISABLED') return <MinusCircle className="size-4 text-amber-500" />
  return <XCircle className="size-4 text-slate-400" />
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ClientAutomationPanel({
  clientId,
  clientName,
  onNotice,
}: ClientAutomationPanelProps) {
  const [summary, setSummary] = useState<ClientAutomationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, any>>({})

  const loadAutomation = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/automation`)
      if (!res.ok) throw new Error('Failed to load automation data')
      const data = await res.json()
      setSummary(data.summary)
    } catch (e: any) {
      onNotice(e.message || 'Failed to load automation data')
    } finally {
      setLoading(false)
    }
  }, [clientId, onNotice])

  useEffect(() => {
    loadAutomation()
  }, [loadAutomation])

  const handleTestConnection = async (job: JobAutomationSummary) => {
    if (!job.configId) {
      onNotice(`No automation config exists for job "${job.jobTitle}". Configure it first.`)
      return
    }
    setTestingId(job.jobId)
    try {
      const res = await fetch(`/api/admin/automation/${job.configId}/test`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test failed')
      setTestResults((prev) => ({ ...prev, [job.jobId]: data.results }))
      onNotice(`Connection test completed for "${job.jobTitle}"`)
    } catch (e: any) {
      onNotice(e.message || 'Test failed')
    } finally {
      setTestingId(null)
    }
  }

  const handleToggle = async (job: JobAutomationSummary) => {
    if (!job.configId) {
      onNotice(`No automation config exists for job "${job.jobTitle}". Configure it first.`)
      return
    }
    setTogglingId(job.jobId)
    try {
      const newEnabled = !job.enabled
      const res = await fetch(`/api/admin/automation/${job.configId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Toggle failed')
      onNotice(`Automation ${newEnabled ? 'enabled' : 'disabled'} for "${job.jobTitle}"`)
      await loadAutomation()
    } catch (e: any) {
      onNotice(e.message || 'Failed to toggle')
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading automation status…
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        No automation data available.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Client-level summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { label: 'Google Drive', key: 'drive' },
            { label: 'JD File', key: 'jd' },
            { label: 'Candidate Tracker', key: 'tracker' },
            { label: 'Automation', key: 'automation' },
          ] as const
        ).map(({ label, key }) => (
          <div key={key} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className="mt-2">
              <StatusBadge status={summary[key]} />
            </div>
          </div>
        ))}
      </div>

      {/* Last resume processed + error count */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">Last Resume Processed: </span>
          {summary.lastResumeProcessed
            ? new Date(summary.lastResumeProcessed).toLocaleString()
            : 'None yet'}
        </span>
        <span>
          <span className="font-medium text-rose-600">Processing Errors: </span>
          {summary.errorCount}
        </span>
        <button
          onClick={loadAutomation}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className="size-3" /> Refresh
        </button>
      </div>

      {/* Per-job table */}
      {summary.jobAutomations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          No jobs found for {clientName}. Create a job first, then configure automation.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold">Per-Job Automation Configuration</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {summary.jobAutomations.length} job(s) · Status computed from live database
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3 text-center">Resume Folder</th>
                  <th className="px-4 py-3 text-center">JD File</th>
                  <th className="px-4 py-3 text-center">Tracker</th>
                  <th className="px-4 py-3 text-center">Automation</th>
                  <th className="px-4 py-3 text-center">Last Processed</th>
                  <th className="px-4 py-3 text-center">Candidates</th>
                  <th className="px-4 py-3 text-center">Errors</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.jobAutomations.map((job) => {
                  const result = testResults[job.jobId]
                  const isTesting = testingId === job.jobId
                  const isToggling = togglingId === job.jobId

                  return (
                    <>
                      <tr key={job.jobId} className="hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-semibold">{job.jobTitle}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {job.configId ? 'Config ID: ' + job.configId.slice(-8) : 'No config'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ColStatus status={job.resumeFolder} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ColStatus status={job.jdFile} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ColStatus status={job.tracker} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={job.automationStatus} />
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                          {job.lastProcessed
                            ? new Date(job.lastProcessed).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">
                          {job.candidateCount}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {job.errorCount > 0 ? (
                            <span className="font-semibold text-rose-600">{job.errorCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Configure — links to job automation config in the tenant */}
                            <a
                              href={`/jobs/${job.jobId}/automation`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                              title="Open automation config for this job"
                            >
                              <Plug className="size-3" /> Configure
                            </a>

                            {/* Test Connection */}
                            <button
                              onClick={() => handleTestConnection(job)}
                              disabled={isTesting || !job.configId}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                              title={job.configId ? 'Test all Google connections' : 'No config to test'}
                            >
                              {isTesting ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <TestTube2 className="size-3" />
                              )}
                              Test
                            </button>

                            {/* Enable / Disable */}
                            <button
                              onClick={() => handleToggle(job)}
                              disabled={isToggling || !job.configId}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
                                job.enabled
                                  ? 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                                  : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={job.enabled ? 'Disable automation' : 'Enable automation'}
                            >
                              {isToggling ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : job.enabled ? (
                                <Pause className="size-3" />
                              ) : (
                                <Play className="size-3" />
                              )}
                              {job.enabled ? 'Disable' : 'Enable'}
                            </button>

                            {/* View Logs */}
                            <a
                              href={`/api/automation/activities?jobId=${job.jobId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                              title="View processing logs for this job"
                            >
                              <ScrollText className="size-3" /> Logs
                            </a>
                          </div>
                        </td>
                      </tr>

                      {/* Test result expansion row */}
                      {result && (
                        <tr key={`${job.jobId}-result`} className="bg-muted/30">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="flex flex-wrap gap-3 text-xs">
                              <span className="font-semibold text-muted-foreground">
                                Test Results:
                              </span>
                              {Object.entries(result).map(([key, val]: [string, any]) => (
                                <span
                                  key={key}
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${
                                    val.status === 'CONNECTED'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : val.status === 'ERROR'
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                  title={val.message}
                                >
                                  {key === 'resumeFolder'
                                    ? 'Drive Folder'
                                    : key === 'jdFile'
                                    ? 'JD File'
                                    : 'Tracker'}
                                  : {val.status}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Status Legend:</span>
        {(Object.entries(STATUS_CONFIG) as [AutomationReadinessStatus, typeof STATUS_CONFIG[AutomationReadinessStatus]][]).map(([key, cfg]) => {
          const Icon = cfg.Icon
          return (
            <span key={key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${cfg.className}`}>
              <Icon className="size-3" />
              {cfg.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
