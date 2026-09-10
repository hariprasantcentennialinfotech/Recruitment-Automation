import { NextResponse } from 'next/server'
import { getBaseUrl, getSession } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID

  if (!clientId) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID is not configured in .env' },
      { status: 500 }
    )
  }

  const url = new URL(req.url)
  const session = await getSession()

  // Get organization from query param or user session
  const organization =
    url.searchParams.get('organization') ||
    session?.organization ||
    session?.company ||
    'default'

  const baseUrl = getBaseUrl(req)
  const redirectUri = `${baseUrl}/api/auth/callback/google/drive`

  // Scopes for reading Drive files/folders and updating Google Sheets
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
  ]

  const statePayload = Buffer.from(
    JSON.stringify({
      organization,
      returnTo: url.searchParams.get('returnTo') || '/?activeView=Automation',
    })
  ).toString('base64url')

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', clientId)
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', scopes.join(' '))
  googleAuthUrl.searchParams.set('access_type', 'offline')
  googleAuthUrl.searchParams.set('prompt', 'consent') // Force consent prompt to guarantee refresh_token
  googleAuthUrl.searchParams.set('state', statePayload)

  return NextResponse.redirect(googleAuthUrl.toString())
}
