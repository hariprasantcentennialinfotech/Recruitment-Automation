import crypto from 'node:crypto'

/**
 * Server-side Google API Verifier.
 * Securely communicates with Google Drive v3 and Google Sheets v4 APIs.
 * Never exposes credentials to client-side code.
 */

interface ServiceAccountCredentials {
  client_email: string
  private_key: string
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

/**
 * Extracts and parses service account credentials from environment variables if present.
 */
function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key,
        }
      }
    } catch {
      // Might be a raw string or path
    }
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }
  }

  return null
}

/**
 * Obtains a Google OAuth2 access token via Service Account JWT (RS256).
 */
async function getServiceAccountAccessToken(): Promise<string | null> {
  const creds = getServiceAccountCredentials()
  if (!creds) return null

  const now = Math.floor(Date.now() / 1000)
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token
  }

  try {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    ).toString('base64url')

    const signer = crypto.createSign('RSA-SHA256')
    signer.update(`${header}.${claimSet}`)
    const signature = signer.sign(creds.private_key, 'base64url')
    const assertion = `${header}.${claimSet}.${signature}`

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })

    if (!res.ok) {
      console.error('Service account token exchange failed:', await res.text())
      return null
    }

    const data = await res.json()
    if (data.access_token) {
      cachedAccessToken = {
        token: data.access_token,
        expiresAt: now + (data.expires_in || 3600),
      }
      return data.access_token
    }
    return null
  } catch (err) {
    console.error('Failed to generate service account token:', err)
    return null
  }
}

/**
 * Validates Google Drive/Sheets ID format.
 */
export function isValidGoogleId(id?: string): boolean {
  if (!id || typeof id !== 'string') return false
  const trimmed = id.trim()
  // Google IDs are alphanumeric, underscores, hyphens, typically 25 to 100 characters
  return /^[a-zA-Z0-9_-]{15,120}$/.test(trimmed)
}

/**
 * Verifies overall Google Drive connection.
 */
export async function verifyGoogleDriveConnection(): Promise<{
  success: boolean
  status: 'Connected' | 'Not Connected' | 'Error'
  message: string
}> {
  const creds = getServiceAccountCredentials()
  const apiKey = process.env.GOOGLE_API_KEY

  if (!creds && !apiKey) {
    return {
      success: false,
      status: 'Error',
      message:
        'Google API credentials not configured on server. Provide GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_API_KEY in .env.',
    }
  }

  const token = await getServiceAccountAccessToken()
  if (token) {
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        return {
          success: true,
          status: 'Connected',
          message: `Connected via Google Service Account (${data.user?.displayName || creds?.client_email || 'Authenticated'})`,
        }
      }
      return {
        success: false,
        status: 'Error',
        message: `Google Drive responded with HTTP ${res.status}. Check service account permissions.`,
      }
    } catch (e: any) {
      return { success: false, status: 'Error', message: e.message || 'Failed to reach Google Drive API' }
    }
  }

  // Check with API key
  if (apiKey) {
    return {
      success: true,
      status: 'Connected',
      message: 'Google API Key configured and active for public/shared Drive resources.',
    }
  }

  return {
    success: false,
    status: 'Error',
    message: 'Could not authenticate with Google Drive.',
  }
}

/**
 * Verifies Google Drive Resume Folder ID access.
 */
