import { NextResponse } from 'next/server'
import { allocateCredits } from '@/lib/credits'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'

export async function POST(req: Request) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const body = await req.json()
    const { userIds, allUsers, amount, note } = body

    const parsedAmount = Number(amount)
    if (isNaN(parsedAmount) || parsedAmount === 0) {
      return NextResponse.json(
        { error: 'Valid credit amount is required (e.g. 1000)' },
        { status: 400 }
      )
    }

    if (!allUsers && (!Array.isArray(userIds) || userIds.length === 0)) {
      return NextResponse.json(
        { error: 'Please specify user IDs or set allUsers: true' },
        { status: 400 }
      )
    }

    const result = await allocateCredits({
      userIds,
      allUsers: Boolean(allUsers),
      amount: parsedAmount,
      note: note?.trim(),
      adminUser: authResult.user.fullName || 'Admin',
    })

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount,
      amount: parsedAmount,
      allUsers: Boolean(allUsers),
      message: `Successfully allocated ${parsedAmount} credits to ${
        allUsers ? 'all' : result.modifiedCount
      } user(s).`,
    })
  } catch (error: any) {
    console.error('[admin/credits/allocate] error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to allocate credits' },
      { status: 500 }
    )
  }
}
