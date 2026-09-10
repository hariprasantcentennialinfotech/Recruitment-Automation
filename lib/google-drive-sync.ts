/**
 * lib/google-drive-sync.ts
 *
 * Multi-tenant Google Drive change detection and resume ingestion service.
 *
 * Architecture:
 *   Google Drive webhook → /api/integrations/google-drive/webhook
 *     → syncGoogleDriveChanges(organizationId)
 *       → find changed files in configured resume folders
 *         → processResumeBuffer() [existing pipeline]
 *
 * Uses shared service account (Option A): each organization's folder is
 * isolated by folder ID — never by credential.
 *
 * NEVER exposes access tokens, refresh tokens, or service account credentials.
 * Server-side only. Never import in client components.
 */

import crypto from 'node:crypto'
import {
  driveWatchChannelsCollection,
  jobAutomationConfigCollection,
  resumeProcessingRecordsCollection,
} from '@/lib/mongodb'
import { processResumeBuffer } from '@/lib/google-drive-ingestion'
import { getDriveAccessToken } from '@/lib/google-auth-token'

// Re-export getDriveAccessToken for consumers
export { getDriveAccessToken }

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChannelStatus = 'ACTIVE' | 'EXPIRED' | 'ERROR'

export interface DriveWatchChannel {
  _id?: any
  channelId: string
  resourceId: string
  organizationId: string
  pageToken: string
  expiration: Date
  status: ChannelStatus
  lastSyncAt?: Date
  lastError?: string
  createdAt: Date
  updatedAt: Date
}

export interface DriveSyncResult {
  organizationId: string
  filesScanned: number
  resumesQueued: number
  duplicatesSkipped: number
  errors: string[]
}

// ─── Drive File Download ──────────────────────────────────────────────────────

/**
 * Downloads a Google Drive file as a Buffer using service account credentials.
 * NEVER exposes file content to the browser.
 */
export async function downloadDriveFile(fileId: string, organizationId?: string): Promise<Buffer> {
  const token = await getDriveAccessToken(organizationId)
  const apiKey = process.env.GOOGLE_API_KEY

  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media${
    apiKey && !token ? `&key=${apiKey}` : ''
  }`

  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`Failed to download Drive file ${fileId}: HTTP ${res.status}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

// ─── Page Token Management ────────────────────────────────────────────────────

/**
 * Gets or creates a Drive Changes startPageToken for an organization.
 * The token is stored in the watch channel document.
 */
async function getDriveStartPageToken(): Promise<string> {
  const token = await getDriveAccessToken()
  const apiKey = process.env.GOOGLE_API_KEY

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const url = `https://www.googleapis.com/drive/v3/changes/startPageToken?${
    apiKey && !token ? `key=${apiKey}` : ''
  }`

  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Failed to get Drive start page token: HTTP ${res.status}`)
  const data = await res.json()
  return data.startPageToken as string
}

// ─── Watch Channel Registration ───────────────────────────────────────────────

/**
 * Registers a Google Drive changes watch channel for an organization.
 * Returns the channel document (persisted to MongoDB).
 *
 * Requires NEXT_PUBLIC_APP_URL or APP_URL to be set (the public webhook URL).
 */
export async function createDriveWatchChannel(organizationId: string): Promise<DriveWatchChannel> {
  const token = await getDriveAccessToken()
  if (!token) throw new Error('Google service account not configured. Cannot create watch channel.')

  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!appUrl) throw new Error('APP_URL or NEXT_PUBLIC_APP_URL must be set to receive Drive webhooks.')

  const webhookUrl = `${appUrl}/api/integrations/google-drive/webhook`
  const channelId = crypto.randomUUID()
  const webhookSecret = process.env.GOOGLE_DRIVE_WEBHOOK_SECRET || ''

  // Get starting page token
  const pageToken = await getDriveStartPageToken()

  // Register the watch channel
  const watchRes = await fetch(
    `https://www.googleapis.com/drive/v3/changes/watch?pageToken=${encodeURIComponent(pageToken)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token: `org=${organizationId}&secret=${webhookSecret}`,
        expiration: (Date.now() + 7 * 24 * 60 * 60 * 1000).toString(), // 7 days
      }),
    }
  )

  if (!watchRes.ok) {
    const errText = await watchRes.text()
    throw new Error(`Failed to register Drive watch channel: ${errText}`)
  }

  const watchData = await watchRes.json()
  const expiration = new Date(parseInt(watchData.expiration || '0', 10))

  const channelDoc: Omit<DriveWatchChannel, '_id'> = {
    channelId: watchData.id,
    resourceId: watchData.resourceId,
    organizationId,
    pageToken,
    expiration,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const col = driveWatchChannelsCollection()

  // Upsert: replace any existing channel for this org
  await col.updateOne(
    { organizationId },
    { $set: channelDoc },
    { upsert: true }
  )

  return channelDoc
}

