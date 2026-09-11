import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobsCollection, jobAutomationConfigCollection, activitiesCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { JobAutomationConfig } from '@/lib/types'
import { extractGoogleId } from '@/lib/google-drive-hierarchy'

// GET /api/jobs/[id]/automation — retrieve job automation config
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const { id } = await params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid Job ID' }, { status: 400 })
    }

    const jobCol = jobsCollection()
    const job = await jobCol.findOne({ _id: new ObjectId(id), organization })
    if (!job) {
      return NextResponse.json({ error: 'Job not found in this organization' }, { status: 404 })
    }

    const autoCol = jobAutomationConfigCollection()
    const existingConfig = await autoCol.findOne({ jobId: id, organizationId: organization })

    const config: JobAutomationConfig = existingConfig
      ? {
          id: existingConfig._id.toString(),
          jobId: id,
          organizationId: organization,
          googleDriveResumeFolderId: existingConfig.googleDriveResumeFolderId || '',
          googleDriveJdFileId: existingConfig.googleDriveJdFileId || '',
          googleSheetsSpreadsheetId: existingConfig.googleSheetsSpreadsheetId || '',
          googleSheetsSheetName: existingConfig.googleSheetsSheetName || 'Candidate Tracking',
          sheetColumns: existingConfig.sheetColumns || [],
          enabled: existingConfig.enabled,
          activeMode: existingConfig.activeMode ?? existingConfig.enabled ?? false,
          watchIntervalMinutes: existingConfig.watchIntervalMinutes || 5,
          lastScannedAt: existingConfig.lastScannedAt || null,
          createdAt: existingConfig.createdAt,
          updatedAt: existingConfig.updatedAt,
        }
      : {
          jobId: id,
          organizationId: organization,
          googleDriveResumeFolderId: '',
          googleDriveJdFileId: '',
          googleSheetsSpreadsheetId: '',
          googleSheetsSheetName: 'Candidate Tracking',
          sheetColumns: [],
          enabled: false,
          activeMode: false,
          watchIntervalMinutes: 5,
          lastScannedAt: null,
        }

    return NextResponse.json({
      config,
      job: {
        id: job._id.toString(),
        title: job.title,
        team: job.team,
        location: job.location,
        status: job.status,
      },
    })
  } catch (error: any) {
    console.error('Failed to get job automation config:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve automation config' },
      { status: 500 }
    )
  }
}

// PUT /api/jobs/[id]/automation — save job automation config
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const { id } = await params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid Job ID' }, { status: 400 })
    }

    const jobCol = jobsCollection()
    const job = await jobCol.findOne({ _id: new ObjectId(id), organization })
    if (!job) {
      return NextResponse.json({ error: 'Job not found in this organization' }, { status: 404 })
    }

    const body = await req.json()
    const {
      googleDriveResumeFolderId = '',
      googleDriveJdFileId = '',
      googleSheetsSpreadsheetId = '',
      googleSheetsSheetName = 'Candidate Tracking',
      sheetColumns = [],
      enabled = true,
      activeMode,
      watchIntervalMinutes,
    } = body

    const autoCol = jobAutomationConfigCollection()
    const now = new Date()

    const cleanResumeFolderId = extractGoogleId(String(googleDriveResumeFolderId || '').trim())
    const cleanJdFileId = extractGoogleId(String(googleDriveJdFileId || '').trim())
    const cleanSpreadsheetId = extractGoogleId(String(googleSheetsSpreadsheetId || '').trim())

    const updateDoc: any = {
      jobId: id,
      organizationId: organization,
      googleDriveResumeFolderId: cleanResumeFolderId,
      googleDriveJdFileId: cleanJdFileId,
      googleSheetsSpreadsheetId: cleanSpreadsheetId,
      googleSheetsSheetName: String(googleSheetsSheetName).trim() || 'Candidate Tracking',
      sheetColumns: Array.isArray(sheetColumns) ? sheetColumns.filter(Boolean) : [],
      enabled: Boolean(enabled),
      activeMode: activeMode !== undefined ? Boolean(activeMode) : Boolean(enabled),
      watchIntervalMinutes: watchIntervalMinutes ? Math.max(1, Number(watchIntervalMinutes)) : 5,
      updatedAt: now,
    }

    const result = await autoCol.findOneAndUpdate(
      { jobId: id, organizationId: organization },
      {
        $set: updateDoc,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' }
    )

    // Log update activity
    try {
      const actCol = activitiesCollection()
      await actCol.insertOne({
        organization,
        title: 'Job automation configuration updated',
        detail: `${job.title} · JD: ${cleanJdFileId ? 'Configured' : 'None'}, Folder: ${cleanResumeFolderId ? 'Configured' : 'None'}, Sheet: ${cleanSpreadsheetId ? 'Configured' : 'None'} (${updateDoc.sheetColumns.length} columns selected)`,
        type: 'system',
        createdAt: now,
      } as any)
    } catch {}

    return NextResponse.json({
      success: true,
      config: {
        id: result?._id?.toString() || id,
        ...updateDoc,
      },
    })
  } catch (error: any) {
    console.error('Failed to update job automation config:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save automation configuration' },
      { status: 500 }
    )
  }
}
