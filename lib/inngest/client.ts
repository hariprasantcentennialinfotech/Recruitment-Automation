import { Inngest } from 'inngest'

export type DriveChangedEvent = {
  data: {
    organizationId: string
    channelId?: string
    resourceId?: string
  }
}

export type DriveResumeDetectedEvent = {
  data: {
    processingRecordId: string
    organizationId: string
    jobId: string
    googleDriveFileId: string
    googleDriveFolderId?: string
    fileName: string
    mimeType: string
  }
}

export type DriveRenewChannelsEvent = {
  data?: {
    force?: boolean
  }
}

export type InngestEvents = {
  'google/drive.changed': DriveChangedEvent
  'google/drive.resume.detected': DriveResumeDetectedEvent
  'google/drive.renew.channels': DriveRenewChannelsEvent
}

/**
 * Inngest client configured for Recruitment Automation SaaS.
 * Provides durable execution, step isolation, and automatic retries on Vercel.
 *
 * In production (Vercel): Sends events directly to Inngest Cloud via INNGEST_EVENT_KEY.
 * In local testing without inngest-cli: Acknowledges events cleanly without blocking timeouts.
 */
const inngestFetch = async (url: any, opts: any) => {
  if (process.env.INNGEST_EVENT_KEY) {
    return fetch(url, opts)
  }
  // Local development / test fallback
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 200)
    const res = await fetch(url, { ...opts, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch {
    return new Response(JSON.stringify({ status: 200, ids: [`evt_${Date.now()}`] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const inngest = new Inngest({
  id: 'recruitment-automation',
  eventKey: process.env.INNGEST_EVENT_KEY || 'local-dev-key',
  fetch: inngestFetch,
})
