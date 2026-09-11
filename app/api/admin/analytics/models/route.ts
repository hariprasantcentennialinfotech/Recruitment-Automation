import { NextResponse } from 'next/server'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'
import { getModelUsageAnalytics } from '@/lib/model-usage-logger'

export async function GET(req: Request) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const url = new URL(req.url)
    const days = parseInt(url.searchParams.get('days') || '30', 10)
    const analytics = await getModelUsageAnalytics(isNaN(days) ? 30 : days)

    return NextResponse.json(analytics)
  } catch (error: any) {
    console.error('[admin/analytics/models] error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch model analytics' },
      { status: 500 }
    )
  }
}
