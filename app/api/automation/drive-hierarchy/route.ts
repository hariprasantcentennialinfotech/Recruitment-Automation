import { NextResponse } from 'next/server'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import {
  discoverJobsFromDriveRoot,
  getOrganizationAutomationSettings,
  updateOrganizationAutomationSettings,
} from '@/lib/google-drive-hierarchy'
import { jobAutomationConfigCollection, jobsCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

// GET /api/automation/drive-hierarchy — get current settings and discovered jobs
export async function GET(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const settings = await getOrganizationAutomationSettings(organization)
    const jobsCol = jobsCollection()
    const autoCol = jobAutomationConfigCollection()

    const jobs = await jobsCol.find({ organization }).toArray()
    const configs = await autoCol.find({ organizationId: organization }).toArray()

    const configMap = new Map(configs.map((c) => [c.jobId, c]))

    const jobSummaries = jobs.map((j) => {
      const cfg = configMap.get(j._id.toString())
      return {
        jobId: j._id.toString(),
        title: j.title,
        status: j.status,
        resumeFolderId: cfg?.googleDriveResumeFolderId || '',
        jdFileId: cfg?.googleDriveJdFileId || '',
        spreadsheetId: cfg?.googleSheetsSpreadsheetId || '',
        sheetName: cfg?.googleSheetsSheetName || 'Candidate Tracking',
        sheetColumns: cfg?.sheetColumns || [],
        enabled: Boolean(cfg?.enabled),
        activeMode: Boolean(cfg?.activeMode ?? cfg?.enabled ?? false),
        watchIntervalMinutes: Number(cfg?.watchIntervalMinutes) || 5,
        lastScannedAt: cfg?.lastScannedAt ? new Date(cfg.lastScannedAt).toISOString() : null,
        isConfigured: Boolean(
          cfg?.googleDriveResumeFolderId &&
          cfg?.googleDriveJdFileId &&
          cfg?.googleSheetsSpreadsheetId
        ),
      }
    })

    const { googleRefreshToken, ...safeSettings } = settings as any

    return NextResponse.json({
      success: true,
      settings: safeSettings,
      jobs: jobSummaries,
    })
  } catch (error: any) {
    console.error('[drive-hierarchy] GET error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 })
  }
}

// POST /api/automation/drive-hierarchy — scan and discover jobs from Google Drive root folder
export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const body = await req.json()
    const rootInput = body.rootFolderId || body.folderUrl || body.folderName || ''

    if (!rootInput || typeof rootInput !== 'string') {
      return NextResponse.json(
        { error: 'Please provide a valid Google Drive folder ID, URL, or name' },
        { status: 400 }
      )
    }

    const discoveryResult = await discoverJobsFromDriveRoot(rootInput, organization)
    return NextResponse.json(discoveryResult)
  } catch (error: any) {
    console.error('[drive-hierarchy] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to discover jobs from Google Drive' },
      { status: 500 }
    )
  }
}

// PUT /api/automation/drive-hierarchy — update Active Mode and watch interval
export async function PUT(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const body = await req.json()
    const updated = await updateOrganizationAutomationSettings(organization, {
      driveRootFolderId: body.driveRootFolderId,
      activeMode: body.activeMode,
      watchIntervalMinutes: body.watchIntervalMinutes,
    })

    return NextResponse.json({
      success: true,
      settings: updated,
      message: `Automation settings updated. Active mode is ${updated.activeMode ? 'ON' : 'OFF'} (Interval: ${updated.watchIntervalMinutes}m).`,
    })
  } catch (error: any) {
    console.error('[drive-hierarchy] PUT error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 })
  }
}
