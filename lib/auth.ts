import crypto from 'node:crypto'

const AUTH_COOKIE_NAME = 'centennial_auth_token'
const SECRET_KEY = process.env.AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'centennial-connect-secret-fallback-key-2026'

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `${salt}:${derivedKey.toString('hex')}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':')
    if (!salt || !hash) return false
    const derivedKey = crypto.scryptSync(password, salt, 64)
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey)
  } catch {
    return false
  }
}

export interface SessionPayload {
  userId: string
  email: string
  fullName: string
  company?: string
  /** Organization slug — same as `company` but explicit for multi-tenant lookups. */
  organization?: string
  image?: string
  provider: 'credentials' | 'google'
  /** User role within their organization. */
  role?: 'superadmin' | 'admin' | 'recruiter' | 'viewer'
}

export function createSessionToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url')
  return `${data}.${signature}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [data, signature] = token.split('.')
    if (!data || !signature) return null
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('base64url')
    if (signature !== expectedSignature) return null
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    return parsed as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
    if (!token) return null
    return verifySessionToken(token)
  } catch {
    return null
  }
}

export function getBaseUrl(request?: Request): string {
  if (request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
    if (host) {
      return `${proto}://${host}`
    }
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export { AUTH_COOKIE_NAME }
