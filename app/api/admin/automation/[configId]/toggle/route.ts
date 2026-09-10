import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobAutomationConfigCollection } from '@/lib/mongodb'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'

/**
 * POST /api/admin/automation/[configId]/toggle
 * Body: { enabled: boolean }
 *
 * Enables or disables a specific job automation config.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const { configId } = await params
    const body = await req.json()
    const enabled = Boolean(body.enabled)

    const configCol = jobAutomationConfigCollection()
    const result = await configCol.updateOne(
      { _id: new ObjectId(configId) },
      { $set: { enabled, updatedAt: new Date() } }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, enabled })
  } catch (error: any) {
    console.error('[admin/automation/toggle] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to toggle automation' },
      { status: 500 }
    )
  }
}
