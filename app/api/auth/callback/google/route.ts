import { NextResponse } from 'next/server'
import { usersCollection } from '@/lib/mongodb'
import { getBaseUrl, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const baseUrl = getBaseUrl(req)

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(error || 'No authorization code provided')}`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent('Google credentials are not configured in .env')}`)
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/callback/google`

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Failed to exchange Google code:', tokenData)
      return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(tokenData.error_description || 'Failed to exchange Google token')}`)
    }

    // Fetch user profile from Google
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    const googleUser = await userinfoResponse.json()

    if (!userinfoResponse.ok || !googleUser.email) {
      return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent('Failed to fetch user info from Google')}`)
    }

    const normalizedEmail = googleUser.email.toLowerCase()
    const collection = usersCollection()

    // Find or create user in MongoDB
    let user = await collection.findOne({ email: normalizedEmail })
    let userId: string

    if (user) {
      userId = user._id.toString()
      await collection.updateOne(
        { _id: user._id },
        {
          $set: {
            fullName: user.fullName || googleUser.name,
            image: googleUser.picture || user.image,
            googleId: googleUser.id,
            updatedAt: new Date()
          }
        }
      )
    } else {
      const emailDomain = googleUser.email ? googleUser.email.split('@')[1] : ''
      const isGeneric = ['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes((emailDomain || '').toLowerCase())
      const defaultOrg = !isGeneric && emailDomain ? emailDomain.split('.')[0] : ''
      const newUser = {
        fullName: googleUser.name || 'Google User',
        company: defaultOrg,
        organization: defaultOrg,
        email: normalizedEmail,
        image: googleUser.picture,
        provider: 'google',
        googleId: googleUser.id,
        role: 'recruiter',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      const insertResult = await collection.insertOne(newUser)
      userId = insertResult.insertedId.toString()
      user = { _id: insertResult.insertedId, ...newUser }
    }

    // Derive organization for session — prioritize user's saved organization or company
    const orgValue =
      user.organization ||
      user.company ||
      ''

    // Create session token
    const token = createSessionToken({
      userId,
      email: normalizedEmail,
      fullName: user.fullName || googleUser.name,
      company: user.company || orgValue,
      organization: orgValue,
      role: user.role || 'recruiter',
      image: googleUser.picture,
      provider: 'google'
    })

    const response = NextResponse.redirect(`${baseUrl}/?auth=success`)
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return response
  } catch (err: any) {
    console.error('Google callback error:', err)
    return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(err.message || 'An unexpected error occurred during Google sign-in')}`)
  }
}
