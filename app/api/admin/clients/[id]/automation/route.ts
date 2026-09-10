import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import {
  clientsCollection,
  jobsCollection,
  jobAutomationConfigCollection,
  resumeProcessingRecordsCollection,
  candidateProfilesCollection,
  driveWatchChannelsCollection,
} from '@/lib/mongodb'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'
import type {
  AutomationReadinessStatus,
  ClientAutomationSummary,
  JobAutomationSummary,
} from '@/lib/types'

/**
 * Compute readiness status from DB fields — never hardcoded.
 * We deliberately never return OAuth tokens, refresh tokens, or secrets.
 */
function fieldStatus(value: string | undefined | null): AutomationReadinessStatus {
  return value && value.trim().length > 0 ? 'CONFIGURED' : 'NOT_CONFIGURED'
}

function rollup(statuses: AutomationReadinessStatus[]): AutomationReadinessStatus {
  if (statuses.length === 0) return 'NOT_CONFIGURED'
  if (statuses.every((s) => s === 'NOT_CONFIGURED')) return 'NOT_CONFIGURED'
  if (statuses.some((s) => s === 'ERROR')) return 'ERROR'
  if (statuses.some((s) => s === 'DISABLED')) return 'DISABLED'
  if (statuses.every((s) => s === 'CONFIGURED' || s === 'CONNECTED')) return 'CONFIGURED'
  return 'NOT_CONFIGURED'
}

// GET /api/admin/clients/[id]/automation
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const { id } = await params

    // Resolve client
    const col = clientsCollection()
    const client = await col.findOne({ _id: new ObjectId(id) })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const org = client.slug

    // Fetch all jobs for this org
    const jobsCol = jobsCollection()
    const jobs = await jobsCol.find({ organization: org }).toArray()

    // Fetch all automation configs for this org
    const configCol = jobAutomationConfigCollection()
    const configs = await configCol.find({ organizationId: org }).toArray()
    const configByJobId = new Map(configs.map((c) => [c.jobId, c]))

    // Fetch aggregate stats from processing records per job
    const recordsCol = resumeProcessingRecordsCollection()
    const candidatesCol = candidateProfilesCollection()

    const jobAutomations: JobAutomationSummary[] = await Promise.all(
      jobs.map(async (job) => {
        const jobId = job._id.toString()
        const config = configByJobId.get(jobId)

        // Compute individual field statuses
        const resumeFolder = config
          ? config.enabled === false
            ? 'DISABLED'
            : fieldStatus(config.googleDriveResumeFolderId)
          : 'NOT_CONFIGURED'

        const jdFile = config
          ? config.enabled === false
            ? 'DISABLED'
            : fieldStatus(config.googleDriveJdFileId)
          : 'NOT_CONFIGURED'

        const tracker = config
          ? config.enabled === false
            ? 'DISABLED'
            : fieldStatus(config.googleSheetsSpreadsheetId)
          : 'NOT_CONFIGURED'

        // Overall automation status
        let automationStatus: AutomationReadinessStatus = 'NOT_CONFIGURED'
        if (!config) {
          automationStatus = 'NOT_CONFIGURED'
        } else if (!config.enabled) {
          automationStatus = 'DISABLED'
        } else if (
          config.googleDriveResumeFolderId &&
          config.googleDriveJdFileId &&
          config.googleSheetsSpreadsheetId
        ) {
          automationStatus = 'CONFIGURED'
        } else {
          automationStatus = 'NOT_CONFIGURED'
        }

        // Last processed resume date + error count for this job
        const [lastRecord, errorCount, candidateCount] = await Promise.all([
          recordsCol
            .find({ jobId, organizationId: org })
            .sort({ updatedAt: -1 })
            .limit(1)
            .toArray(),
          recordsCol.countDocuments({ jobId, organizationId: org, status: 'FAILED' }),
          candidatesCol.countDocuments({ jobId, organization: org }),
        ])

        return {
          jobId,
          jobTitle: job.title,
          configId: config ? config._id.toString() : undefined,
          resumeFolder,
          jdFile,
          tracker,
          automationStatus,
          lastProcessed: lastRecord[0]
            ? new Date(lastRecord[0].updatedAt).toISOString()
            : null,
          candidateCount,
          errorCount,
          enabled: config?.enabled ?? false,
        } satisfies JobAutomationSummary
      })
    )

    // Fetch watch channel status (safe metadata only — no tokens)
    const channelCol = driveWatchChannelsCollection()
    const channel = await channelCol.findOne({ organizationId: org })
    const watchChannel = channel
      ? {
          status: channel.status,
          expiration: channel.expiration,
          lastSyncAt: channel.lastSyncAt ?? null,
          lastWebhookAt: (channel as any).lastWebhookAt ?? null,
          lastError: channel.lastError ?? null,
        }
      : null

    // Roll up across all jobs for the client-level columns
    const summary: ClientAutomationSummary & { watchChannel: typeof watchChannel } = {
      drive: rollup(jobAutomations.map((j) => j.resumeFolder)),
      jd: rollup(jobAutomations.map((j) => j.jdFile)),
      tracker: rollup(jobAutomations.map((j) => j.tracker)),
      automation: rollup(jobAutomations.map((j) => j.automationStatus)),
      lastResumeProcessed: jobAutomations
        .map((j) => j.lastProcessed)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
      errorCount: jobAutomations.reduce((a, j) => a + j.errorCount, 0),
      jobAutomations,
      watchChannel,
    }

    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error('[admin/automation] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to compute automation summary' },
      { status: 500 }
    )
  }
}
