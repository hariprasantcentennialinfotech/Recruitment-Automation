import { NextResponse } from 'next/server'
import { usersCollection, creditTransactionsCollection } from '@/lib/mongodb'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'

export async function GET() {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const col = usersCollection()
    const users = await col.find({}).sort({ createdAt: -1 }).toArray()

    let totalCredits = 0
    let lowCreditCount = 0

    const formattedUsers = users.map((u) => {
      const credits = typeof u.credits === 'number' ? u.credits : 0
      totalCredits += credits
      if (credits < 30) lowCreditCount++

      return {
        id: u._id.toString(),
        fullName: u.fullName || u.name || 'Unnamed User',
        email: u.email,
        organization: u.organization || u.company || 'Default',
        company: u.company || u.organization || '',
        role: u.role || 'recruiter',
        credits,
        lastCreditUpdate: u.lastCreditUpdate || null,
        createdAt: u.createdAt || null,
      }
    })

    return NextResponse.json({
      users: formattedUsers,
      stats: {
        totalUsers: formattedUsers.length,
        totalCredits,
        lowCreditUsers: lowCreditCount,
      }
    })
  } catch (error: any) {
    console.error('[admin/users] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
