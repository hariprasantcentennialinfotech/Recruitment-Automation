import { ObjectId } from 'mongodb'
import {
  jobsCollection,
  jobAutomationConfigCollection,
  organizationAutomationSettingsCollection,
} from '@/lib/mongodb'
import { getDriveAccessToken, getSheetsAccessToken } from '@/lib/google-auth-token'
import { DiscoveredJobHierarchy, OrganizationAutomationSettings } from '@/lib/types'

interface DriveFile {
  id: string
  name: string
  mimeType: string
}

/**
 * Extracts a clean Google Drive folder or file ID from either:
 * - A direct ID (e.g., "1aBcD_EFgHiJkLmNoPqRsTuVwXyZ")
 * - A full URL (e.g., "https://drive.google.com/drive/folders/1aBcD_EFgHiJkLmNoPqRsTuVwXyZ?usp=sharing")
 */
export function extractGoogleId(input: string): string {
  if (!input) return ''
  const trimmed = input.trim()

  // Match /folders/{id}
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) return folderMatch[1]

  // Match /d/{id}
  const fileMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return fileMatch[1]

  // Match id={id}
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (queryMatch) return queryMatch[1]

  return trimmed
}

/**
 * Lists non-trashed children of a Google Drive folder.
 */
export async function listDriveFolderChildren(
  folderId: string,
  token: string
): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const fields = encodeURIComponent('files(id, name, mimeType)')
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Google Drive API error (${res.status}): ${errorText}`)
  }

  const data = await res.json()
  return data.files || []
}

/**
 * Reads header row (Row 1) of a Google Sheet to discover user-defined columns.
 */
export async function getSheetColumns(
  spreadsheetId: string,
  token?: string | null,
  organizationId?: string
): Promise<{ sheetName: string; columns: string[] }> {
  const authToken = token || (await getSheetsAccessToken(organizationId))
  if (!authToken) {
    return {
      sheetName: 'Candidate Tracking',
      columns: [
        'Candidate Name',
        'Email',
        'Phone',
        'Location',
        'Current Title',
        'Total Experience',
        'Matching Skills',
        'Missing Skills',
        'Work Authorization',
        'Availability',
        'Resume',
        'Status',
      ],
    }
  }

  try {
    // 1. Fetch spreadsheet metadata to get the first sheet name
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    )

    let sheetName = 'Candidate Tracking'
    if (metaRes.ok) {
      const meta = await metaRes.json()
      const firstSheet = meta.sheets?.[0]?.properties?.title
      if (firstSheet) sheetName = firstSheet
    }

    // 2. Fetch Row 1 values
    const range = encodeURIComponent(`${sheetName}!1:1`)
    const valRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    )

    if (valRes.ok) {
      const valData = await valRes.json()
      const row = valData.values?.[0]
      if (Array.isArray(row) && row.length > 0) {
        const columns = row.map((col: any) => String(col).trim()).filter(Boolean)
        if (columns.length > 0) {
          return { sheetName, columns }
        }
      }
    }

    return {
      sheetName,
      columns: [
        'Candidate Name',
        'Email',
        'Phone',
        'Location',
        'Current Title',
        'Total Experience',
        'Matching Skills',
        'Missing Skills',
        'Work Authorization',
        'Availability',
        'Resume',
        'Status',
      ],
    }
  } catch (err) {
    console.warn('[google-drive-hierarchy] Failed to read sheet columns:', err)
    return {
      sheetName: 'Candidate Tracking',
      columns: [
        'Candidate Name',
        'Email',
        'Phone',
        'Location',
        'Current Title',
        'Total Experience',
        'Matching Skills',
        'Missing Skills',
        'Resume',
        'Status',
      ],
    }
  }
}

/**
 * Traverses a Google Drive root folder with the standard hierarchy:
 *
 * 📁 Recruitment Automation
 * └── 📁 Jobs
 *     ├── 📁 [Job Title]
 *     │   ├── 📁 Resumes
 *     │   ├── 📄 Job Description.docx (or .pdf)
 *     │   └── 📊 Candidate Tracking (Google Sheet)
 *
 * Automatically links or creates the jobs in MongoDB and configures their automation records.
 */
export async function discoverJobsFromDriveRoot(
  rootInput: string,
  organizationId: string,
  options: { simulatedChildren?: Record<string, DriveFile[]> } = {}
): Promise<{
  success: boolean
  rootFolderId: string
  jobsFolderId: string
  discoveredJobs: DiscoveredJobHierarchy[]
  message: string
}> {
  const rootFolderId = extractGoogleId(rootInput)
  if (!rootFolderId) {
    throw new Error('Please provide a valid Google Drive folder ID or URL')
  }

  const token = await getDriveAccessToken(organizationId)

  // Helper to get children either via simulated map or live API
  async function getChildren(folderId: string): Promise<DriveFile[]> {
    if (options.simulatedChildren && options.simulatedChildren[folderId]) {
      return options.simulatedChildren[folderId]
    }
    if (!token) {
      throw new Error(
        'Google Drive is not connected for this organization. Please click "Connect Google Drive" in the Automation tab, or configure service account credentials in .env.'
      )
    }
    return listDriveFolderChildren(folderId, token)
  }

  // 1. Inspect root folder children
  const rootChildren = await getChildren(rootFolderId)

  // Look for a subfolder named "Jobs" (case-insensitive)
  const jobsSubfolder = rootChildren.find(
    (c) =>
      c.mimeType === 'application/vnd.google-apps.folder' &&
      c.name.toLowerCase().trim() === 'jobs'
  )

  let jobsFolderId = rootFolderId
  let jobFolders: DriveFile[] = []

  if (jobsSubfolder) {
    jobsFolderId = jobsSubfolder.id
    const childrenOfJobs = await getChildren(jobsFolderId)
    jobFolders = childrenOfJobs.filter(
      (c) => c.mimeType === 'application/vnd.google-apps.folder'
    )
  } else {
    // If root itself directly contains job subfolders
    jobFolders = rootChildren.filter(
      (c) => c.mimeType === 'application/vnd.google-apps.folder'
    )
  }

  if (jobFolders.length === 0) {
    return {
      success: true,
      rootFolderId,
      jobsFolderId,
      discoveredJobs: [],
      message:
        'No job subfolders found. Ensure your "Jobs" folder contains folders named after your open positions (e.g. "DevOps Engineer").',
    }
  }

  const jobsCol = jobsCollection()
  const autoCol = jobAutomationConfigCollection()
  const discoveredJobs: DiscoveredJobHierarchy[] = []

  for (const jobFolder of jobFolders) {
    const jobTitle = jobFolder.name.trim()
    const folderChildren = await getChildren(jobFolder.id)

    // 1. Identify Resumes folder
    const resumeFolder = folderChildren.find(
      (f) =>
        f.mimeType === 'application/vnd.google-apps.folder' &&
        (f.name.toLowerCase().includes('resume') || f.name.toLowerCase().includes('candidate'))
    )

    // 2. Identify JD file (Job Description docx/pdf or containing "job description" or "jd")
    const jdFile = folderChildren.find(
      (f) =>
        f.mimeType !== 'application/vnd.google-apps.folder' &&
        f.mimeType !== 'application/vnd.google-apps.spreadsheet' &&
        (f.name.toLowerCase().includes('job description') ||
          f.name.toLowerCase().includes('jd') ||
          f.name.toLowerCase().endsWith('.docx') ||
          f.name.toLowerCase().endsWith('.pdf'))
    )

    // 3. Identify Candidate Tracking spreadsheet
    const spreadsheet = folderChildren.find(
      (f) =>
        f.mimeType === 'application/vnd.google-apps.spreadsheet' ||
        f.name.toLowerCase().includes('candidate tracking') ||
        f.name.toLowerCase().includes('tracking') ||
        f.name.toLowerCase().includes('sheet')
    )

    const missingItems: string[] = []
    if (!resumeFolder) missingItems.push('Resumes Folder')
    if (!jdFile) missingItems.push('Job Description File')
    if (!spreadsheet) missingItems.push('Candidate Tracking Spreadsheet')

    let sheetName = 'Candidate Tracking'
    let sheetColumns: string[] = []

    if (spreadsheet) {
      const sheetInfo = await getSheetColumns(spreadsheet.id, token, organizationId)
      sheetName = sheetInfo.sheetName
      sheetColumns = sheetInfo.columns
    }

    // Find or create Job in MongoDB
    let existingJob = await jobsCol.findOne({
      organization: organizationId,
      title: { $regex: new RegExp(`^${jobTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    })

    let jobId: string
    if (!existingJob) {
      const newJobDoc = {
        organization: organizationId,
        title: jobTitle,
        team: 'Engineering',
        location: 'Remote',
        status: 'Open',
        skills: [],
        description: `Auto-discovered job for ${jobTitle}`,
        applicants: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const insertResult = await jobsCol.insertOne(newJobDoc as any)
      jobId = insertResult.insertedId.toString()
    } else {
      jobId = existingJob._id.toString()
    }

    // Upsert Job Automation Config
    await autoCol.updateOne(
      { jobId, organizationId },
      {
        $set: {
          jobId,
          organizationId,
          googleDriveResumeFolderId: resumeFolder?.id || '',
          googleDriveJdFileId: jdFile?.id || '',
          googleSheetsSpreadsheetId: spreadsheet?.id || '',
          googleSheetsSheetName: sheetName,
          sheetColumns,
          enabled: missingItems.length === 0,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )

    discoveredJobs.push({
      jobTitle,
      jobFolderId: jobFolder.id,
      resumeFolderId: resumeFolder?.id,
      resumeFolderName: resumeFolder?.name,
      jdFileId: jdFile?.id,
      jdFileName: jdFile?.name,
      jdFileMimeType: jdFile?.mimeType,
      spreadsheetId: spreadsheet?.id,
      spreadsheetName: spreadsheet?.name,
      sheetName,
      sheetColumns,
      status: missingItems.length === 0 ? 'READY' : 'INCOMPLETE',
      missingItems,
      existingJobId: jobId,
    })
  }

  // Update company-level organization automation settings
  const orgSettingsCol = organizationAutomationSettingsCollection()
  await orgSettingsCol.updateOne(
    { organizationId },
    {
      $set: {
        organizationId,
        driveRootFolderId: rootFolderId,
        jobsFolderId,
        lastScannedAt: new Date(),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        activeMode: false,
        watchIntervalMinutes: 5,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  )

  return {
    success: true,
    rootFolderId,
    jobsFolderId,
    discoveredJobs,
    message: `Discovered ${discoveredJobs.length} job(s) in "${jobsSubfolder ? 'Jobs' : 'Root'}" folder.`,
  }
}

/**
 * Gets or initializes organization automation settings.
 */
export async function getOrganizationAutomationSettings(
  organizationId: string
): Promise<OrganizationAutomationSettings> {
  const col = organizationAutomationSettingsCollection()
  const doc = await col.findOne({ organizationId })

  if (doc) {
    return {
      ...doc,
      _id: doc._id.toString(),
    } as OrganizationAutomationSettings
  }

  const defaultSettings: OrganizationAutomationSettings = {
    organizationId,
    activeMode: false,
    watchIntervalMinutes: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  await col.insertOne(defaultSettings as any)
  return defaultSettings
}

/**
 * Updates organization automation settings (Active Mode, Interval, Root Folder).
 */
export async function updateOrganizationAutomationSettings(
  organizationId: string,
  updates: Partial<OrganizationAutomationSettings>
): Promise<OrganizationAutomationSettings> {
  const col = organizationAutomationSettingsCollection()
  const allowed = {
    ...(updates.driveRootFolderId !== undefined && { driveRootFolderId: updates.driveRootFolderId }),
    ...(updates.activeMode !== undefined && { activeMode: Boolean(updates.activeMode) }),
    ...(updates.watchIntervalMinutes !== undefined && {
      watchIntervalMinutes: Number(updates.watchIntervalMinutes),
    }),
    updatedAt: new Date(),
  }

  await col.updateOne({ organizationId }, { $set: allowed }, { upsert: true })
  return getOrganizationAutomationSettings(organizationId)
}
