import { NextResponse } from 'next/server'
import { organizationAutomationSettingsCollection, activitiesCollection } from '@/lib/mongodb'
import { getBaseUrl } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const rawState = url.searchParams.get('state')
  const baseUrl = getBaseUrl(req)

  let organization = 'default'
  let returnTo = '/?activeView=Automation'

  if (rawState) {
    try {
      const parsedState = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'))
      if (parsedState.organization) organization = parsedState.organization
      if (parsedState.returnTo) returnTo = parsedState.returnTo
    } catch {}
  }

  if (error || !code) {
    return NextResponse.redirect(
      `${baseUrl}${returnTo}?drive_error=${encodeURIComponent(
        error || 'Google authorization was cancelled or denied.'
      )}`
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}${returnTo}?drive_error=${encodeURIComponent(
        'Google OAuth credentials not configured on server.'
      )}`
    )
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/callback/google/drive`

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
      console.error('[Google Drive OAuth] Token exchange failed:', tokenData)
      return NextResponse.redirect(
        `${baseUrl}${returnTo}?drive_error=${encodeURIComponent(
          tokenData.error_description || 'Failed to exchange authorization code for Google Drive.'
        )}`
      )
    }

    // Retrieve user profile email from Google
    let connectedEmail = 'connected-user@google.com'
    try {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (userinfoRes.ok) {
        const userInfo = await userinfoRes.json()
        if (userInfo.email) connectedEmail = userInfo.email.toLowerCase()
      }
    } catch (err) {
      console.warn('[Google Drive OAuth] Could not fetch user profile:', err)
    }

    // Persist refresh token to organization settings
    const col = organizationAutomationSettingsCollection()
    const updatePayload: any = {
      googleConnectedEmail: connectedEmail,
      googleConnectedAt: new Date(),
      updatedAt: new Date(),
    }

    // If Google returned a refresh_token, save it
    if (tokenData.refresh_token) {
      updatePayload.googleRefreshToken = tokenData.refresh_token
    }

    await col.updateOne(
      { organizationId: organization },
      {
        $set: updatePayload,
        $setOnInsert: {
          organizationId: organization,
          activeMode: false,
          watchIntervalMinutes: 5,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )

    // Record activity
    try {
      const actCol = activitiesCollection()
      await actCol.insertOne({
        organization,
        title: 'Google Drive Connected',
        detail: `Connected Google Drive and Sheets access for ${connectedEmail}.`,
        type: 'system',
        createdAt: new Date(),
      })
    } catch {}

    const separator = returnTo.includes('?') ? '&' : '?'
    return NextResponse.redirect(
      `${baseUrl}${returnTo}${separator}drive_connected=true&email=${encodeURIComponent(
        connectedEmail
      )}`
    )
  } catch (err: any) {
    console.error('[Google Drive OAuth Callback] Error:', err)
    return NextResponse.redirect(
      `${baseUrl}${returnTo}?drive_error=${encodeURIComponent(
        err.message || 'An unexpected error occurred during Google Drive connection.'
      )}`
    )
  }
}
