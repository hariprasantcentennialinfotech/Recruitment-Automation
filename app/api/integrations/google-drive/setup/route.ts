import { NextResponse } from 'next/server'
import { requireOrganization, requireSuperAdmin, isAuthError } from '@/lib/server-auth'
import { createDriveWatchChannel, getChannelStatus } from '@/lib/google-drive-sync'
import { driveWatchChannelsCollection } from '@/lib/mongodb'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/google-drive/setup
 * Returns the watch channel status for the current organization.
 * Super admins can pass ?tenantOrg= to inspect a specific org.
 */
export async function GET(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  const status = await getChannelStatus(organization)
  return NextResponse.json({ channel: status })
}

/**
 * POST /api/integrations/google-drive/setup
 * Registers a new Google Drive watch channel for the org.
 * Requires GOOGLE_SERVICE_ACCOUNT_KEY and APP_URL to be configured.
 */
export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const channel = await createDriveWatchChannel(organization)

    return NextResponse.json({
      success: true,
      channel: {
        channelId: channel.channelId.slice(-8), // partial for display
        organizationId: channel.organizationId,
        status: channel.status,
        expiration: channel.expiration,
        createdAt: channel.createdAt,
      },
    })
  } catch (err: any) {
    console.error('[integrations/google-drive/setup] POST error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to register watch channel' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integrations/google-drive/setup
 * Stops the watch channel for the org and marks it EXPIRED.
 */
export async function DELETE(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const col = driveWatchChannelsCollection()
    await col.updateOne(
      { organizationId: organization },
      { $set: { status: 'EXPIRED', updatedAt: new Date() } }
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to stop watch channel' },
      { status: 500 }
    )
  }
}
