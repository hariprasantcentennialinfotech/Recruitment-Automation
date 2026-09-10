import { inngest } from '../client'
import {
  organizationAutomationSettingsCollection,
  jobAutomationConfigCollection,
  resumeProcessingRecordsCollection,
} from '@/lib/mongodb'
import { scanFolderDirectly } from '@/lib/google-drive-sync'
import { getDriveAccessToken } from '@/lib/google-auth-token'

/**
 * Inngest Scheduled Poller for Organizations with Active Mode enabled.
 * Runs every 5 minutes by default. Checks each organization's configured watch interval (e.g. 5m, 15m, 30m).
 * If the interval has elapsed, scans their configured job resume folders for new uploads.
 */
export const pollActiveFoldersFunction = inngest.createFunction(
  {
    id: 'poll-active-drive-folders',
    name: 'Poll Active Google Drive Resume Folders',
    triggers: [
      { cron: '*/5 * * * *' }, // Evaluates every 5 minutes
      { event: 'google/drive.poll.active' },
    ],
  },
  async ({ step }) => {
    const orgsToScan = await step.run('identify-active-organizations', async () => {
      const orgSettingsCol = organizationAutomationSettingsCollection()
      const activeOrgs = await orgSettingsCol.find({ activeMode: true }).toArray()
      const now = Date.now()

      const eligibleOrgs: string[] = []

      for (const org of activeOrgs) {
        const intervalMs = (org.watchIntervalMinutes || 5) * 60 * 1000
        const lastScanned = org.lastScannedAt ? new Date(org.lastScannedAt).getTime() : 0

        // If enough time has passed according to user's interval setting
        if (now - lastScanned >= intervalMs - 30_000) {
          eligibleOrgs.push(org.organizationId)
        }
      }

      return eligibleOrgs
    })

    if (orgsToScan.length === 0) {
      return { message: 'No organizations due for interval scanning at this time.', scanned: 0 }
    }

    const token = await getDriveAccessToken()
    if (!token) {
      return { message: 'Google credentials not present, skipped interval poll.', scanned: 0 }
    }

    let detectedResumesCount = 0

    for (const orgId of orgsToScan) {
      await step.run(`scan-org-${orgId}`, async () => {
        const autoCol = jobAutomationConfigCollection()
        const recordsCol = resumeProcessingRecordsCollection()
        const orgSettingsCol = organizationAutomationSettingsCollection()

        const configs = await autoCol
          .find({
            organizationId: orgId,
            enabled: true,
            googleDriveResumeFolderId: { $exists: true, $ne: '' },
          })
          .toArray()

        for (const config of configs) {
          try {
            const files = await scanFolderDirectly(config.googleDriveResumeFolderId, orgId)
            const supportedFiles = files.filter(
              (f) =>
                f.name.toLowerCase().endsWith('.pdf') ||
                f.name.toLowerCase().endsWith('.docx')
            )

            for (const file of supportedFiles) {
              const existingRecord = await recordsCol.findOne({
                organizationId: orgId,
                jobId: config.jobId,
                sourceFileId: file.id,
              })

              if (existingRecord && existingRecord.status === 'COMPLETED') {
                continue
              }

              // Enqueue resume for durable processing
              await inngest.send({
                name: 'google/drive.resume.detected',
                data: {
                  organizationId: orgId,
                  jobId: config.jobId,
                  fileId: file.id,
                  fileName: file.name,
                  mimeType: file.name.toLowerCase().endsWith('.docx')
                    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    : 'application/pdf',
                  sourceFileUrl: `https://drive.google.com/file/d/${file.id}/view`,
                  triggeredBy: 'active_interval_poll',
                },
              })

              detectedResumesCount++
            }
          } catch (err: any) {
            console.warn(`[poll-active-folders] Error scanning folder for org ${orgId}:`, err.message)
          }
        }

        await orgSettingsCol.updateOne(
          { organizationId: orgId },
          {
            $set: {
              lastScannedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        )
      })
    }

    return {
      message: `Interval scan complete across ${orgsToScan.length} organization(s).`,
      organizationsScanned: orgsToScan.length,
      detectedResumes: detectedResumesCount,
    }
  }
)
