import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { clientsCollection, jobsCollection, candidateProfilesCollection } from '@/lib/mongodb'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'

// GET /api/admin/clients/[id] — fetch single client with live counts
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

    // Live counts from the actual collections
    const jobsCol = jobsCollection()
    const candidatesCol = candidateProfilesCollection()

    const [totalJobs, openJobs, totalCandidates] = await Promise.all([
      jobsCol.countDocuments({ organization: client.slug }),
      jobsCol.countDocuments({ organization: client.slug, status: 'Open' }),
      candidatesCol.countDocuments({ organization: client.slug }),
    ])

    return NextResponse.json({
      client: {
        id: client._id.toString(),
        name: client.name,
        slug: client.slug,
        contactEmail: client.contactEmail,
        contactPerson: client.contactPerson || '',
        domain: client.domain || '',
        plan: client.plan || 'Growth',
        status: client.status || 'Active',
        monthlyFee: client.monthlyFee || 499,
        brandColor: client.brandColor || '#2563eb',
        whiteLabelName: client.whiteLabelName || `${client.name} Talent Portal`,
        maxJobs: client.maxJobs || 20,
        maxCandidates: client.maxCandidates || 500,
        activeJobsCount: openJobs,
        totalJobsCount: totalJobs,
        candidatesCount: totalCandidates,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      },
    })
  } catch (error: any) {
    console.error('Failed to get client:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch client' }, { status: 500 })
  }
}

// PATCH /api/admin/clients/[id] — update client
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const { id } = await params
    const body = await req.json()

    // Strip protected fields
    const { _id, slug: _slug, createdAt: _createdAt, ...updates } = body

    // If plan changed, recalculate monthlyFee
    if (updates.plan) {
      const planFeeMap: Record<string, number> = { Starter: 299, Growth: 799, Enterprise: 1499 }
      updates.monthlyFee = planFeeMap[updates.plan] || 499
      // Auto-adjust quotas if not explicitly set
      if (!updates.maxJobs) {
        const planJobMap: Record<string, number> = { Starter: 5, Growth: 20, Enterprise: 50 }
        updates.maxJobs = planJobMap[updates.plan] || 20
      }
      if (!updates.maxCandidates) {
        const planCandMap: Record<string, number> = { Starter: 100, Growth: 500, Enterprise: 2000 }
        updates.maxCandidates = planCandMap[updates.plan] || 500
      }
    }

    const col = clientsCollection()
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update client' }, { status: 500 })
  }
}

// DELETE /api/admin/clients/[id] — remove client
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const { id } = await params
    const col = clientsCollection()
    const result = await col.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete client' }, { status: 500 })
  }
}
