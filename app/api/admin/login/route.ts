import { NextResponse } from 'next/server'
import { createSessionToken, SessionPayload } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()

    const configuredUsername = process.env.ADMIN_USERNAME || 'Sharp'
    const configuredPassword = process.env.ADMIN_PASSWORD || 'h0405200615'

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    if (username.trim() !== configuredUsername || password !== configuredPassword) {
      return NextResponse.json(
        { error: 'Invalid admin username or password' },
        { status: 401 }
      )
    }

    const payload: SessionPayload = {
      userId: 'admin_root',
      email: 'admin@centennialinfotech.com',
      fullName: `Super Admin (${configuredUsername})`,
      company: 'Centennial Infotech',
      organization: 'centennial',
      provider: 'credentials',
      role: 'superadmin',
    }

    const token = createSessionToken(payload)

    const response = NextResponse.json({
      success: true,
      message: 'Admin authentication successful',
      user: payload,
    })

    response.cookies.set({
      name: 'centennial_auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error: any) {
    console.error('[admin/login] error:', error)
    return NextResponse.json(
      { error: error.message || 'Authentication failed' },
      { status: 500 }
    )
  }
}
