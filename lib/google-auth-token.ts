import crypto from 'node:crypto'
import { organizationAutomationSettingsCollection } from '@/lib/mongodb'

let _cachedDriveToken: { token: string; expiresAt: number } | null = null
let _cachedSheetsToken: { token: string; expiresAt: number } | null = null

// In-memory cache for organization user OAuth tokens
const _userTokenCache = new Map<string, { token: string; expiresAt: number }>()

function getServiceAccountCredentials(): { client_email: string; private_key: string } | null {
  let client_email = ''
  let private_key = ''

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      client_email = parsed.client_email || ''
      private_key = parsed.private_key || ''
    } catch {}
  }

  if (!client_email && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    client_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    private_key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n')
  }

  if (!client_email || !private_key) return null
  return { client_email, private_key }
}

async function requestOAuthToken(scopes: string[]): Promise<string | null> {
  const creds = getServiceAccountCredentials()
  if (!creds) return null

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const claim = Buffer.from(
    JSON.stringify({
      iss: creds.client_email,
      scope: scopes.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  ).toString('base64url')

  const sigInput = `${header}.${claim}`
  try {
    const signer = crypto.createSign('RSA-SHA256')
    signer.update(sigInput)
    const signature = signer.sign(creds.private_key, 'base64url')
    const jwt = `${sigInput}.${signature}`

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    if (!res.ok) {
      console.warn('[google-auth-token] Service account token request failed:', res.status)
      return null
    }

    const data = await res.json()
    return data.access_token || null
  } catch (err: any) {
    console.warn('[google-auth-token] Error generating service account token:', err.message)
    return null
  }
}

/**
 * Exchanges a user's Google OAuth refresh_token for a fresh access_token.
 */
export async function refreshUserOAuthToken(refreshToken: string): Promise<{ token: string; expiresIn: number } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret || !refreshToken) {
    return null
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn('[google-auth-token] User refresh token exchange failed:', res.status, errText)
      return null
    }

    const data = await res.json()
    return {
      token: data.access_token,
      expiresIn: data.expires_in || 3600,
    }
  } catch (err: any) {
    console.warn('[google-auth-token] Error refreshing user OAuth token:', err.message)
    return null
  }
}

/**
 * Gets an active OAuth access token for an organization if they connected Google Drive via 1-click OAuth.
 */
async function getOrganizationUserToken(organizationId: string): Promise<string | null> {
  const cached = _userTokenCache.get(organizationId)
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token
  }

  try {
    const col = organizationAutomationSettingsCollection()
    const settings = await col.findOne({ organizationId })

    if (settings?.googleRefreshToken) {
      const refreshed = await refreshUserOAuthToken(settings.googleRefreshToken)
      if (refreshed) {
        _userTokenCache.set(organizationId, {
          token: refreshed.token,
          expiresAt: Date.now() + (refreshed.expiresIn - 60) * 1000,
        })
        return refreshed.token
      }
    }
  } catch (err: any) {
    console.warn(`[google-auth-token] Could not retrieve user token for org ${organizationId}:`, err.message)
  }

  return null
}

/**
 * Obtains a Google Drive API access token.
 * If organizationId is provided and has a connected OAuth account, uses that.
 * Otherwise falls back to the server-wide Service Account credentials.
 */
export async function getDriveAccessToken(organizationId?: string): Promise<string | null> {
  if (organizationId) {
    const userToken = await getOrganizationUserToken(organizationId)
    if (userToken) return userToken
  }

  // Fallback to service account
  if (_cachedDriveToken && _cachedDriveToken.expiresAt > Date.now() + 60_000) {
    return _cachedDriveToken.token
  }

  const token = await requestOAuthToken([
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ])

  if (token) {
    _cachedDriveToken = { token, expiresAt: Date.now() + 3500 * 1000 }
  }
  return token
}

/**
 * Obtains a Google Sheets API access token.
 * If organizationId is provided and has a connected OAuth account, uses that.
 * Otherwise falls back to the server-wide Service Account credentials.
 */
export async function getSheetsAccessToken(organizationId?: string): Promise<string | null> {
  if (organizationId) {
    const userToken = await getOrganizationUserToken(organizationId)
    if (userToken) return userToken
  }

  // Fallback to service account
  if (_cachedSheetsToken && _cachedSheetsToken.expiresAt > Date.now() + 60_000) {
    return _cachedSheetsToken.token
  }

  const token = await requestOAuthToken(['https://www.googleapis.com/auth/spreadsheets'])

  if (token) {
    _cachedSheetsToken = { token, expiresAt: Date.now() + 3500 * 1000 }
  }
  return token
}

/**
 * Disconnects Google Drive from an organization.
 */
export async function disconnectGoogleDrive(organizationId: string): Promise<boolean> {
  _userTokenCache.delete(organizationId)
  const col = organizationAutomationSettingsCollection()
  await col.updateOne(
    { organizationId },
    {
      $unset: {
        googleRefreshToken: '',
        googleConnectedEmail: '',
        googleConnectedAt: '',
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  )
  return true
}

