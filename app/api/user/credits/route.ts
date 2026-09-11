import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUserCredits, getCreditTransactions } from '@/lib/credits'

export async function GET(req: Request) {
  try {
    const session = await getSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const credits = await getUserCredits(session.userId)
    const transactions = await getCreditTransactions({
      userId: session.userId,
      limit: 20,
    })

    return NextResponse.json({
      credits,
      transactions,
    })
  } catch (error: any) {
    console.error('[user/credits] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch credits' },
      { status: 500 }
    )
  }
}
