import { NextResponse } from 'next/server'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import {
  jobsCollection,
  jobAutomationConfigCollection,
  resumeProcessingRecordsCollection,
} from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { scanFolderDirectly, downloadDriveFile } from '@/lib/google-drive-sync'
import { processResumeBuffer } from '@/lib/google-drive-ingestion'

/**
 * POST /api/automation/run-once
 * Runs ingestion immediately for a specific job / resume folder on demand.
 */
export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const body = await req.json().catch(() => ({}))
    const { jobId, forceReprocess = false } = body

    if (!jobId || !ObjectId.isValid(jobId)) {
      return NextResponse.json({ error: 'Valid jobId is required' }, { status: 400 })
    }

    const jobsCol = jobsCollection()
    const autoCol = jobAutomationConfigCollection()
    const recordsCol = resumeProcessingRecordsCollection()

    const job = await jobsCol.findOne({ _id: new ObjectId(jobId), organization })
    if (!job) {
      return NextResponse.json({ error: 'Job not found in this organization' }, { status: 404 })
    }

    const config = await autoCol.findOne({ jobId, organizationId: organization })
    if (!config || !config.googleDriveResumeFolderId) {
      return NextResponse.json(
        { error: 'Google Drive resume folder is not configured for this position' },
        { status: 400 }
      )
    }

    // Step 1: Scan resume folder directly
    const folderId = config.googleDriveResumeFolderId
    const files = await scanFolderDirectly(folderId, organization)
    const supportedFiles = files.filter((f) => {
      const name = f.name.toLowerCase()
      return name.endsWith('.pdf') || name.endsWith('.docx')
    })

    if (supportedFiles.length === 0) {
      // Update last scanned timestamp
      await autoCol.updateOne(
        { jobId, organizationId: organization },
        { $set: { lastScannedAt: new Date(), updatedAt: new Date() } }
      )
      return NextResponse.json({
        success: true,
        message: `Scanned folder for "${job.title}". No PDF or DOCX resumes found.`,
        processedCount: 0,
        syncedCount: 0,
        totalFiles: 0,
        results: [],
      })
    }

    const results: Array<{
      fileName: string
      status: 'SUCCESS' | 'SKIPPED' | 'FAILED'
      candidateName?: string
      matchScore?: number
      rowId?: number
      reason?: string
    }> = []

    let processedCount = 0
    let syncedCount = 0

    // Step 2: Process files
    for (const file of supportedFiles) {
      // Check if already processed
      const existingRecord = await recordsCol.findOne({
        organizationId: organization,
        jobId,
        sourceFileId: file.id,
      })

      const isGenericName =
        !existingRecord?.candidateName ||
        existingRecord.candidateName.toLowerCase() === 'candidate' ||
        existingRecord.candidateName.toLowerCase().includes('competenc') ||
        existingRecord.candidateName.toLowerCase().includes('summary')

      const isMissingContacts = !existingRecord?.normalizedEmail && !existingRecord?.normalizedPhone

      // Skip only if strictly completed with genuine candidate details and forceReprocess is false
      if (
        !forceReprocess &&
        existingRecord &&
        existingRecord.status === 'COMPLETED' &&
        !isGenericName &&
        !isMissingContacts
      ) {
        results.push({
          fileName: file.name,
          status: 'SKIPPED',
          candidateName: existingRecord.candidateName,
          matchScore: existingRecord.matchScore,
          reason: `Already processed (${existingRecord.candidateName})`,
        })
        continue
      }

      try {
        const fileBuffer = await downloadDriveFile(file.id, organization)
        const processed = await processResumeBuffer({
          organizationId: organization,
          jobId,
          fileName: file.name,
          fileBuffer,
          sourceFileId: file.id,
          sourceFileUrl: `https://drive.google.com/file/d/${file.id}/view`,
          externalSource: 'google_drive',
          googleDriveFolderId: folderId,
          forceReprocess: forceReprocess || isGenericName || isMissingContacts,
        })

        processedCount++
        if (processed.status === 'COMPLETED') {
          syncedCount++
          results.push({
            fileName: file.name,
            status: 'SUCCESS',
            candidateName: processed.candidateName,
            matchScore: processed.matchScore,
          })
        } else {
          results.push({
            fileName: file.name,
            status: 'FAILED',
            reason: processed.error || 'Extraction incomplete',
          })
        }
      } catch (err: any) {
        console.warn(`[run-once] Failed processing ${file.name}:`, err.message)
        results.push({
          fileName: file.name,
          status: 'FAILED',
          reason: err.message,
        })
      }
    }

    // Step 3: Update lastScannedAt
    await autoCol.updateOne(
      { jobId, organizationId: organization },
      { $set: { lastScannedAt: new Date(), updatedAt: new Date() } }
    )

    return NextResponse.json({
      success: true,
      message: `Run Once complete for "${job.title}": ${processedCount} processed, ${syncedCount} synced to Google Sheets.`,
      processedCount,
      syncedCount,
      totalFiles: supportedFiles.length,
      results,
    })
  } catch (error: any) {
    console.error('[run-once] Execution failed:', error)
    return NextResponse.json(
      { error: error.message || 'Run Once workflow failed' },
      { status: 500 }
    )
  }
}