// ─── Drive Changes Synchronization ───────────────────────────────────────────

/**
 * Core sync function: fetches Drive changes since last page token,
 * matches changed files to configured resume folders, and triggers processing.
 *
 * Multi-tenant: call with the organizationId whose channel received a webhook.
 * Zero cross-tenant contamination: folder→job mapping is always org-scoped.
 */
export async function syncGoogleDriveChanges(organizationId: string): Promise<DriveSyncResult> {
  const result: DriveSyncResult = {
    organizationId,
    filesScanned: 0,
    resumesQueued: 0,
    duplicatesSkipped: 0,
    errors: [],
  }

  console.log(
    JSON.stringify({
      event: 'drive.sync.started',
      organizationId,
      timestamp: new Date().toISOString(),
    })
  )

  const channelCol = driveWatchChannelsCollection()
  const channel = await channelCol.findOne({ organizationId, status: 'ACTIVE' })

  if (!channel) {
    result.errors.push('No active watch channel found for organization')
    return result
  }

  const token = await getDriveAccessToken()
  if (!token) {
    result.errors.push('Google service account not configured')
    return result
  }

  // Fetch all automation configs for this org to build folder→job map
  const configCol = jobAutomationConfigCollection()
  const configs = await configCol
    .find({ organizationId, enabled: true, googleDriveResumeFolderId: { $exists: true, $ne: '' } })
    .toArray()

  if (configs.length === 0) {
    // No active jobs configured — nothing to watch
    return result
  }

  // Build folder ID → config map
  const folderToConfig = new Map<string, typeof configs[0]>()
  for (const cfg of configs) {
    if (cfg.googleDriveResumeFolderId) {
      folderToConfig.set(cfg.googleDriveResumeFolderId.trim(), cfg)
    }
  }

  // Paginate Drive changes
  let pageToken = channel.pageToken
  let newPageToken = pageToken

  try {
    while (pageToken) {
      const changesUrl =
        `https://www.googleapis.com/drive/v3/changes?` +
        `pageToken=${encodeURIComponent(pageToken)}&` +
        `fields=nextPageToken,newStartPageToken,changes(changeType,fileId,file(id,name,mimeType,parents,trashed,createdTime,md5Checksum))&` +
        `includeItemsFromAllDrives=false&supportsAllDrives=false`

      const changesRes = await fetch(changesUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!changesRes.ok) {
        result.errors.push(`Drive changes API error: HTTP ${changesRes.status}`)
        break
      }

      const changesData = await changesRes.json()
      const changes: any[] = changesData.changes || []
      result.filesScanned += changes.length

      if (changesData.newStartPageToken) {
        newPageToken = changesData.newStartPageToken
      }

      for (const change of changes) {
        if (change.changeType !== 'file') continue
        const file = change.file
        if (!file) continue

        // Skip folders, trashed files, and unsupported types
        if (file.trashed) continue
        if (file.mimeType === 'application/vnd.google-apps.folder') continue
        if (
          file.mimeType !== 'application/pdf' &&
          file.mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          console.log(
            JSON.stringify({
              event: 'drive.file.ignored',
              fileId: file.id,
              fileName: file.name,
              mimeType: file.mimeType,
              reason: 'Unsupported mimeType',
              organizationId,
              timestamp: new Date().toISOString(),
            })
          )
          continue
        }

        // Check if the file's parent folder is a configured resume folder
        const parents: string[] = file.parents || []
        let matchedConfig: typeof configs[0] | undefined
        let matchedFolderId = ''

        for (const parent of parents) {
          if (folderToConfig.has(parent)) {
            matchedConfig = folderToConfig.get(parent)
            matchedFolderId = parent
            break
          }
        }

        if (!matchedConfig) {
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
            jobId: matchedConfig.jobId,
            timestamp: new Date().toISOString(),
          })
        )

        // Enqueue the resume for processing (pre-checks idempotency & downloads)
        try {
          await enqueueResume({
            organizationId,
            jobId: matchedConfig.jobId,
            googleDriveFileId: file.id,
            googleDriveFolderId: matchedFolderId,
            fileName: file.name,
            mimeType: file.mimeType,
          })
          result.resumesQueued++
        } catch (err: any) {
          if (err.message?.includes('duplicate') || err.code === 11000) {
            result.duplicatesSkipped++
          } else {
            result.errors.push(`Failed to queue "${file.name}": ${err.message}`)
          }
        }
      }

      // Follow pagination
      pageToken = changesData.nextPageToken || ''
    }
  } finally {
    // Always persist the new page token so we don't re-process old changes
    if (newPageToken !== channel.pageToken) {
      await channelCol.updateOne(
        { organizationId },
        { $set: { pageToken: newPageToken, lastSyncAt: new Date(), updatedAt: new Date() } }
      )
    }
  }

  return result
}

