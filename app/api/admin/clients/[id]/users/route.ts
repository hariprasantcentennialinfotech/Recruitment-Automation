import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { clientsCollection, usersCollection } from '@/lib/mongodb'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'

// GET /api/admin/clients/[id]/users
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const { id } = await params

    const col = clientsCollection()
    const client = await col.findOne({ _id: new ObjectId(id) })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const usersCol = usersCollection()
    const users = await usersCol
      .find({ organization: client.slug })
      .sort({ createdAt: -1 })
      .toArray()

    const formatted = users.map((u) => ({
      id: u._id.toString(),
      fullName: u.fullName || u.name || 'User',
      email: u.email,
      role: u.role || 'recruiter',
      createdAt: u.createdAt,
    }))

    return NextResponse.json({ users: formatted })
  } catch (error: any) {
    console.error('[admin/users] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
