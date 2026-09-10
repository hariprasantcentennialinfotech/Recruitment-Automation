import { NextResponse } from 'next/server'
import { driveWatchChannelsCollection } from '@/lib/mongodb'
import { inngest } from '@/lib/inngest'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/google-drive/webhook
 *
 * Receives Google Drive change notifications.
 *
 * Architecture (Task 8.1 - Vercel & Inngest):
 * 1. Validate X-Goog-Channel-Token matches organizationId + secret.
 * 2. Verify active channel in MongoDB.
 * 3. Enqueue durable 'google/drive.changed' event to Inngest.
 * 4. Acknowledge notification immediately (200 OK).
 *
 * Zero fire-and-forget promises. All heavy sync & processing is handled
 * durably outside the serverless request by Inngest.
 */
export async function POST(req: Request) {
  const channelId = req.headers.get('x-goog-channel-id') || ''
  const resourceState = req.headers.get('x-goog-resource-state') || ''
  const channelToken = req.headers.get('x-goog-channel-token') || ''
  const resourceId = req.headers.get('x-goog-resource-id') || ''

  // Parse token: format is `org=<organizationId>&secret=<secret>`
  const params = new URLSearchParams(channelToken)
  const organizationId = params.get('org') || ''
  const secret = params.get('secret') || ''

  console.log(
    JSON.stringify({
      event: 'drive.webhook.received',
      channelId,
      organizationId,
      resourceState,
      timestamp: new Date().toISOString(),
    })
  )

  // Validate secret if configured
  const configuredSecret = process.env.GOOGLE_DRIVE_WEBHOOK_SECRET || ''
  if (configuredSecret && secret !== configuredSecret) {
    console.warn(`[drive/webhook] Invalid webhook secret for channelId=${channelId}`)
    // Still return 200 to avoid Drive disabling our channel
    return new NextResponse(null, { status: 200 })
  }

  // Ignore sync (initial channel validation) notifications
  if (resourceState === 'sync') {
    console.log(`[drive/webhook] Sync notification for org=${organizationId} channelId=${channelId} — ack only`)
    return new NextResponse(null, { status: 200 })
  }

  if (!organizationId) {
    console.warn('[drive/webhook] Missing organizationId in channel token')
    return new NextResponse(null, { status: 200 })
  }

  // Verify the channel exists in MongoDB (prevents replay attacks)
  try {
    const col = driveWatchChannelsCollection()
    const channel = await col.findOne({ channelId, organizationId, status: 'ACTIVE' })
    if (!channel) {
      console.warn(`[drive/webhook] Unknown or inactive channel: ${channelId} for org=${organizationId}`)
      return new NextResponse(null, { status: 200 })
    }

    // Update last webhook received timestamp
    await col.updateOne(
      { channelId },
      { $set: { lastWebhookAt: new Date(), updatedAt: new Date() } }
    )
  } catch (err) {
    console.error('[drive/webhook] MongoDB lookup error:', err)
    // Still ack — don't let DB errors disable the channel
    return new NextResponse(null, { status: 200 })
  }

  // Enqueue durable Inngest event — zero fire-and-forget background promises
  try {
    await inngest.send({
      name: 'google/drive.changed',
      data: {
        organizationId,
        channelId,
        resourceId: resourceId || undefined,
      },
    })

    console.log(
      JSON.stringify({
        event: 'drive.sync.enqueued',
        organizationId,
        channelId,
        timestamp: new Date().toISOString(),
      })
    )
  } catch (err: any) {
    console.error('[drive/webhook] Failed to enqueue Inngest event:', err.message)
    // Still return 200 to acknowledge receipt to Google
  }

  return new NextResponse(null, { status: 200 })
}
