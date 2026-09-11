import {
  jobAutomationConfigCollection,
  resumeProcessingRecordsCollection,
} from '@/lib/mongodb'
import { scanFolderDirectly, downloadDriveFile } from '@/lib/google-drive-sync'
import { processResumeBuffer } from '@/lib/google-drive-ingestion'

declare global {
  // eslint-disable-next-line no-var
  var __automationPollerRunning: boolean | undefined
  // eslint-disable-next-line no-var
  var __automationPollerInterval: NodeJS.Timeout | undefined
}

/**
 * Runs a single polling cycle across all active folders whose watchInterval has elapsed.
 */
export async function runPollingCycle(): Promise<{ scanned: number; processed: number }> {
  try {
    const autoCol = jobAutomationConfigCollection()
    const recordsCol = resumeProcessingRecordsCollection()
    const now = Date.now()

    const activeConfigs = await autoCol
      .find({
        $or: [{ activeMode: true }, { enabled: true }],
        googleDriveResumeFolderId: { $exists: true, $ne: '' },
      })
      .toArray()

    if (activeConfigs.length === 0) {
      return { scanned: 0, processed: 0 }
    }

    const dueConfigs = activeConfigs.filter((cfg) => {
      const intervalMs = (cfg.watchIntervalMinutes || 5) * 60 * 1000
      const lastScanned = cfg.lastScannedAt ? new Date(cfg.lastScannedAt).getTime() : 0
      return now - lastScanned >= intervalMs - 15_000
    })

    if (dueConfigs.length === 0) {
      return { scanned: 0, processed: 0 }
    }

    console.log(`[AutomationPoller] Running scheduled check for ${dueConfigs.length} active folder(s)...`)

    let totalProcessed = 0

    for (const config of dueConfigs) {
      try {
        const organizationId = config.organizationId
        const files = await scanFolderDirectly(config.googleDriveResumeFolderId, organizationId)
        const supportedFiles = files.filter((f) => {
          const name = f.name.toLowerCase()
          return name.endsWith('.pdf') || name.endsWith('.docx')
        })

        for (const file of supportedFiles) {
          const existing = await recordsCol.findOne({
            organizationId,
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
            const fileBuffer = await downloadDriveFile(file.id, organizationId)
            const result = await processResumeBuffer({
              organizationId,
              jobId: config.jobId,
              fileName: file.name,
              fileBuffer,
              sourceFileId: file.id,
              sourceFileUrl: `https://drive.google.com/file/d/${file.id}/view`,
              externalSource: 'google_drive',
              googleDriveFolderId: config.googleDriveResumeFolderId,
              forceReprocess: isGeneric || isMissingContacts,
            })

            if (result.status === 'COMPLETED') {
              totalProcessed++
              console.log(
                `[AutomationPoller] Successfully processed & synced candidate "${result.candidateName}" for job ${config.jobId}`
              )
            }
          } catch (fileErr: any) {
            console.warn(`[AutomationPoller] Failed processing file ${file.name}:`, fileErr.message)
          }
        }

        // Update lastScannedAt
        await autoCol.updateOne(
          { _id: config._id },
          { $set: { lastScannedAt: new Date(), updatedAt: new Date() } }
        )
      } catch (scanErr: any) {
        console.warn(`[AutomationPoller] Error scanning job ${config.jobId}:`, scanErr.message)
      }
    }

    return { scanned: dueConfigs.length, processed: totalProcessed }
  } catch (err: any) {
    console.error('[AutomationPoller] Polling cycle error:', err.message)
    return { scanned: 0, processed: 0 }
  }
}

/**
 * Starts the server-side interval poller (ticks every 60 seconds).
 */
export function startAutomationPoller() {
  if (globalThis.__automationPollerRunning) {
    return
  }

  globalThis.__automationPollerRunning = true
  console.log('[AutomationPoller] Initialized server background poller (checking every 60 seconds)...')

  // Run first cycle after 10 seconds of startup
  setTimeout(() => {
    runPollingCycle().catch((err) =>
      console.warn('[AutomationPoller] Initial startup cycle warning:', err.message)
    )
  }, 10_000)

  // Periodic interval check every 60 seconds
  globalThis.__automationPollerInterval = setInterval(() => {
    runPollingCycle().catch((err) =>
      console.warn('[AutomationPoller] Interval tick warning:', err.message)
    )
  }, 60_000)
}
