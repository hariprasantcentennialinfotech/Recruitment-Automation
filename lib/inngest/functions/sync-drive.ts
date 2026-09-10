import { inngest } from '../client'
import {
  driveWatchChannelsCollection,
  jobAutomationConfigCollection,
  resumeProcessingRecordsCollection,
} from '@/lib/mongodb'
import { getDriveAccessToken } from '@/lib/google-auth-token'

const SYNC_LOCK_DURATION_MS = 60_000 // 60 seconds atomic lease

/**
 * Inngest function: syncGoogleDriveChanges
 * Triggered by event: 'google/drive.changed'
 *
 * Provides:
 * - Atomic lease/lock protection so concurrent webhooks cannot race on the same channel's pageToken
 * - Drive Changes API traversal
 * - Folder-to-Job multi-tenant matching
 * - Idempotency checking before creating processing jobs
 * - Enqueues 'google/drive.resume.detected' for each new resume
 */
export const syncGoogleDriveChangesFunction = inngest.createFunction(
  {
    id: 'sync-google-drive-changes',
    retries: 2,
    concurrency: {
      limit: 1,
      key: 'event.data.organizationId', // serializes sync per tenant
    },
    triggers: [{ event: 'google/drive.changed' }],
  },
  async ({ event, step }: any) => {
    const { organizationId } = event.data

    console.log(
      JSON.stringify({
        event: 'drive.sync.started',
        organizationId,
        timestamp: new Date().toISOString(),
      })
    )

    // STEP 1: Acquire atomic lease on channel
    const leaseAcquired = await step.run('acquire-channel-lease', async () => {
      const channelCol = driveWatchChannelsCollection()
      const now = new Date()
      const leaseExpiry = new Date(Date.now() + SYNC_LOCK_DURATION_MS)

      const result = await channelCol.findOneAndUpdate(
        {
          organizationId,
          status: 'ACTIVE',
          $or: [
            { syncLockUntil: { $exists: false } },
            { syncLockUntil: { $lt: now } },
            { syncLockUntil: null },
          ],
        },
        {
          $set: {
            syncLockUntil: leaseExpiry,
            updatedAt: now,
          },
        },
        { returnDocument: 'after' }
      )

      return !!result
    })

    if (!leaseAcquired) {
      console.log(
        JSON.stringify({
          event: 'drive.sync.skipped',
          reason: 'concurrent_sync_in_progress',
          organizationId,
          timestamp: new Date().toISOString(),
        })
      )
      return { skipped: true, reason: 'Sync already in progress for tenant' }
    }

    try {
      // STEP 2: Load channel, token, and active job configs
      const setupData = await step.run('load-sync-context', async () => {
        const channelCol = driveWatchChannelsCollection()
        const channel = await channelCol.findOne({ organizationId, status: 'ACTIVE' })
        if (!channel) throw new Error(`No active watch channel found for organization ${organizationId}`)

        const token = await getDriveAccessToken()
        if (!token) throw new Error('Google service account credentials not configured')

        const configCol = jobAutomationConfigCollection()
        const configs = await configCol
          .find({
            organizationId,
            enabled: true,
            googleDriveResumeFolderId: { $exists: true, $ne: '' },
          })
          .toArray()

        return {
          pageToken: channel.pageToken,
          configs: configs.map((c) => ({
            jobId: c.jobId,
            folderId: (c.googleDriveResumeFolderId || '').trim(),
          })),
        }
      })

      if (setupData.configs.length === 0) {
        return { filesScanned: 0, resumesEnqueued: 0, message: 'No active jobs configured' }
      }

      // STEP 3: Scan changes and identify candidate files
      const syncResult = await step.run('scan-and-enqueue-changes', async () => {
        const token = await getDriveAccessToken()
        if (!token) throw new Error('Drive access token unavailable')

        const folderToJob = new Map<string, string>()
        for (const cfg of setupData.configs) {
          if (cfg.folderId) folderToJob.set(cfg.folderId, cfg.jobId)
        }

        let pageToken = setupData.pageToken
        let newPageToken = pageToken
        let filesScanned = 0
        const filesToProcess: Array<{
          fileId: string
          fileName: string
          mimeType: string
          folderId: string
          jobId: string
        }> = []

        while (pageToken) {
          const changesUrl =
            `https://www.googleapis.com/drive/v3/changes?` +
            `pageToken=${encodeURIComponent(pageToken)}&` +
            `fields=nextPageToken,newStartPageToken,changes(changeType,fileId,file(id,name,mimeType,parents,trashed,createdTime))&` +
            `includeItemsFromAllDrives=false&supportsAllDrives=false`

          const res = await fetch(changesUrl, {
            headers: { Authorization: `Bearer ${token}` },
          })

          if (!res.ok) {
            console.error(`[drive-sync] Changes API returned HTTP ${res.status}`)
            break
          }

          const data = await res.json()
          const changes: any[] = data.changes || []
          filesScanned += changes.length

          if (data.newStartPageToken) {
            newPageToken = data.newStartPageToken
          }

          for (const ch of changes) {
            if (ch.changeType !== 'file') continue
            const file = ch.file
            if (!file || file.trashed) continue

            // Filter supported resume formats (PDF / DOCX)
            if (
              file.mimeType !== 'application/pdf' &&
              file.mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ) {
              console.log(
                JSON.stringify({
                  event: 'drive.file.ignored',
                  fileId: file.id,
                  fileName: file.name,
                  reason: 'Unsupported mimeType',
                  organizationId,
                  timestamp: new Date().toISOString(),
                })
              )
              continue
            }

            // Check parent folder matching
            const parents: string[] = file.parents || []
            let matchedJobId: string | undefined
            let matchedFolderId = ''

            for (const parent of parents) {
              if (folderToJob.has(parent)) {
                matchedJobId = folderToJob.get(parent)
                matchedFolderId = parent
                break
              }
            }

            if (!matchedJobId) {
              console.log(
                JSON.stringify({
                  event: 'drive.file.ignored',
                  fileId: file.id,
                  fileName: file.name,
                  reason: 'Not in configured resume folder',
                  organizationId,
                  timestamp: new Date().toISOString(),
                })
              )
              continue
            }

            console.log(
              JSON.stringify({
                event: 'drive.file.detected',
                fileId: file.id,
                fileName: file.name,
                folderId: matchedFolderId,
                organizationId,
                jobId: matchedJobId,
                timestamp: new Date().toISOString(),
              })
            )

            filesToProcess.push({
              fileId: file.id,
              fileName: file.name,
              mimeType: file.mimeType,
              folderId: matchedFolderId,
              jobId: matchedJobId,
            })
          }

          pageToken = data.nextPageToken || ''
        }

        // STEP 4: Idempotent record creation & Inngest event dispatch
        const recordsCol = resumeProcessingRecordsCollection()
        let enqueuedCount = 0

        for (const item of filesToProcess) {
          // Idempotency check: if already COMPLETED or currently processing, do nothing
          const existing = await recordsCol.findOne({
            organizationId,
            $or: [{ sourceFileId: item.fileId }, { googleDriveFileId: item.fileId }],
          })

          if (existing) {
            if (
              existing.status === 'COMPLETED' ||
              ['QUEUED', 'DOWNLOADING', 'EXTRACTING', 'AI_PROCESSING', 'EVALUATING', 'SHEETS_SYNCING'].includes(
                existing.status
              )
            ) {
              console.log(
                JSON.stringify({
                  event: 'drive.file.skipped',
                  reason: 'idempotent_already_present',
                  organizationId,
                  jobId: item.jobId,
                  fileId: item.fileId,
                  fileName: item.fileName,
                  status: existing.status,
                  timestamp: new Date().toISOString(),
                })
              )
              continue
            }
          }

          // Create processing record before downloading (Section 9 & 6)
          let recordId: string
          if (!existing) {
            const insert = await recordsCol.insertOne({
              organizationId,
              jobId: item.jobId,
              source: 'google_drive',
              externalSource: 'google_drive',
              sourceFileId: item.fileId,
              googleDriveFileId: item.fileId,
              googleDriveFolderId: item.folderId,
              fileName: item.fileName,
              mimeType: item.mimeType,
              status: 'QUEUED',
              discoveredAt: new Date(),
              stageActivities: [
                {
                  stage: 'Resume detected',
                  message: `Detected "${item.fileName}" in Google Drive folder`,
                  timestamp: new Date(),
                },
              ],
              createdAt: new Date(),
              updatedAt: new Date(),
            } as any)
            recordId = insert.insertedId.toString()
          } else {
            recordId = existing._id.toString()
          }

          // Enqueue durable Inngest background event
          await inngest.send({
            name: 'google/drive.resume.detected',
            data: {
              processingRecordId: recordId,
              organizationId,
              jobId: item.jobId,
              googleDriveFileId: item.fileId,
              googleDriveFolderId: item.folderId,
              fileName: item.fileName,
              mimeType: item.mimeType,
            },
          })

          enqueuedCount++
        }

        return {
          filesScanned,
          resumesEnqueued: enqueuedCount,
          newPageToken,
        }
      })

      // STEP 5: Atomically update pageToken and release lease
      await step.run('update-page-token-and-release', async () => {
        const channelCol = driveWatchChannelsCollection()
        await channelCol.updateOne(
          { organizationId },
          {
            $set: {
              pageToken: syncResult.newPageToken,
              lastSyncAt: new Date(),
              syncLockUntil: null, // release lease
              updatedAt: new Date(),
            },
          }
        )
      })

      console.log(
        JSON.stringify({
          event: 'drive.sync.completed',
          organizationId,
          filesScanned: syncResult.filesScanned,
          resumesEnqueued: syncResult.resumesEnqueued,
          timestamp: new Date().toISOString(),
        })
      )

      return syncResult
    } catch (err: any) {
      // Ensure lease is released on failure so subsequent attempts aren't blocked
      const channelCol = driveWatchChannelsCollection()
      await channelCol.updateOne(
        { organizationId },
        { $set: { syncLockUntil: null, updatedAt: new Date() } }
      )
      throw err
    }
  }
)
