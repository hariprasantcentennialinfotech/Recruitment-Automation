'use client'

import { useState, useEffect } from 'react'
import {
  FolderTree,
  Folder,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Clock,
  ExternalLink,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Info,
  ChevronRight,
  ListFilter,
  Eye,
  Check,
  Loader2,
  Calendar,
  Sliders,
  X,
  CheckSquare,
  Square,
} from 'lucide-react'

interface JobHierarchyItem {
  jobId: string
  title: string
  status: string
  resumeFolderId: string
  jdFileId: string
  spreadsheetId: string
  sheetName: string
  sheetColumns: string[]
  enabled: boolean
  isConfigured: boolean
  activeMode?: boolean
  watchIntervalMinutes?: number
  lastScannedAt?: string | null
}

interface Settings {
  organizationId: string
  driveRootFolderId?: string
  jobsFolderId?: string
  activeMode: boolean
  watchIntervalMinutes: number
  googleConnectedEmail?: string
  googleConnectedAt?: string
  lastScannedAt?: string
  lastWorkflowRunAt?: string
}

interface DriveHierarchyManagerProps {
  organization: string
  onNotice: (msg: string) => void
}

export function DriveHierarchyManager({ organization, onNotice }: DriveHierarchyManagerProps) {
  const [folderInput, setFolderInput] = useState('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [jobs, setJobs] = useState<JobHierarchyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [runningWorkflow, setRunningWorkflow] = useState(false)
  const [reverifying, setReverifying] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [workflowReport, setWorkflowReport] = useState<any>(null)
  const [selectedJob, setSelectedJob] = useState<JobHierarchyItem | null>(null)
  const [runningJobId, setRunningJobId] = useState<string | null>(null)

  // Position Configuration Modal State
  const [configuringJob, setConfiguringJob] = useState<JobHierarchyItem | null>(null)
  const [modalJdInput, setModalJdInput] = useState('')
  const [modalResumeFolderInput, setModalResumeFolderInput] = useState('')
  const [modalSheetInput, setModalSheetInput] = useState('')
  const [modalSheetName, setModalSheetName] = useState('')
  const [modalActiveMode, setModalActiveMode] = useState(true)
  const [modalWatchInterval, setModalWatchInterval] = useState(5)
  const [modalSelectedColumns, setModalSelectedColumns] = useState<string[]>([])
  const [modalAllColumns, setModalAllColumns] = useState<string[]>([])
  const [modalAvailableSheets, setModalAvailableSheets] = useState<string[]>([])
  const [inspectingSheet, setInspectingSheet] = useState(false)
  const [savingJobConfig, setSavingJobConfig] = useState(false)

  // Fetch current settings and jobs
  const loadHierarchyData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/automation/drive-hierarchy')
      let data: any = {}
      if (res.ok) {
        try {
          data = await res.json()
        } catch (e) {
          console.warn('Failed to parse drive-hierarchy JSON response:', e)
        }
      } else {
        const errText = await res.text().catch(() => '')
        console.error('Drive hierarchy request failed with status', res.status, errText)
      }

      if (data.settings) {
        setSettings(data.settings)
        if (data.settings.driveRootFolderId && !folderInput) {
          setFolderInput(data.settings.driveRootFolderId)
        }
      }
      if (data.jobs) {
        setJobs(data.jobs)
        if (data.jobs.length > 0 && !selectedJob) {
          setSelectedJob(data.jobs[0])
        }
      }
    } catch (err) {
      console.error('Failed to load drive hierarchy data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHierarchyData()

    // Check for query parameters from OAuth redirect
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('drive_connected') === 'true') {
        const email = params.get('email')
        onNotice(`🎉 Google Drive connected successfully${email ? ` as ${email}` : ''}! You can now auto-discover your jobs.`)
        // Clean URL params without reloading
        const cleanUrl = window.location.pathname + '?activeView=Automation'
        window.history.replaceState({}, '', cleanUrl)
      } else if (params.get('drive_error')) {
        onNotice(`⚠️ Google Drive connection failed: ${params.get('drive_error')}`)
        const cleanUrl = window.location.pathname + '?activeView=Automation'
        window.history.replaceState({}, '', cleanUrl)
      }
    }

    // Automated 60-second heartbeat to poll active folders whose interval has elapsed
    const heartbeat = setInterval(() => {
      fetch('/api/automation/poll-active', { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.processedCount > 0) {
            onNotice(`✨ Active Watch scanned: ${data.processedCount} resume(s) processed & synced!`)
            loadHierarchyData()
          }
        })
        .catch(() => {})
    }, 60_000)

    return () => clearInterval(heartbeat)
  }, [])

  // 1-Click OAuth Connect Handler
  const handleConnectGoogleDrive = () => {
    window.location.href = `/api/auth/google/drive?organization=${encodeURIComponent(organization)}&returnTo=${encodeURIComponent('/?activeView=Automation')}`
  }

  // Disconnect OAuth Handler
  const handleDisconnectGoogleDrive = async () => {
    try {
      setDisconnecting(true)
      const res = await fetch('/api/automation/disconnect-drive', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect')
      onNotice('Google Drive disconnected successfully.')
      await loadHierarchyData()
    } catch (err: any) {
      onNotice(err.message || 'Error disconnecting Google Drive')
    } finally {
      setDisconnecting(false)
    }
  }

  // Auto-Discover Handler
  const handleDiscover = async () => {
    if (!folderInput.trim()) {
      onNotice('Please enter your Google Drive folder ID or URL')
      return
    }

    try {
      setDiscovering(true)
      const res = await fetch('/api/automation/drive-hierarchy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootFolderId: folderInput.trim() }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Discovery failed')

      onNotice(data.message || `Discovered ${data.discoveredJobs?.length || 0} job(s) from Google Drive!`)
      await loadHierarchyData()
    } catch (err: any) {
      onNotice(err.message || 'Error discovering Google Drive folders')
    } finally {
      setDiscovering(false)
    }
  }

  // Update Settings Handler (Active Mode & Interval)
  const handleUpdateSettings = async (updates: Partial<Settings>) => {
    try {
      setSavingSettings(true)
      const newSettings = { ...(settings || {}), ...updates }

      const res = await fetch('/api/automation/drive-hierarchy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to update settings')

      setSettings(data.settings)
      onNotice(data.message || 'Settings updated')
    } catch (err: any) {
      onNotice(err.message || 'Error updating settings')
    } finally {
      setSavingSettings(false)
    }
  }

  // Start Workflow Handler (with optional forceReprocess)
  const handleStartWorkflow = async (forceReprocess = false) => {
    try {
      setRunningWorkflow(true)
      setReverifying(forceReprocess)
      setWorkflowReport(null)

      const res = await fetch('/api/automation/start-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReprocess }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Workflow execution failed')

      setWorkflowReport(data)
      onNotice(data.message || (forceReprocess ? 'Re-verification workflow completed!' : 'Workflow finished processing!'))
      await loadHierarchyData()
    } catch (err: any) {
      onNotice(err.message || 'Workflow execution failed')
    } finally {
      setRunningWorkflow(false)
      setReverifying(false)
    }
  }

  // Open Configuration Modal for a Position
  const openConfigModal = (job: JobHierarchyItem) => {
    setConfiguringJob(job)
    setModalJdInput(job.jdFileId || '')
    setModalResumeFolderInput(job.resumeFolderId || '')
    setModalSheetInput(job.spreadsheetId || '')
    setModalSheetName(job.sheetName || 'Candidate Tracking')
    setModalActiveMode(job.activeMode ?? job.enabled ?? true)
    setModalWatchInterval(job.watchIntervalMinutes || 5)
    const existingCols = job.sheetColumns && job.sheetColumns.length > 0 ? job.sheetColumns : []
    setModalSelectedColumns(existingCols)
    setModalAllColumns(existingCols)
    setModalAvailableSheets(job.sheetName ? [job.sheetName] : [])

    if (job.spreadsheetId) {
      inspectSheetColumns(job.spreadsheetId, job.sheetName, existingCols)
    }
  }

  // Handle Run Once for a specific Position / Folder
  const handleRunOnce = async (jobId: string, jobTitle: string) => {
    try {
      setRunningJobId(jobId)
      onNotice(`⏳ Scanning and processing resumes for "${jobTitle}"...`)
      const res = await fetch('/api/automation/run-once', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      const data = await res.json()
      if (res.ok) {
        onNotice(`✅ ${data.message || `Run Once complete for "${jobTitle}"`}`)
        await loadHierarchyData()
      } else {
        onNotice(`❌ Run Once failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      onNotice(`❌ Error running workflow: ${err.message}`)
    } finally {
      setRunningJobId(null)
    }
  }

  // Quick toggle Active Mode or Watch Interval for a specific Job
  const handleUpdateJobWatch = async (
    jobId: string,
    updates: { activeMode?: boolean; watchIntervalMinutes?: number }
  ) => {
    try {
      const targetJob = jobs.find((j) => j.jobId === jobId)
      if (!targetJob) return

      // Optimistic UI update
      setJobs((prev) =>
        prev.map((j) => (j.jobId === jobId ? { ...j, ...updates } : j))
      )

      const res = await fetch(`/api/jobs/${jobId}/automation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleDriveResumeFolderId: targetJob.resumeFolderId,
          googleDriveJdFileId: targetJob.jdFileId,
          googleSheetsSpreadsheetId: targetJob.spreadsheetId,
          googleSheetsSheetName: targetJob.sheetName,
          sheetColumns: targetJob.sheetColumns,
          enabled: updates.activeMode !== undefined ? updates.activeMode : targetJob.enabled,
          activeMode: updates.activeMode !== undefined ? updates.activeMode : targetJob.activeMode,
          watchIntervalMinutes:
            updates.watchIntervalMinutes !== undefined
              ? updates.watchIntervalMinutes
              : targetJob.watchIntervalMinutes,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        onNotice(`⚠️ Failed to update position watch settings: ${data.error}`)
        await loadHierarchyData()
      } else {
        if (updates.activeMode !== undefined) {
          onNotice(`Watch mode ${updates.activeMode ? 'ENABLED' : 'PAUSED'} for "${targetJob.title}"`)
        } else if (updates.watchIntervalMinutes !== undefined) {
          onNotice(`Watch interval set to every ${updates.watchIntervalMinutes} minutes for "${targetJob.title}"`)
        }
      }
    } catch (err: any) {
      onNotice(`⚠️ Error updating watch settings: ${err.message}`)
      await loadHierarchyData()
    }
  }

  // Inspect Google Sheet Tabs & Columns
  const inspectSheetColumns = async (sheetInput?: string, sheetTab?: string, existingSelected?: string[]) => {
    const targetInput = (sheetInput || modalSheetInput).trim()
    if (!targetInput) {
      onNotice('Please enter a Google Sheet URL or ID first')
      return
    }

    try {
      setInspectingSheet(true)
      const res = await fetch('/api/automation/inspect-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetInput: targetInput,
          sheetName: sheetTab || modalSheetName,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to inspect Google Sheet')

      if (data.availableSheets && data.availableSheets.length > 0) {
        setModalAvailableSheets(data.availableSheets)
      }
      if (data.sheetName) {
        setModalSheetName(data.sheetName)
      }
      if (data.columns && Array.isArray(data.columns)) {
        setModalAllColumns(data.columns)
        const currentSelected = existingSelected || modalSelectedColumns
        if (!currentSelected || currentSelected.length === 0) {
          setModalSelectedColumns(data.columns)
        } else {
          const validSelected = currentSelected.filter((c: string) => data.columns.includes(c))
          setModalSelectedColumns(validSelected.length > 0 ? validSelected : data.columns)
        }
      }
      onNotice(`Discovered ${data.columns?.length || 0} columns from sheet "${data.sheetName}"`)
    } catch (err: any) {
      onNotice(err.message || 'Error inspecting sheet')
    } finally {
      setInspectingSheet(false)
    }
  }

  const toggleColumnSelection = (col: string) => {
    setModalSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  }

  const handleSelectAllColumns = () => {
    setModalSelectedColumns([...modalAllColumns])
  }

  const handleDeselectAllColumns = () => {
    setModalSelectedColumns([])
  }

  const handleSaveJobConfig = async () => {
    if (!configuringJob) return
    try {
      setSavingJobConfig(true)
      const res = await fetch(`/api/jobs/${configuringJob.jobId}/automation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleDriveJdFileId: modalJdInput.trim(),
          googleDriveResumeFolderId: modalResumeFolderInput.trim(),
          googleSheetsSpreadsheetId: modalSheetInput.trim(),
          googleSheetsSheetName: modalSheetName.trim() || 'Candidate Tracking',
          sheetColumns: modalSelectedColumns,
          enabled: modalActiveMode,
          activeMode: modalActiveMode,
          watchIntervalMinutes: modalWatchInterval,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration')

      onNotice(`Configuration saved for "${configuringJob.title}"!`)
      setConfiguringJob(null)
      await loadHierarchyData()
    } catch (err: any) {
      onNotice(err.message || 'Error saving job configuration')
    } finally {
      setSavingJobConfig(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <FolderTree className="size-3.5" />
              <span>Multi-Tenant Google Drive Automation</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Recruitment Automation Engine
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Connect your company&apos;s Google Drive folder. The system auto-detects each job, monitors candidate resumes in real time, parses with Gemini AI according to your custom Google Sheet columns, and evaluates against your Job Descriptions.
            </p>
          </div>

          {/* Quick Actions / Status Pill */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 p-3 backdrop-blur">
              <div className={`size-3 rounded-full ${settings?.activeMode ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
              <div className="text-left">
                <p className="text-xs font-semibold">
                  {settings?.activeMode ? 'Active Folder Watcher: ON' : 'Active Folder Watcher: OFF'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {settings?.activeMode ? `Scanning every ${settings.watchIntervalMinutes} minutes` : 'On-demand workflow only'}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleStartWorkflow(false)}
              disabled={runningWorkflow || jobs.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-50"
            >
              {runningWorkflow && !reverifying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Processing Resumes...</span>
                </>
              ) : (
                <>
                  <Play className="size-4 fill-current" />
                  <span>Start Workflow</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleStartWorkflow(true)}
              disabled={runningWorkflow || jobs.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-400 shadow-sm transition disabled:opacity-50"
              title="Re-verify candidate records, extract missing phone/address/details, and sync to Google Sheets without skipping"
            >
              {runningWorkflow && reverifying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Re-verifying & Syncing...</span>
                </>
              ) : (
                <>
                  <RotateCw className="size-4" />
                  <span>Re-verify & Sync All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expected Hierarchy Diagram */}
        <div className="mt-6 rounded-xl border border-border/80 bg-card/60 p-4 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Info className="size-3.5 text-primary" />
            Standard Google Drive Folder Hierarchy Expected:
          </p>
          <div className="font-mono text-xs text-foreground/80 overflow-x-auto whitespace-pre bg-background/50 p-3 rounded-lg border border-border/50">
{`📁 Recruitment Automation
└── 📁 Jobs
    ├── 📁 Systems Integrator - Virtualization SME  ──>  [📁 Resumes]  [📄 Job Description.docx]  [📊 Candidate Tracking]
    ├── 📁 DevOps Engineer                         ──>  [📁 Resumes]  [📄 Job Description.docx]  [📊 Candidate Tracking]
    └── 📁 Cloud Engineer                          ──>  [📁 Resumes]  [📄 Job Description.docx]  [📊 Candidate Tracking]`}
          </div>
        </div>
      </div>

      {/* 1-Click Google Drive User Authorization Card */}
      <div
        className={`rounded-2xl border p-6 shadow-sm transition ${
          settings?.googleConnectedEmail
            ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10'
            : 'border-primary/30 bg-primary/5 dark:bg-primary/10'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                settings?.googleConnectedEmail
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              <svg className="size-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">
                  {settings?.googleConnectedEmail
                    ? 'Google Drive & Sheets Connected'
                    : 'Connect Your Google Drive'}
                </h3>
                {settings?.googleConnectedEmail ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
                    <CheckCircle2 className="size-3" />
                    Authorized
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 border border-amber-500/20">
                    1-Click Setup
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                {settings?.googleConnectedEmail ? (
                  <>
                    Connected as{' '}
                    <span className="font-semibold text-foreground">
                      {settings.googleConnectedEmail}
                    </span>
                    . Your resume folders and tracking sheets will be read and updated securely
                    using this account without sharing folders with any bot emails.
                  </>
                ) : (
                  'Authorize our app directly through Google. No folder sharing or service account emails needed — your Drive folders and Google Sheets will be accessed securely with your permission.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {settings?.googleConnectedEmail ? (
              <>
                <button
                  onClick={handleConnectGoogleDrive}
                  className="rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
                >
                  Switch Account
                </button>
                <button
                  onClick={handleDisconnectGoogleDrive}
                  disabled={disconnecting}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 transition disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectGoogleDrive}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
              >
                <svg className="size-4 fill-current" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>Connect Google Drive (1-Click)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Control Panel: Discovery & Watch Settings */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Drive Root Folder Connect */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
            <Folder className="size-4 text-primary" />
            Connect Google Drive Root Folder
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Paste the URL or ID of your &quot;Recruitment Automation&quot; or &quot;Jobs&quot; Google Drive folder.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g. https://drive.google.com/drive/folders/1ABC..."
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
            />
            <button
              onClick={handleDiscover}
              disabled={discovering || !folderInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary/80 disabled:opacity-50 whitespace-nowrap"
            >
              {discovering ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <RotateCw className="size-4" />
                  <span>Auto-Discover</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Active Mode & Interval Settings */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Active Mode & Watch Interval
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            When Active Mode is enabled, the system continuously polls configured resume folders for incoming candidates.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={settings?.activeMode || false}
                disabled={savingSettings}
                onClick={() => handleUpdateSettings({ activeMode: !settings?.activeMode })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings?.activeMode ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                    settings?.activeMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm font-medium">
                {settings?.activeMode ? 'Active Watch Mode Enabled' : 'Active Watch Mode Disabled'}
              </span>
            </div>

            {/* Interval Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Check every:</span>
              <select
                value={settings?.watchIntervalMinutes || 5}
                onChange={(e) => handleUpdateSettings({ watchIntervalMinutes: parseInt(e.target.value, 10) })}
                disabled={savingSettings}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
              >
                <option value={5}>Every 5 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 1 hour</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Run Execution Output Alert */}
      {workflowReport && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                {workflowReport.message}
              </p>
              <p className="text-xs text-muted-foreground">
                Checked {workflowReport.jobsChecked} job(s) · Ingested & synchronized {workflowReport.candidatesProcessed} candidate(s).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Discovered Jobs List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Discovered Positions ({jobs.length})</h2>
            <p className="text-xs text-muted-foreground">
              Jobs automatically configured from your Google Drive structure. Click &quot;Configure&quot; on any role to customize its JD file, resume folder, or sheet columns.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleStartWorkflow(true)}
              disabled={runningWorkflow || jobs.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 transition disabled:opacity-50"
              title="Re-verify candidate records without skipping incomplete names or contact details"
            >
              <RotateCw className="size-3.5" />
              <span>Re-verify & Sync</span>
            </button>
            <button
              onClick={loadHierarchyData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition"
            >
              <RotateCw className="size-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <FolderTree className="mx-auto size-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold">No Google Drive Jobs Connected Yet</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
              Enter your &quot;Recruitment Automation&quot; root folder URL above and click &quot;Auto-Discover&quot; to automatically register all positions.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {jobs.map((job) => {
              const isSelected = selectedJob?.jobId === job.jobId
              return (
                <div
                  key={job.jobId}
                  onClick={() => setSelectedJob(job)}
                  className={`cursor-pointer rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="font-semibold text-sm leading-snug">{job.title}</h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0 ${
                          job.isConfigured
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {job.isConfigured ? 'Ready ✓' : 'Incomplete'}
                      </span>
                    </div>

                    {/* 3 Component Badges */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Folder className="size-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">
                          Resumes: {job.resumeFolderId ? 'Configured ✓' : 'Missing'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="size-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">
                          JD File: {job.jdFileId ? 'Configured ✓' : 'Missing'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileSpreadsheet className="size-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">
                          Tracker: {job.spreadsheetId ? `${job.sheetName} (${job.sheetColumns.length || 0} cols)` : 'Missing'}
                        </span>
                      </div>
                    </div>

                    {/* Detected Column Pills Preview */}
                    {job.sheetColumns && job.sheetColumns.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border/50">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                          Gemini Extraction Target Columns:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {job.sheetColumns.slice(0, 5).map((col, idx) => (
                            <span
                              key={idx}
                              className="rounded-md bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
                            >
                              {col}
                            </span>
                          ))}
                          {job.sheetColumns.length > 5 && (
                            <span className="rounded-md bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              +{job.sheetColumns.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Per-Folder Active Watch & Interval Controls */}
                  <div className="mt-4 pt-3 border-t border-border/60 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={job.activeMode ?? job.enabled ?? false}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateJobWatch(job.jobId, {
                              activeMode: !(job.activeMode ?? job.enabled ?? false),
                            })
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            (job.activeMode ?? job.enabled) ? 'bg-emerald-500' : 'bg-muted'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                              (job.activeMode ?? job.enabled) ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="font-semibold text-[11px]">
                          {(job.activeMode ?? job.enabled) ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Active Watch</span>
                          ) : (
                            <span className="text-muted-foreground">Paused</span>
                          )}
                        </span>
                      </div>

                      {/* Watch Interval Dropdown */}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Clock className="size-3 text-muted-foreground" />
                        <select
                          value={job.watchIntervalMinutes || 5}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleUpdateJobWatch(job.jobId, {
                              watchIntervalMinutes: parseInt(e.target.value, 10),
                            })
                          }}
                          className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value={5}>Every 5m</option>
                          <option value={10}>Every 10m</option>
                          <option value={15}>Every 15m</option>
                          <option value={30}>Every 30m</option>
                          <option value={60}>Every 1h</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Buttons: Run Once & Configure */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRunOnce(job.jobId, job.title)
                        }}
                        disabled={runningJobId === job.jobId || !job.resumeFolderId}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition shadow-sm disabled:opacity-50"
                        title="Immediately scan this folder, extract candidate details, and sync to Google Sheets"
                      >
                        {runningJobId === job.jobId ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>Running...</span>
                          </>
                        ) : (
                          <>
                            <Play className="size-3.5 fill-current" />
                            <span>Run Once</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openConfigModal(job)
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 px-3 py-2 text-xs font-semibold text-primary transition shadow-sm"
                      >
                        <Sliders className="size-3.5" />
                        <span>Configure</span>
                      </button>
                    </div>

                    {/* Last Scanned indicator */}
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>
                        {job.lastScannedAt
                          ? `Last check: ${new Date(job.lastScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'Pending first check'}
                      </span>
                      {job.activeMode ?? job.enabled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Auto-sync on
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected Job Column Inspector */}
      {selectedJob && selectedJob.sheetColumns && selectedJob.sheetColumns.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">
                Google Sheet Column Mapping for &quot;{selectedJob.title}&quot;
              </h3>
              <p className="text-xs text-muted-foreground">
                Gemini dynamically maps resume details into these exact sheet columns
              </p>
            </div>
            <span className="text-xs font-mono bg-muted px-2.5 py-1 rounded-md">
              {selectedJob.sheetName}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {selectedJob.sheetColumns.map((col, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 p-2.5 text-xs font-medium"
              >
                <span className="size-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-[10px]">
                  {idx + 1}
                </span>
                <span className="truncate">{col}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Job Configuration & Column Selection Modal */}
      {configuringJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl p-6 md:p-8 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Sliders className="size-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    Configure Position: {configuringJob.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select Job Description file, Resume folder, Tracking Sheet, and choose which columns Gemini retrieves and fills.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfiguringJob(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="mt-6 space-y-5">
              {/* JD File */}
              <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <FileText className="size-4 text-amber-500" />
                  1. Job Description File (DOCX or Google Doc)
                </label>
                <p className="text-xs text-muted-foreground">
                  Paste the Google Drive File ID or URL of the JD (.docx or Google Doc). Gemini evaluates candidate skills against this JD.
                </p>
                <input
                  type="text"
                  placeholder="e.g. 1aBcD... or https://docs.google.com/document/d/1ABC..."
                  value={modalJdInput}
                  onChange={(e) => setModalJdInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Resume Folder */}
              <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Folder className="size-4 text-blue-500" />
                  2. Candidate Resumes Root Folder
                </label>
                <p className="text-xs text-muted-foreground">
                  Paste the Google Drive Folder ID or URL where candidate resumes (.pdf, .docx) are stored for this role.
                </p>
                <input
                  type="text"
                  placeholder="e.g. 1rHBb4MX... or https://drive.google.com/drive/folders/1ABC..."
                  value={modalResumeFolderInput}
                  onChange={(e) => setModalResumeFolderInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Google Sheet File & Sheet Tab */}
              <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <FileSpreadsheet className="size-4 text-emerald-500" />
                  3. Candidate Tracking Google Sheet
                </label>
                <p className="text-xs text-muted-foreground">
                  Paste the Google Sheet ID or URL and sheet tab name where processed candidate records will be synced.
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Spreadsheet ID or URL</span>
                    <input
                      type="text"
                      placeholder="e.g. 1GWMq9AL... or https://docs.google.com/spreadsheets/d/1ABC..."
                      value={modalSheetInput}
                      onChange={(e) => setModalSheetInput(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Sheet Tab Name</span>
                    {modalAvailableSheets.length > 1 ? (
                      <select
                        value={modalSheetName}
                        onChange={(e) => {
                          setModalSheetName(e.target.value)
                          inspectSheetColumns(modalSheetInput, e.target.value)
                        }}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {modalAvailableSheets.map((tab) => (
                          <option key={tab} value={tab}>{tab}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. Applicant Record"
                        value={modalSheetName}
                        onChange={(e) => setModalSheetName(e.target.value)}
                        className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-end">
                  <button
                    onClick={() => inspectSheetColumns()}
                    disabled={inspectingSheet || !modalSheetInput.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition disabled:opacity-50"
                  >
                    {inspectingSheet ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        <span>Inspecting Sheet...</span>
                      </>
                    ) : (
                      <>
                        <RotateCw className="size-3.5" />
                        <span>Fetch / Inspect Sheet Columns</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 4. Active Mode & Watch Interval for this Folder */}
              <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  4. Active Mode & Automated Watch Interval
                </label>
                <p className="text-xs text-muted-foreground">
                  Choose whether this folder is continuously monitored and set how often to automatically check and update the candidate sheet.
                </p>

                <div className="grid gap-4 sm:grid-cols-2 pt-1">
                  <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold">Active Watch Mode</div>
                      <div className="text-[11px] text-muted-foreground">
                        {modalActiveMode ? 'Continuous auto-sync enabled' : 'Manual / on-demand only'}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={modalActiveMode}
                      onClick={() => setModalActiveMode(!modalActiveMode)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        modalActiveMode ? 'bg-emerald-500' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                          modalActiveMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-border bg-card p-3">
                    <span className="text-[11px] font-medium text-muted-foreground">Watch Interval</span>
                    <select
                      value={modalWatchInterval}
                      onChange={(e) => setModalWatchInterval(parseInt(e.target.value, 10))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value={5}>Check every 5 minutes</option>
                      <option value={10}>Check every 10 minutes</option>
                      <option value={15}>Check every 15 minutes</option>
                      <option value={30}>Check every 30 minutes</option>
                      <option value={60}>Check every 1 hour</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Column Selection for Gemini Extraction */}
              <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <ListFilter className="size-4 text-primary" />
                      4. Select Columns to Retrieve and Fill in Sheet
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select which sheet columns Gemini should extract and populate. Unselected columns will remain blank.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {modalSelectedColumns.length} of {modalAllColumns.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllColumns}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllColumns}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {modalAllColumns.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-border bg-card/40 text-xs text-muted-foreground">
                    No columns loaded yet. Click &quot;Fetch / Inspect Sheet Columns&quot; above to discover columns from your spreadsheet.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 max-h-60 overflow-y-auto pr-1">
                    {modalAllColumns.map((col, idx) => {
                      const isChecked = modalSelectedColumns.includes(col)
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleColumnSelection(col)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition select-none ${
                            isChecked
                              ? 'border-primary/50 bg-primary/10 text-foreground font-medium'
                              : 'border-border/60 bg-card/60 text-muted-foreground hover:border-border'
                          }`}
                        >
                          <div className={`size-4 rounded flex items-center justify-center shrink-0 border ${
                            isChecked
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/40 bg-background'
                          }`}>
                            {isChecked && <Check className="size-3 stroke-[3]" />}
                          </div>
                          <span className="truncate flex-1">{col}</span>
                          <span className="text-[10px] font-mono opacity-50">#{idx + 1}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="mt-6 pt-4 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfiguringJob(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveJobConfig}
                disabled={savingJobConfig}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition disabled:opacity-50"
              >
                {savingJobConfig ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    <span>Save Configuration</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
