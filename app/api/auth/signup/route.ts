import { NextResponse } from 'next/server'
import { usersCollection } from '@/lib/mongodb'
import { hashPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { fullName, company, email, password, confirmPassword } = body

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Full name, email, and password are required' },
        { status: 400 }
      )
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    const collection = usersCollection()

    const existing = await collection.findOne({ email: normalizedEmail })
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    const passwordHash = hashPassword(password)

    // `organization` is derived from the company name the user enters at signup.
    // It is stored as a slug-like string that scopes all their recruitment data.
    const organizationSlug = (company || '').trim().toLowerCase().replace(/\s+/g, '-') || normalizedEmail.split('@')[1]

    const newUser = {
      fullName: fullName.trim(),
      company: (company || '').trim(),
      organization: organizationSlug,
      email: normalizedEmail,
      passwordHash,
      provider: 'credentials',
      role: 'recruiter' as const,  // default role; superadmin must be set manually in DB
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(newUser)
    const userId = result.insertedId.toString()

    const token = createSessionToken({
      userId,
      email: normalizedEmail,
      fullName: newUser.fullName,
      company: newUser.company,
      organization: organizationSlug,
      role: 'recruiter',
      provider: 'credentials',
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        fullName: newUser.fullName,
        company: newUser.company,
        organization: organizationSlug,
        email: normalizedEmail,
      },
    })

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create account' }, { status: 500 })
  }
}
