'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Sliders,
  Folder,
  FileText,
  Table,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Cloud,
  Save,
  Briefcase,
  ExternalLink,
  RotateCw,
  Sparkles,
  UserCheck,
  FileSpreadsheet,
  Layers,
  Activity,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { JobDocument, ConnectionState, ResumeProcessingRecord, ProcessingStatus } from '@/lib/types'

interface JobSettingsModalProps {
  job: JobDocument
  initialTab?: 'Overview' | 'Automation' | 'Activity' | 'Settings'
  onClose: () => void
  onNotice: (msg: string) => void
  onJobUpdated?: () => void
}

interface TestResult {
  status: ConnectionState
  message: string
}

export function JobSettingsModal({
  job,
  initialTab = 'Automation',
  onClose,
  onNotice,
  onJobUpdated,
}: JobSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'Overview' | 'Automation' | 'Activity' | 'Settings'>(
    initialTab === 'Activity' ? 'Activity' : initialTab
  )
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [saving, setSaving] = useState(false)

  // Automation Form State
  const [resumeFolderId, setResumeFolderId] = useState('')
  const [jdFileId, setJdFileId] = useState('')
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [sheetName, setSheetName] = useState('Candidate Tracking')
  const [enabled, setEnabled] = useState(false)

  // Testing States
  const [testingDrive, setTestingDrive] = useState(false)
  const [testingFolder, setTestingFolder] = useState(false)
  const [testingJd, setTestingJd] = useState(false)
  const [testingSheets, setTestingSheets] = useState(false)

  // Test Results
  const [driveResult, setDriveResult] = useState<TestResult | null>(null)
  const [folderResult, setFolderResult] = useState<TestResult | null>(null)
  const [jdResult, setJdResult] = useState<TestResult | null>(null)
  const [sheetsResult, setSheetsResult] = useState<TestResult | null>(null)

  // Automation Activity State
  const [records, setRecords] = useState<ResumeProcessingRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [testingIngest, setTestingIngest] = useState(false)

  const jobId = job.id || job._id || ''

  // Load existing automation config
  useEffect(() => {
    if (!jobId) return

    setLoadingConfig(true)
    fetch(`/api/jobs/${jobId}/automation`)
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setResumeFolderId(data.config.googleDriveResumeFolderId || '')
          setJdFileId(data.config.googleDriveJdFileId || '')
          setSpreadsheetId(data.config.googleSheetsSpreadsheetId || '')
          setSheetName(data.config.googleSheetsSheetName || 'Candidate Tracking')
          setEnabled(Boolean(data.config.enabled))
        }
      })
      .catch((err) => {
        console.error('Failed to load automation config:', err)
      })
      .finally(() => {
        setLoadingConfig(false)
      })
  }, [jobId])

  // Load Automation Processing Records
  const loadRecords = async () => {
    if (!jobId) return
    try {
      setLoadingRecords(true)
      const res = await fetch(`/api/jobs/${jobId}/automation/records`)
      const data = await res.json()
      if (data.records) {
        setRecords(data.records)
      }
    } catch (err) {
      console.error('Failed to load automation records:', err)
    } finally {
      setLoadingRecords(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'Activity') {
      loadRecords()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, jobId])

  // Compute Overall Connection Status
  const getOverallStatus = (): ConnectionState => {
    const hasAnyConfig = Boolean(resumeFolderId || jdFileId || spreadsheetId)
    if (!hasAnyConfig) return 'Not Connected'

    const results = [folderResult, jdResult, sheetsResult].filter(Boolean)
    if (results.some((r) => r?.status === 'Error')) return 'Error'
    if (results.length > 0 && results.every((r) => r?.status === 'Connected')) return 'Connected'
    if (results.some((r) => r?.status === 'Connected')) return 'Connected'

    return 'Not Connected'
  }

  const overallStatus = getOverallStatus()

  // Save Configuration Handler
  const handleSave = async () => {
    if (!jobId) return

    try {
      setSaving(true)
      const res = await fetch(`/api/jobs/${jobId}/automation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleDriveResumeFolderId: resumeFolderId,
          googleDriveJdFileId: jdFileId,
          googleSheetsSpreadsheetId: spreadsheetId,
          googleSheetsSheetName: sheetName,
          enabled,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration')

      onNotice(`Automation configuration saved for "${job.title}"`)
      if (onJobUpdated) onJobUpdated()
    } catch (err: any) {
      onNotice(err.message || 'Error saving automation configuration')
    } finally {
      setSaving(false)
    }
  }

  // Trigger Google Drive Scan & Ingestion
  const handleSyncDrive = async () => {
    if (!jobId) return
    try {
      setSyncing(true)
      const res = await fetch(`/api/jobs/${jobId}/automation/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')

      onNotice(data.message || 'Drive resume scan initiated')
      loadRecords()
      if (onJobUpdated) onJobUpdated()
    } catch (err: any) {
      onNotice(err.message || 'Failed to sync Google Drive resumes')
    } finally {
      setSyncing(false)
    }
  }

  // Retry Failed Processing Record
  const handleRetryRecord = async (recordId: string) => {
    try {
      setRetryingId(recordId)
      const res = await fetch(`/api/automation/records/${recordId}/retry`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Retry failed')

      onNotice(`Processing retried for record`)
      loadRecords()
      if (onJobUpdated) onJobUpdated()
    } catch (err: any) {
      onNotice(err.message || 'Failed to retry processing')
    } finally {
      setRetryingId(null)
    }
  }

  // Run Test Ingestion
  const handleTestIngest = async (testType: 'pdf' | 'docx' | 'duplicate' | 'corrupt') => {
    try {
      setTestingIngest(true)
      let payload: any = { jobId }

      if (testType === 'pdf') {
        payload = {
          jobId,
          fileName: 'sarah_chen_resume.pdf',
          candidateName: 'Sarah Chen',
          candidateEmail: 'sarah.chen@techstartup.io',
          testMode: 'normal',
        }
      } else if (testType === 'docx') {
        payload = {
          jobId,
          fileName: 'alex_martinez_resume.docx',
          candidateName: 'Alex Martinez',
          candidateEmail: 'alex.martinez@clouddev.com',
          rawText: `Alex Martinez
alex.martinez@clouddev.com · +1 (555) 789-0123
DevOps & Cloud Systems Architect with strong Kubernetes, Docker, Python, AWS, and CI/CD pipelines expertise.
Experience: Lead Cloud Architect at ScaleCorp
Skills: Docker, Kubernetes, AWS, Python, Linux, CI/CD, React, TypeScript`,
          testMode: 'normal',
        }
      } else if (testType === 'duplicate') {
        // Send exact same candidate email to test idempotency
        payload = {
          jobId,
          fileName: 'sarah_chen_resume_copy.pdf',
          candidateName: 'Sarah Chen',
          candidateEmail: 'sarah.chen@techstartup.io',
          sourceFileId: 'duplicate_drive_id_101',
          testMode: 'normal',
        }
      } else if (testType === 'corrupt') {
        payload = {
          jobId,
          fileName: 'damaged_resume.unknown',
          testMode: 'corrupt',
        }
      }

      const res = await fetch('/api/automation/test-ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (testType === 'duplicate') {
        onNotice('Idempotency test completed: duplicate candidate detected without duplicate creation!')
      } else if (testType === 'corrupt') {
        onNotice('Failure test completed: corrupted file properly marked FAILED with error details!')
      } else {
        onNotice(`Test ${testType.toUpperCase()} ingested successfully! Candidate enrolled in pipeline.`)
      }

      loadRecords()
      if (onJobUpdated) onJobUpdated()
    } catch (err: any) {
      onNotice(err.message || 'Test ingestion failed')
    } finally {
      setTestingIngest(false)
    }
  }

  // Test Google Drive Connection
  const handleTestDrive = async () => {
    try {
      setTestingDrive(true)
      const res = await fetch(`/api/jobs/${jobId}/automation/test-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setDriveResult({
        status: data.status || (data.success ? 'Connected' : 'Error'),
        message: data.message || (data.success ? 'Drive connected' : 'Connection failed'),
      })
    } catch (err: any) {
      setDriveResult({ status: 'Error', message: err.message || 'Drive connection error' })
    } finally {
      setTestingDrive(false)
    }
  }

  // Test Resume Folder Access
  const handleTestResumeFolder = async () => {
    if (!resumeFolderId.trim()) {
      setFolderResult({ status: 'Not Connected', message: 'Enter a folder ID first' })
      return
    }

    try {
      setTestingFolder(true)
      const res = await fetch(`/api/jobs/${jobId}/automation/test-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeFolderId }),
      })
      const data = await res.json()
      setFolderResult({
        status: data.status || (data.success ? 'Connected' : 'Error'),
        message: data.message || (data.success ? 'Folder verified' : 'Folder inaccessible'),
      })
    } catch (err: any) {
      setFolderResult({ status: 'Error', message: err.message || 'Folder verification error' })
    } finally {
      setTestingFolder(false)
    }
  }

  // Test JD Access
  const handleTestJd = async () => {
    if (!jdFileId.trim()) {
      setJdResult({ status: 'Not Connected', message: 'Enter a JD file ID first' })
      return
    }

    try {
      setTestingJd(true)
      const res = await fetch(`/api/jobs/${jobId}/automation/test-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdFileId }),
      })
      const data = await res.json()
      setJdResult({
        status: data.status || (data.success ? 'Connected' : 'Error'),
        message: data.message || (data.success ? 'JD file verified' : 'JD file inaccessible'),
      })
    } catch (err: any) {
      setJdResult({ status: 'Error', message: err.message || 'JD verification error' })
    } finally {
      setTestingJd(false)
    }
  }

  // Test Google Sheets Access
  const handleTestSheets = async () => {
    if (!spreadsheetId.trim()) {
      setSheetsResult({ status: 'Not Connected', message: 'Enter a Spreadsheet ID first' })
      return
    }

    try {
      setTestingSheets(true)
      const res = await fetch(`/api/jobs/${jobId}/automation/test-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, sheetName }),
      })
      const data = await res.json()
      setSheetsResult({
        status: data.status || (data.success ? 'Connected' : 'Error'),
        message: data.message || (data.success ? 'Spreadsheet verified' : 'Spreadsheet inaccessible'),
      })
    } catch (err: any) {
      setSheetsResult({ status: 'Error', message: err.message || 'Sheets verification error' })
    } finally {
      setTestingSheets(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Briefcase className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{job.title}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    job.status === 'Open'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {job.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {job.team} · {job.location} · Role Configuration
              </p>
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
        <div className="flex border-b border-border px-6 gap-2 bg-muted/20">
          <button
            onClick={() => setActiveTab('Overview')}
            className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
              activeTab === 'Overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('Settings')}
            className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
              activeTab === 'Settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Role Settings
          </button>
          <button
            onClick={() => setActiveTab('Automation')}
            className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-semibold transition ${
              activeTab === 'Automation'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="size-3.5" />
            Automation Config
            {enabled && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
          </button>
          <button
            onClick={() => setActiveTab('Activity')}
            className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-semibold transition ${
              activeTab === 'Activity'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="size-3.5" />
            Automation Activity
            {records.length > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                {records.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'Overview' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Department / Team</p>
                  <p className="mt-1 font-semibold">{job.team}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Workplace Location</p>
                  <p className="mt-1 font-semibold">{job.location}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Required Skills</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(job.skills || []).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              {job.description && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{job.description}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Settings' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold">Job Posting State</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Manage availability of this role in the candidate intake pipeline.
                </p>
                <div className="mt-4 flex gap-3">
                  <span className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold">
                    Status: {job.status}
                  </span>
                  <span className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold">
                    Applicants: {job.applicants || 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Automation' && (
            <div className="space-y-6">
              {/* Status Header Banner */}
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recruitment Automation Status:
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        overallStatus === 'Connected'
                          ? 'bg-emerald-50 text-emerald-700'
                          : overallStatus === 'Error'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          overallStatus === 'Connected'
                            ? 'bg-emerald-500'
                            : overallStatus === 'Error'
                            ? 'bg-rose-500'
                            : 'bg-muted-foreground'
                        }`}
                      />
                      {overallStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connect Google Drive and Sheets to automatically intake resumes, match JDs, and synchronize candidates.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestDrive}
                    disabled={testingDrive}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {testingDrive ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Cloud className="size-3.5 text-primary" />
                    )}
                    Test Google Drive Connection
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Activity')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                  >
                    <Activity className="size-3.5" />
                    View Activity Stream
                  </button>
                </div>
              </div>

              {/* Overall Drive test result if available */}
              {driveResult && (
                <div
                  className={`rounded-xl p-3 text-xs flex items-start gap-2 ${
                    driveResult.status === 'Connected'
                      ? 'bg-emerald-50/80 text-emerald-900 border border-emerald-200'
                      : 'bg-amber-50/80 text-amber-900 border border-amber-200'
                  }`}
                >
                  {driveResult.status === 'Connected' ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  )}
                  <span>{driveResult.message}</span>
                </div>
              )}

              {loadingConfig ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mr-2" /> Loading job automation settings...
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Field 1: Google Drive Resume Folder ID */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <Folder className="size-4 text-primary" />
                        Google Drive Resume Folder ID
                      </label>
                      <button
                        type="button"
                        onClick={handleTestResumeFolder}
                        disabled={testingFolder || !resumeFolderId.trim()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                      >
                        {testingFolder && <Loader2 className="size-3 animate-spin" />}
                        Test Resume Folder access
                      </button>
                    </div>
                    <input
                      type="text"
                      value={resumeFolderId}
                      onChange={(e) => setResumeFolderId(e.target.value)}
                      placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-xs text-muted-foreground">
                      The Google Drive folder where resumes for this job are uploaded.
                    </p>
                    {folderResult && (
                      <div
                        className={`rounded-lg p-2.5 text-xs flex items-center gap-2 ${
                          folderResult.status === 'Connected'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {folderResult.status === 'Connected' ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertCircle className="size-3.5 shrink-0 text-rose-600" />
                        )}
                        <span>{folderResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Field 2: Google Drive Job Description File ID */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <FileText className="size-4 text-primary" />
                        Google Drive Job Description File ID
                      </label>
                      <button
                        type="button"
                        onClick={handleTestJd}
                        disabled={testingJd || !jdFileId.trim()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                      >
                        {testingJd && <Loader2 className="size-3 animate-spin" />}
                        Test JD access
                      </button>
                    </div>
                    <input
                      type="text"
                      value={jdFileId}
                      onChange={(e) => setJdFileId(e.target.value)}
                      placeholder="e.g. 1cZ4K8eL7m9O0P1q2R3s4T5u6V7w8X9yZ"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-xs text-muted-foreground">
                      The Google Drive file ID of the job description used for candidate matching.
                    </p>
                    {jdResult && (
                      <div
                        className={`rounded-lg p-2.5 text-xs flex items-center gap-2 ${
                          jdResult.status === 'Connected'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {jdResult.status === 'Connected' ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertCircle className="size-3.5 shrink-0 text-rose-600" />
                        )}
                        <span>{jdResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Field 3 & 4: Google Sheets Spreadsheet & Worksheet */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <Table className="size-4 text-primary" />
                        Google Sheets Candidate Tracker Spreadsheet ID
                      </label>
                      <button
                        type="button"
                        onClick={handleTestSheets}
                        disabled={testingSheets || !spreadsheetId.trim()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                      >
                        {testingSheets && <Loader2 className="size-3 animate-spin" />}
                        Test Google Sheets access
                      </button>
                    </div>
                    <input
                      type="text"
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      placeholder="e.g. 1qAZ2wSX3eDC4rFV5tGB6yHN7uJM8iKL9o"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-xs text-muted-foreground">
                      The Google Sheets spreadsheet where processed candidates should be synchronized.
                    </p>

                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Google Sheets Worksheet Name
                      </label>
                      <input
                        type="text"
                        value={sheetName}
                        onChange={(e) => setSheetName(e.target.value)}
                        placeholder="Candidate Tracking"
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        The specific tab inside the spreadsheet.
                      </p>
                    </div>

                    {sheetsResult && (
                      <div
                        className={`rounded-lg p-2.5 text-xs flex items-center gap-2 ${
                          sheetsResult.status === 'Connected'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {sheetsResult.status === 'Connected' ? (
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <AlertCircle className="size-3.5 shrink-0 text-rose-600" />
                        )}
                        <span>{sheetsResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Field 5: Automation Enabled Toggle */}
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">Automation Enabled</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {enabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground max-w-md">
                        When ON, candidate resumes uploaded to the Google Drive folder are processed and synced automatically.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEnabled(!enabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        enabled ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Activity' && (
            <div className="space-y-6">
              {/* Activity Control Header */}
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="size-4 text-primary" />
                    Automation Activity Stream
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Live ingestion pipeline tracking from Google Drive resume detection to pipeline sync.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncDrive}
                    disabled={syncing || !resumeFolderId}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    {syncing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Cloud className="size-3.5" />
                    )}
                    Scan & Ingest Drive Folder
                  </button>
                  <button
                    type="button"
                    onClick={loadRecords}
                    disabled={loadingRecords}
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                  >
                    <RotateCw className={`size-3.5 ${loadingRecords ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Simulation / Verification Testing Bar */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">Ingestion Pipeline Test Suite</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Test end-to-end automation behavior</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestIngest('pdf')}
                    disabled={testingIngest}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    Test PDF Ingestion
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestIngest('docx')}
                    disabled={testingIngest}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    Test DOCX Ingestion
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestIngest('duplicate')}
                    disabled={testingIngest}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    title="Verifies idempotency (does not create duplicate candidate)"
                  >
                    Test Duplicate Prevention
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestIngest('corrupt')}
                    disabled={testingIngest}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    title="Verifies error capture & retry UI"
                  >
                    Test Corrupt File (Failure & Retry)
                  </button>
                </div>
              </div>

              {/* Records List */}
              {loadingRecords ? (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mr-2" /> Loading automation activity records...
                </div>
              ) : records.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
                  <Cloud className="mx-auto size-8 text-muted-foreground/40 mb-3" />
                  <h4 className="text-sm font-semibold">No resumes ingested yet</h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    Resumes uploaded to the Google Drive folder will appear here with full extraction and sync progress.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTestIngest('pdf')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Sparkles className="size-3.5" />
                    Simulate First Resume Ingest
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((record) => {
                    const isFailed = record.status === 'FAILED'
                    const isCompleted = record.status === 'COMPLETED'
                    const isQueued = record.status === 'QUEUED'

                    return (
                      <div
                        key={record.id || record._id}
                        className={`rounded-2xl border p-4 transition ${
                          isFailed
                            ? 'border-rose-200 bg-rose-50/30'
                            : isCompleted
                            ? 'border-border bg-card'
                            : 'border-primary/30 bg-primary/5'
                        }`}
                      >
                        {/* File Header */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex size-9 items-center justify-center rounded-xl ${
                                isFailed
                                  ? 'bg-rose-100 text-rose-700'
                                  : isCompleted
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-primary/10 text-primary'
                              }`}
                            >
                              <FileText className="size-4" />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm">{record.fileName}</p>
                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                  {record.mimeType?.includes('pdf') ? 'PDF' : 'DOCX'}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Source: Google Drive ({record.sourceFileId}) ·{' '}
                                {record.candidateName && (
                                  <span className="font-medium text-foreground">
                                    Candidate: {record.candidateName} ·{' '}
                                  </span>
                                )}
                                {new Date(record.updatedAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : isFailed
                                  ? 'bg-rose-50 text-rose-700'
                                  : isQueued
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-primary/10 text-primary animate-pulse'
                              }`}
                            >
                              {isCompleted && <CheckCircle2 className="size-3 text-emerald-600" />}
                              {isFailed && <AlertCircle className="size-3 text-rose-600" />}
                              {record.status}
                            </span>

                            {isFailed && (
                              <button
                                type="button"
                                onClick={() => handleRetryRecord(record.id || record._id!)}
                                disabled={retryingId === (record.id || record._id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                              >
                                {retryingId === (record.id || record._id) ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <RotateCw className="size-3" />
                                )}
                                Retry processing
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Error Message banner if failed */}
                        {record.error && (
                          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                            <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                            <div>
                              <p className="font-semibold">Processing Failure</p>
                              <p className="mt-0.5">{record.error}</p>
                            </div>
                          </div>
                        )}

                        {/* Stage Activities Timeline */}
                        {Array.isArray(record.stageActivities) && record.stageActivities.length > 0 && (
                          <div className="mt-4 border-t border-border/60 pt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Automation Stages
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {record.stageActivities.map((stage, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2 rounded-xl bg-muted/30 p-2 text-xs"
                                >
                                  <CheckCircle2 className="size-3.5 shrink-0 text-primary mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-foreground text-[11px]">
                                      {stage.stage}
                                    </p>
                                    <p className="text-muted-foreground text-[11px] truncate">
                                      {stage.message}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/10">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
          >
            Close
          </button>

          {activeTab === 'Automation' && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save Configuration
            </button>
          )}

          {activeTab === 'Activity' && (
            <button
              type="button"
              onClick={handleSyncDrive}
              disabled={syncing || !resumeFolderId}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />}
              Sync Resumes Now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
