import { NextResponse } from 'next/server'
import { usersCollection } from '@/lib/mongodb'
import { verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const collection = usersCollection()

    const user = await collection.findOne({ email: normalizedEmail })
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'This account was registered with Google. Please sign in with Google.' },
        { status: 400 }
      )
    }

    const isValid = verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Derive organization — prefer explicit field, fall back to company slug
    const organization =
      user.organization ||
      (user.company || '').toLowerCase().replace(/\s+/g, '-') ||
      normalizedEmail.split('@')[1]

    const token = createSessionToken({
      userId: user._id.toString(),
      email: user.email,
      fullName: user.fullName || '',
      company: user.company || '',
      organization,
      role: user.role || 'recruiter',
      provider: 'credentials',
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        company: user.company,
        organization,
        email: user.email,
      },
    })

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error: any) {
    console.error('Signin error:', error)
    return NextResponse.json({ error: error.message || 'Failed to sign in' }, { status: 500 })
  }
}
