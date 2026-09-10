import { NextResponse } from 'next/server'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { syncGoogleDriveChanges } from '@/lib/google-drive-sync'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/google-drive/sync
 *
 * Manual "Sync Now" trigger.
 * Runs syncGoogleDriveChanges for the current organization synchronously
 * so the admin can see immediate results.
 *
 * Normal operation uses the webhook (/api/integrations/google-drive/webhook).
 * This is a manual recovery/debugging action.
 */
export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const result = await syncGoogleDriveChanges(organization)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err: any) {
    console.error('[integrations/google-drive/sync] POST error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Sync failed' },
      { status: 500 }
    )
  }
}
