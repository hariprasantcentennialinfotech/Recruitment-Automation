import { NextResponse } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'
import { renewExpiredChannels } from '@/lib/google-drive-sync'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/google-drive/renew-channels
 *
 * Renews all Drive watch channels that are expiring within 24 hours.
 *
 * Call this:
 * - From Vercel Cron (add to vercel.json)
 * - From Super Admin portal
 * - Via CRON_SECRET header for automated calls
 *
 * Vercel cron example (vercel.json):
 * {
 *   "crons": [{ "path": "/api/integrations/google-drive/renew-channels", "schedule": "0 *\/6 * * *" }]
 * }
 */
export async function POST(req: Request) {
  // Allow calls with CRON_SECRET header (for Vercel Cron or external schedulers)
  const cronSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
  const configuredSecret = process.env.CRON_SECRET || ''

  const isValidCron = configuredSecret && cronSecret === configuredSecret

  // If not called by cron, require superadmin auth
  if (!isValidCron) {
    const authResult = await requireSuperAdmin()
    if (isAuthError(authResult)) return authResult.error
  }

  try {
    const result = await renewExpiredChannels()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err: any) {
    console.error('[integrations/google-drive/renew-channels] POST error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Renewal failed' },
      { status: 500 }
    )
  }
}
