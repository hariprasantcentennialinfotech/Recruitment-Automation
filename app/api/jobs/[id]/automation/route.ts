import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobsCollection, jobAutomationConfigCollection, activitiesCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { JobAutomationConfig } from '@/lib/types'

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
          enabled: Boolean(existingConfig.enabled),
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
          enabled: false,
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
      enabled = false,
    } = body

    const autoCol = jobAutomationConfigCollection()
    const now = new Date()

    const updateDoc = {
      jobId: id,
      organizationId: organization,
      googleDriveResumeFolderId: String(googleDriveResumeFolderId).trim(),
      googleDriveJdFileId: String(googleDriveJdFileId).trim(),
      googleSheetsSpreadsheetId: String(googleSheetsSpreadsheetId).trim(),
      googleSheetsSheetName: String(googleSheetsSheetName).trim() || 'Candidate Tracking',
      enabled: Boolean(enabled),
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
        detail: `${job.title} · Automation ${enabled ? 'Enabled' : 'Disabled'}`,
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
