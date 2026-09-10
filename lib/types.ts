export type SubscriptionPlan = 'Starter' | 'Growth' | 'Enterprise'
export type ClientStatus = 'Active' | 'Trial' | 'Suspended'
export type PipelineStage = 'Sourcing' | 'Review' | 'Interview' | 'Offer' | 'Hired' | 'Rejected'

export interface ClientCompany {
  _id?: string
  id?: string
  name: string
  slug: string
  contactEmail: string
  contactPerson?: string
  domain?: string
  plan: SubscriptionPlan
  status: ClientStatus
  monthlyFee: number
  logoUrl?: string
  brandColor?: string
  whiteLabelName?: string
  maxJobs: number
  maxCandidates: number
  activeJobsCount?: number
  candidatesCount?: number
  createdAt: string | Date
  updatedAt?: string | Date
}

export interface JobDocument {
  _id?: string
  id?: string
  organization: string
  title: string
  team: string
  location: string
  status: 'Open' | 'Draft' | 'Closed'
  skills: string[]
  description?: string
  applicants?: number
  createdAt: string | Date
  updatedAt?: string | Date
}

export interface ActivityDocument {
  _id?: string
  id?: string
  organization: string
  title: string
  detail: string
  type: 'job_created' | 'resume_uploaded' | 'candidate_moved' | 'system'
  createdAt: string | Date
}

export type SheetsSyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'

export interface CandidateDocument {
  _id?: string
  id?: string
  organization: string
  fullName: string
  email?: string
  phone?: string
  location?: string
  currentTitle?: string
  currentCompany?: string
  totalExperience?: string
  summary?: string
  skills: string[]
  education?: Array<{ institution: string; degree?: string }> | string[]
  certifications?: string[]
  workAuthorization?: string
  availability?: string
  stage: PipelineStage
  sourceFile: string
  sourceFileId?: string
  resumeUrl?: string
  extractionProvider: string
  jobId?: string
  jobTitle?: string
  matchingSkills?: string[]
  missingSkills?: string[]
  matchScore?: number
  recommendation?: 'Strong Match' | 'Good Match' | 'Potential Match' | 'Low Match'
  reasoningSummary?: string
  scoringBreakdown?: {
    skills: number
    experience: number
    certifications: number
    location: number
    workAuth: number
  }
  sheetsSyncStatus?: SheetsSyncStatus
  googleSheetsSpreadsheetId?: string
  googleSheetsSheetName?: string
  googleSheetsRowId?: number
  sheetsSyncError?: string
  customFields?: Record<string, string>
  createdAt: string | Date
  updatedAt?: string | Date
}

export interface AdminStats {
  totalClients: number
  activeClients: number
  totalJobs: number
  totalCandidates: number
  totalProcessedThisMonth: number
  systemStatus: 'Operational' | 'Degraded' | 'Outage'
}

export interface ScoringWeights {
  skillsWeight: number
  experienceWeight: number
  certificationsWeight: number
  locationWeight: number
  workAuthWeight: number
}

export interface CachedJdAnalysis {
  title?: string
  requiredSkills: string[]
  preferredSkills: string[]
  minExperienceYears?: number
  requiredCertifications?: string[]
  location?: string
  workAuthorization?: string
  cachedAt: Date | string
}

export interface JobAutomationConfig {
  _id?: string
  id?: string
  jobId: string
  organizationId: string
  googleDriveResumeFolderId: string
  googleDriveJdFileId: string
  googleSheetsSpreadsheetId: string
  googleSheetsSheetName: string
  sheetColumns?: string[]
  enabled: boolean
  scoringWeights?: ScoringWeights
  cachedJdText?: string
  cachedJdAnalysis?: CachedJdAnalysis
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type ConnectionState = 'Connected' | 'Not Connected' | 'Error'

export interface AutomationConnectionStatus {
  overall: ConnectionState
  drive: {
    status: ConnectionState
    message?: string
  }
  jd: {
    status: ConnectionState
    message?: string
    fileName?: string
  }
  resumeFolder: {
    status: ConnectionState
    message?: string
    folderName?: string
  }
  sheets: {
    status: ConnectionState
    message?: string
    spreadsheetTitle?: string
    sheetExists?: boolean
  }
}

export type ProcessingStatus =
  | 'QUEUED'
  | 'DOWNLOADING'
  | 'EXTRACTING'
  | 'AI_PROCESSING'
  | 'EVALUATING'
  | 'SHEETS_SYNCING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REVIEW_REQUIRED'

export interface StageActivity {
  stage: string
  message: string
  timestamp: Date | string
}

export interface ResumeProcessingRecord {
  _id?: string
  id?: string
  organizationId: string
  jobId: string
  jobTitle?: string
  externalSource: 'google_drive' | 'manual_upload'
  sourceFileId: string
  sourceFileUrl?: string
  fileName: string
  fileSize?: number
  mimeType: string
  fileHash?: string
  status: ProcessingStatus
  error?: string
  extractedTextSnippet?: string
  candidateId?: string
  candidateName?: string
  normalizedEmail?: string
  normalizedPhone?: string
  matchScore?: number
  stageActivities: StageActivity[]
  createdAt: Date | string
  updatedAt: Date | string
}

// ─── Automation readiness (Task 7) ───────────────────────────────────────────

/** Status computed from actual DB / integration state — never hardcoded. */
export type AutomationReadinessStatus =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'CONNECTED'
  | 'ERROR'
  | 'DISABLED'

export interface JobAutomationSummary {
  jobId: string
  jobTitle: string
  /** MongoDB _id of the JobAutomationConfig, if one exists */
  configId?: string
  resumeFolder: AutomationReadinessStatus
  jdFile: AutomationReadinessStatus
  tracker: AutomationReadinessStatus
  automationStatus: AutomationReadinessStatus
  lastProcessed?: string | null
  candidateCount: number
  errorCount: number
  enabled: boolean
}

export interface ClientAutomationSummary {
  /** Rolled-up drive readiness across all jobs */
  drive: AutomationReadinessStatus
  /** Rolled-up JD readiness across all jobs */
  jd: AutomationReadinessStatus
  /** Rolled-up candidate-tracker readiness across all jobs */
  tracker: AutomationReadinessStatus
  /** Overall automation status across all jobs */
  automation: AutomationReadinessStatus
  lastResumeProcessed?: string | null
  errorCount: number
  jobAutomations: JobAutomationSummary[]
}

// ─── Organization Automation Hierarchy & Active Mode ─────────────────────────

export interface OrganizationAutomationSettings {
  _id?: any
  organizationId: string
  driveRootFolderId?: string
  driveRootFolderName?: string
  jobsFolderId?: string
  activeMode: boolean
  watchIntervalMinutes: number // 5, 15, 30, etc.
  googleConnectedEmail?: string
  googleConnectedAt?: Date | string
  googleRefreshToken?: string
  lastScannedAt?: Date | string
  lastWorkflowRunAt?: Date | string
  lastError?: string
  createdAt: Date | string
  updatedAt: Date | string
}

export interface DiscoveredJobHierarchy {
  jobTitle: string
  jobFolderId: string
  resumeFolderId?: string
  resumeFolderName?: string
  jdFileId?: string
  jdFileName?: string
  jdFileMimeType?: string
  spreadsheetId?: string
  spreadsheetName?: string
  sheetName?: string
  sheetColumns?: string[]
  status: 'READY' | 'INCOMPLETE'
  missingItems: string[]
  existingJobId?: string
}