// ─── Resume Queue ─────────────────────────────────────────────────────────────

/**
 * Downloads a Drive resume and runs it through the full processing pipeline.
 * Section 9 & 10: Checks idempotency, creates processing record before download,
 * downloads securely, then processes.
 */
export async function enqueueResume(params: {
  organizationId: string
  jobId: string
  googleDriveFileId: string
  googleDriveFolderId?: string
  fileName: string
  mimeType: string
}) {
  const { organizationId, jobId, googleDriveFileId, googleDriveFolderId, fileName, mimeType } = params

  const recordsCol = resumeProcessingRecordsCollection()

  // Idempotency check: if already COMPLETED or active, do nothing (Requirement 10)
  const existing = await recordsCol.findOne({
    organizationId,
    $or: [{ sourceFileId: googleDriveFileId }, { googleDriveFileId }],
  })

  if (existing) {
    if (existing.status === 'COMPLETED') {
      console.log(
        JSON.stringify({
          event: 'drive.file.skipped',
          reason: 'already_completed',
          organizationId,
          jobId,
          googleDriveFileId,
          fileName,
          timestamp: new Date().toISOString(),
        })
      )
      return existing
    }
    if (['QUEUED', 'EXTRACTING', 'AI_PROCESSING', 'EVALUATING'].includes(existing.status)) {
      console.log(
        JSON.stringify({
          event: 'drive.file.skipped',
          reason: 'in_progress',
          organizationId,
          jobId,
          googleDriveFileId,
          fileName,
          status: existing.status,
          timestamp: new Date().toISOString(),
        })
      )
      return existing
    }
    // If FAILED, proceed with retry
  }

  // Section 9: Create processing record before downloading the file
  if (!existing) {
    await recordsCol.insertOne({
      organizationId,
      jobId,
      source: 'google_drive',
      externalSource: 'google_drive',
      sourceFileId: googleDriveFileId,
      googleDriveFileId,
      googleDriveFolderId: googleDriveFolderId || '',
      fileName,
      mimeType,
      status: 'QUEUED',
      discoveredAt: new Date(),
      stageActivities: [
        {
          stage: 'Resume detected',
          message: `Detected "${fileName}" in Google Drive resume folder`,
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
  }

  // Download the file bytes from Drive
  const fileBuffer = await downloadDriveFile(googleDriveFileId)

  // Run through the shared candidate processing service
  const record = await processResumeBuffer({
    organizationId,
    jobId,
    fileName,
    fileBuffer,
    sourceFileId: googleDriveFileId,
    sourceFileUrl: `https://drive.google.com/file/d/${googleDriveFileId}/view`,
    externalSource: 'google_drive',
    googleDriveFolderId,
    allowSimulation: false,
  })

  return record
}

// ─── Watch Channel Renewal ────────────────────────────────────────────────────

const RENEWAL_THRESHOLD_MS = 24 * 60 * 60 * 1000 // Renew if expiring within 24h

/**
 * Checks all active watch channels and renews those approaching expiry.
 * Should be called by a Vercel cron or admin action.
 */
export async function renewExpiredChannels(): Promise<{
  checked: number
  renewed: number
  failed: string[]
}> {
  const col = driveWatchChannelsCollection()
  const threshold = new Date(Date.now() + RENEWAL_THRESHOLD_MS)

  // Find channels expiring soon or already expired
  const stale = await col
    .find({
      status: { $in: ['ACTIVE', 'EXPIRED'] },
      expiration: { $lt: threshold },
    })
    .toArray()

  let renewed = 0
  const failed: string[] = []

  for (const ch of stale) {
    try {
      // Stop the old channel if still valid
      const token = await getDriveAccessToken()
      if (token && ch.resourceId) {
        try {
          await fetch('https://www.googleapis.com/drive/v3/channels/stop', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: ch.channelId, resourceId: ch.resourceId }),
          })
        } catch {}
      }

      await createDriveWatchChannel(ch.organizationId)
      renewed++
      console.log(
        JSON.stringify({
          event: 'drive.watch.renewed',
          organizationId: ch.organizationId,
          timestamp: new Date().toISOString(),
        })
      )
    } catch (err: any) {
      console.error(
        JSON.stringify({
          event: 'drive.watch.failed',
          organizationId: ch.organizationId,
          error: err.message,
          timestamp: new Date().toISOString(),
        })
      )
      failed.push(ch.organizationId)
      // Mark as error so admin can see it
      await col.updateOne(
        { _id: ch._id },
        { $set: { status: 'ERROR', lastError: err.message, updatedAt: new Date() } }
      )
    }
  }

  return { checked: stale.length, renewed, failed }
}

/**
 * Gets the current watch channel status for an organization.
 * Returns safe metadata only — never exposes tokens or credentials.
 */
export async function getChannelStatus(organizationId: string) {
  const col = driveWatchChannelsCollection()
  const channel = await col.findOne({ organizationId })

  if (!channel) return null

  return {
    channelId: channel.channelId.slice(-8), // partial ID for display only
    organizationId: channel.organizationId,
    status: channel.status,
    expiration: channel.expiration,
    lastSyncAt: channel.lastSyncAt,
    lastError: channel.lastError,
    createdAt: channel.createdAt,
  }
}

/**
 * Directly scans a Google Drive folder and returns all files in it.
 * Used for manual workflow runs and interval-based polling.
 * Returns a simplified list of { id, name, mimeType }.
 */
export async function scanFolderDirectly(
  folderId: string,
  organizationId?: string
): Promise<{ id: string; name: string; mimeType: string }[]> {
  const token = await getDriveAccessToken(organizationId)
  if (!token) {
    throw new Error(
      'Google Drive is not connected for this organization. Please click "Connect Google Drive" in the Automation tab, or ensure service account credentials are set in .env.'
    )
  }

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
    throw new Error(`Google Drive API error scanning folder ${folderId} (HTTP ${res.status}): ${errorText}`)
  }

  const data = await res.json()
  return (data.files || []) as { id: string; name: string; mimeType: string }[]
}

