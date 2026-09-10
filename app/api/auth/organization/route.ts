import { NextResponse } from 'next/server'
import { getSession, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth'
import { usersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const body = await req.json()
    const { organization } = body

    if (!organization || typeof organization !== 'string' || !organization.trim()) {
      return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })
    }

    const orgName = organization.trim()
    const col = usersCollection()

    await col.updateOne(
      { _id: new ObjectId(session.userId) },
      {
        $set: {
          organization: orgName,
          company: orgName,
          updatedAt: new Date()
        }
      }
    )

    // Refresh the auth token cookie with the new organization & company
    const updatedPayload = {
      ...session,
      company: orgName,
      organization: orgName,
    }
    const token = createSessionToken(updatedPayload)

    const response = NextResponse.json({
      success: true,
      organization: orgName,
      company: orgName,
    })

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (err: any) {
    console.error('Error updating organization:', err)
    return NextResponse.json({ error: err.message || 'Failed to update organization' }, { status: 500 })
  }
}