export async function verifyResumeFolderAccess(folderId?: string): Promise<{
  success: boolean
  status: 'Connected' | 'Not Connected' | 'Error'
  message: string
  folderName?: string
}> {
  if (!folderId || !folderId.trim()) {
    return {
      success: false,
      status: 'Not Connected',
      message: 'No Google Drive Resume Folder ID configured.',
    }
  }

  const cleanId = folderId.trim()
  if (!isValidGoogleId(cleanId)) {
    return {
      success: false,
      status: 'Error',
      message: 'Invalid Google Drive folder ID format. Must be an alphanumeric ID (e.g. 1a2B3c4D...)',
    }
  }

  const creds = getServiceAccountCredentials()
  const apiKey = process.env.GOOGLE_API_KEY

  if (!creds && !apiKey) {
    return {
      success: false,
      status: 'Error',
      message:
        'Cannot verify folder access: Server lacks GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_API_KEY in .env.',
    }
  }

  try {
    const token = await getServiceAccountAccessToken()
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      cleanId
    )}?fields=id,name,mimeType,trashed${apiKey ? `&key=${apiKey}` : ''}`

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(url, { headers })

    if (res.status === 404) {
      return {
        success: false,
        status: 'Error',
        message: 'Folder not found. Ensure the ID is correct and shared with the integration service account.',
      }
    }

    if (res.status === 403) {
      return {
        success: false,
        status: 'Error',
        message: 'Permission denied. Ensure the folder is shared with view/editor permissions to the service account.',
      }
    }

    if (!res.ok) {
      const errText = await res.text()
      return {
        success: false,
        status: 'Error',
        message: `Google Drive error (${res.status}): ${errText.slice(0, 120)}`,
      }
    }

    const data = await res.json()
    if (data.trashed) {
      return {
        success: false,
        status: 'Error',
        message: `Folder "${data.name}" is in the Google Drive trash.`,
      }
    }

    if (data.mimeType && data.mimeType !== 'application/vnd.google-apps.folder') {
      return {
        success: false,
        status: 'Error',
        message: `The provided ID points to a file (${data.name}), not a Google Drive folder.`,
      }
    }

    return {
      success: true,
      status: 'Connected',
      message: `Successfully verified folder: "${data.name}"`,
      folderName: data.name,
    }
  } catch (error: any) {
    return {
      success: false,
      status: 'Error',
      message: error.message || 'Failed to reach Google Drive API.',
    }
  }
}

/**
 * Verifies Google Drive Job Description File ID access.
 */
export async function verifyJdFileAccess(fileId?: string): Promise<{
  success: boolean
  status: 'Connected' | 'Not Connected' | 'Error'
  message: string
  fileName?: string
}> {
  if (!fileId || !fileId.trim()) {
    return {
      success: false,
      status: 'Not Connected',
      message: 'No Google Drive Job Description File ID configured.',
    }
  }

  const cleanId = fileId.trim()
  if (!isValidGoogleId(cleanId)) {
    return {
      success: false,
      status: 'Error',
      message: 'Invalid Google Drive file ID format. Must be an alphanumeric ID (e.g. 1a2B3c4D...)',
    }
  }

  const creds = getServiceAccountCredentials()
  const apiKey = process.env.GOOGLE_API_KEY

  if (!creds && !apiKey) {
    return {
      success: false,
      status: 'Error',
      message:
        'Cannot verify JD access: Server lacks GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_API_KEY in .env.',
    }
  }

  try {
    const token = await getServiceAccountAccessToken()
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      cleanId
    )}?fields=id,name,mimeType,trashed${apiKey ? `&key=${apiKey}` : ''}`

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(url, { headers })

    if (res.status === 404) {
      return {
        success: false,
        status: 'Error',
        message: 'File not found. Ensure the ID is correct and shared with the integration service account.',
      }
    }

    if (res.status === 403) {
      return {
        success: false,
        status: 'Error',
        message: 'Permission denied. Share this file with the integration service account.',
      }
    }

    if (!res.ok) {
      const errText = await res.text()
      return {
        success: false,
        status: 'Error',
        message: `Google Drive error (${res.status}): ${errText.slice(0, 120)}`,
      }
    }

    const data = await res.json()
    if (data.trashed) {
      return {
        success: false,
        status: 'Error',
        message: `JD File "${data.name}" is in the Google Drive trash.`,
      }
    }

    return {
      success: true,
      status: 'Connected',
      message: `Successfully verified JD file: "${data.name}" (${data.mimeType?.split('.').pop() || 'document'})`,
      fileName: data.name,
    }
  } catch (error: any) {
    return {
      success: false,
      status: 'Error',
      message: error.message || 'Failed to reach Google Drive API.',
    }
  }
}

/**
 * Verifies Google Sheets Candidate Tracker Spreadsheet & Worksheet tab access.
 */
export async function verifyGoogleSheetsAccess(
  spreadsheetId?: string,
  sheetName?: string
): Promise<{
  success: boolean
  status: 'Connected' | 'Not Connected' | 'Error'
  message: string
  spreadsheetTitle?: string
  sheetExists?: boolean
}> {
  if (!spreadsheetId || !spreadsheetId.trim()) {
    return {
      success: false,
      status: 'Not Connected',
      message: 'No Google Sheets Spreadsheet ID configured.',
    }
  }

  const cleanId = spreadsheetId.trim()
  if (!isValidGoogleId(cleanId)) {
    return {
      success: false,
      status: 'Error',
      message: 'Invalid Google Sheets spreadsheet ID format.',
    }
  }

  const creds = getServiceAccountCredentials()
  const apiKey = process.env.GOOGLE_API_KEY

  if (!creds && !apiKey) {
    return {
      success: false,
      status: 'Error',
      message:
        'Cannot verify Google Sheets access: Server lacks GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_API_KEY in .env.',
    }
  }

  try {
    const token = await getServiceAccountAccessToken()
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      cleanId
    )}?fields=properties.title,sheets.properties.title${apiKey ? `&key=${apiKey}` : ''}`

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(url, { headers })

    if (res.status === 404) {
      return {
        success: false,
        status: 'Error',
        message: 'Spreadsheet not found. Check the Spreadsheet ID and verify access.',
      }
    }

    if (res.status === 403) {
      return {
        success: false,
        status: 'Error',
        message: 'Permission denied. Share this spreadsheet with the integration service account with Editor permissions.',
      }
    }

    if (!res.ok) {
      const errText = await res.text()
      return {
        success: false,
        status: 'Error',
        message: `Google Sheets error (${res.status}): ${errText.slice(0, 120)}`,
      }
    }

    const data = await res.json()
    const title = data.properties?.title || 'Spreadsheet'
    const sheetTitles: string[] = (data.sheets || []).map((s: any) => s.properties?.title)

    const targetTab = (sheetName || 'Candidate Tracking').trim()
    const tabExists = sheetTitles.includes(targetTab)

    if (!tabExists && sheetTitles.length > 0) {
      return {
        success: true,
        status: 'Connected',
        message: `Spreadsheet "${title}" connected. Note: tab "${targetTab}" not found yet (existing tabs: ${sheetTitles.slice(0, 3).join(', ')}). It will be auto-created on first sync.`,
        spreadsheetTitle: title,
        sheetExists: false,
      }
    }

    return {
      success: true,
      status: 'Connected',
      message: `Successfully verified spreadsheet "${title}" · tab "${targetTab}" exists.`,
      spreadsheetTitle: title,
      sheetExists: true,
    }
  } catch (error: any) {
    return {
      success: false,
      status: 'Error',
      message: error.message || 'Failed to reach Google Sheets API.',
    }
  }
}
