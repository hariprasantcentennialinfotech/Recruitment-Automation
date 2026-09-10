/**
 * server-auth.ts
 * Server-side only helpers for authenticated, organization-scoped API routes.
 * Import ONLY in /app/api/** route handlers — never in client components.
 *
 * Key design principles:
 *  - Organization is ALWAYS derived from the session cookie (server-side).
 *  - The browser can NEVER supply or override organizationId.
 *  - Super-admins (role === 'superadmin') may pass ?tenantOrg=... to switch tenants.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { usersCollection } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export type UserRole = 'superadmin' | 'admin' | 'recruiter' | 'viewer'

export interface AuthenticatedUser {
  userId: string
  email: string
  fullName: string
  /** The organization slug/name this user belongs to (their company). */
  organization: string
  role: UserRole
  isSuperAdmin: boolean
}

// ─── Core Helper ─────────────────────────────────────────────────────────────

/**
 * Reads the session cookie, verifies it, and enriches the result with the
 * user's `role` and `organization` from MongoDB.
 * Returns null if unauthenticated.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await getSession()
  if (!session) return null

  try {
    const col = usersCollection()
    const user = await col.findOne({ _id: new ObjectId(session.userId) })
    if (!user) return null

    const organization: string =
      user.organization || user.company || session.company || ''
    const role: UserRole = (user.role as UserRole) || 'recruiter'

    return {
      userId: session.userId,
      email: session.email,
      fullName: session.fullName,
      organization,
      role,
      isSuperAdmin: role === 'superadmin',
    }
  } catch {
    // If DB is unreachable fall back to session-only data
    return {
      userId: session.userId,
      email: session.email,
      fullName: session.fullName,
      organization: session.organization || session.company || '',
      role: 'recruiter',
      isSuperAdmin: false,
    }
  }
}

// ─── Guard Helpers ────────────────────────────────────────────────────────────

/**
 * Returns the organization that should scope the current request.
 *
 * Logic:
 *  1. Super-admins may override via ?tenantOrg= query param (for admin tenant-switching).
 *  2. All other users are strictly scoped to their own organization from session.
 *
 * Returns null and a 401/403 NextResponse if the request should be rejected.
 */
export async function requireOrganization(
  request: Request
): Promise<{ user: AuthenticatedUser; organization: string } | { error: NextResponse }> {
  const user = await getAuthenticatedUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      ),
    }
  }

  if (!user.organization) {
    return {
      error: NextResponse.json(
        { error: 'Your account is not associated with an organization. Please contact support.' },
        { status: 403 }
      ),
    }
  }

  // Super-admins can switch tenants via query param
  if (user.isSuperAdmin) {
    const url = new URL(request.url)
    const tenantOrg = url.searchParams.get('tenantOrg')?.trim()
    if (tenantOrg) {
      // Verify tenant exists and is not suspended before allowing switch
      const clientCol = (await import('@/lib/mongodb')).clientsCollection()
      const tenant = await clientCol.findOne({ slug: tenantOrg })
      if (tenant && tenant.status !== 'Suspended') {
        return { user, organization: tenantOrg }
      }
    }
  }

  // Regular users – ensure their organization is not suspended
  if (user.role !== 'superadmin') {
    const clientCol = (await import('@/lib/mongodb')).clientsCollection()
    const orgDoc = await clientCol.findOne({ slug: user.organization })
    if (orgDoc?.status === 'Suspended') {
      return { error: NextResponse.json({ error: 'Workspace suspended', suspended: true }, { status: 403 }) }
    }
  }

  return { user, organization: user.organization }
}

/**
 * Requires the caller to be a super-admin.
 * Returns null and a 403 NextResponse otherwise.
 */
export async function requireSuperAdmin(): Promise<
  { user: AuthenticatedUser } | { error: NextResponse }
> {
  const user = await getAuthenticatedUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      ),
    }
  }

  if (!user.isSuperAdmin) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden. Super-admin access required.' },
        { status: 403 }
      ),
    }
  }

  return { user }
}

// ─── Type Guard ───────────────────────────────────────────────────────────────

/** Narrows the result of requireOrganization / requireSuperAdmin. */
export function isAuthError(
  result: { error: NextResponse } | object
): result is { error: NextResponse } {
  return 'error' in result
}
