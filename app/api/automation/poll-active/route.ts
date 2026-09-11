import { NextResponse } from 'next/server'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import {
  jobAutomationConfigCollection,
  resumeProcessingRecordsCollection,
} from '@/lib/mongodb'
import { scanFolderDirectly, downloadDriveFile } from '@/lib/google-drive-sync'
import { processResumeBuffer } from '@/lib/google-drive-ingestion'

/**
 * POST /api/automation/poll-active
 * Heartbeat & scheduled polling endpoint for active folders.
 * Checks each folder configured with Active Mode whose watch interval has elapsed.
 */
export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const autoCol = jobAutomationConfigCollection()
    const recordsCol = resumeProcessingRecordsCollection()
    const now = Date.now()

    // Find all active job configs for this organization
    const activeConfigs = await autoCol
      .find({
        organizationId: organization,
        $or: [{ activeMode: true }, { enabled: true }],
        googleDriveResumeFolderId: { $exists: true, $ne: '' },
      })
      .toArray()

    if (activeConfigs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Google Drive folders configured for watch interval.',
        scannedJobs: 0,
        processedCount: 0,
      })
    }

    const dueConfigs = activeConfigs.filter((cfg) => {
      const intervalMs = (cfg.watchIntervalMinutes || 5) * 60 * 1000
      const lastScanned = cfg.lastScannedAt ? new Date(cfg.lastScannedAt).getTime() : 0
      return now - lastScanned >= intervalMs - 20_000
    })

    if (dueConfigs.length === 0) {
      return NextResponse.json({
        success: true,
        message: `All ${activeConfigs.length} active folder(s) were scanned recently. Next check within configured interval.`,
        scannedJobs: 0,
        activeFoldersCount: activeConfigs.length,
        processedCount: 0,
      })
    }

    let totalProcessed = 0
    let totalSynced = 0
    const scanSummaries: Array<{
      jobId: string
      newResumesCount: number
      syncedCount: number
    }> = []

    for (const config of dueConfigs) {
      try {
        const files = await scanFolderDirectly(config.googleDriveResumeFolderId, organization)
        const supportedFiles = files.filter((f) => {
          const name = f.name.toLowerCase()
          return name.endsWith('.pdf') || name.endsWith('.docx')
        })

        let jobProcessed = 0
        let jobSynced = 0

        for (const file of supportedFiles) {
          const existing = await recordsCol.findOne({
            organizationId: organization,
            jobId: config.jobId,
            sourceFileId: file.id,
          })

          const isGeneric =
            !existing?.candidateName ||
            existing.candidateName.toLowerCase() === 'candidate' ||
            existing.candidateName.toLowerCase().includes('competenc') ||
            existing.candidateName.toLowerCase().includes('summary')

          const isMissingContacts = !existing?.normalizedEmail && !existing?.normalizedPhone

          if (existing && existing.status === 'COMPLETED' && !isGeneric && !isMissingContacts) {
            continue
          }

          try {
            const fileBuffer = await downloadDriveFile(file.id, organization)
            const result = await processResumeBuffer({
              organizationId: organization,
              jobId: config.jobId,
              fileName: file.name,
              fileBuffer,
              sourceFileId: file.id,
              sourceFileUrl: `https://drive.google.com/file/d/${file.id}/view`,
              externalSource: 'google_drive',
              googleDriveFolderId: config.googleDriveResumeFolderId,
              forceReprocess: isGeneric || isMissingContacts,
            })

            jobProcessed++
            if (result.status === 'COMPLETED') {
              jobSynced++
            }
          } catch (err: any) {
            console.warn(`[poll-active] Failed processing ${file.name} for job ${config.jobId}:`, err.message)
          }
        }

        totalProcessed += jobProcessed
        totalSynced += jobSynced

        await autoCol.updateOne(
          { _id: config._id },
          { $set: { lastScannedAt: new Date(), updatedAt: new Date() } }
        )

        scanSummaries.push({
          jobId: config.jobId,
          newResumesCount: jobProcessed,
          syncedCount: jobSynced,
        })
      } catch (err: any) {
        console.warn(`[poll-active] Failed scanning folder for job ${config.jobId}:`, err.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Interval scan completed: ${dueConfigs.length} folder(s) checked, ${totalProcessed} new resume(s) processed, ${totalSynced} synced to Google Sheets.`,
      scannedJobs: dueConfigs.length,
      processedCount: totalProcessed,
      syncedCount: totalSynced,
      details: scanSummaries,
    })
  } catch (error: any) {
    console.error('[poll-active] Polling failed:', error)
    return NextResponse.json(
      { error: error.message || 'Interval polling failed' },
      { status: 500 }
    )
  }
}
