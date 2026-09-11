import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await getSession(req)
  if (!session) {
    return NextResponse.json({ authenticated: false, isSuperAdmin: false })
  }

  const isSuperAdmin = session.role === 'superadmin' || session.userId === 'admin_root'
  return NextResponse.json({
    authenticated: true,
    isSuperAdmin,
    user: session,
  })
}
