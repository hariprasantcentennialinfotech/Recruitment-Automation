import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { usersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ user: null })
    }

    // Try fetching fresh data from MongoDB
    try {
      const collection = usersCollection()
      const user = await collection.findOne({ _id: new ObjectId(session.userId) })
      if (user) {
        const org = user.organization || user.company || session.organization || session.company || ''
        return NextResponse.json({
          user: {
            id: user._id.toString(),
            fullName: user.fullName,
            company: user.company || org,
            organization: org,
            email: user.email,
            image: user.image,
            provider: user.provider,
            role: user.role || 'recruiter',
            credits: typeof user.credits === 'number' ? user.credits : 0,
          }
        })
      }
    } catch {
      // If DB query fails, fall back to session
    }

    const sessionOrg = session.organization || session.company || ''
    return NextResponse.json({
      user: {
        ...session,
        company: session.company || sessionOrg,
        organization: sessionOrg,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ user: null })
  }
}
