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
        return NextResponse.json({
          user: {
            id: user._id.toString(),
            fullName: user.fullName,
            company: user.company,
            email: user.email,
            image: user.image,
            provider: user.provider
          }
        })
      }
    } catch {
      // If DB query fails, fall back to session
    }

    return NextResponse.json({ user: session })
  } catch (err: any) {
    return NextResponse.json({ user: null })
  }
}
