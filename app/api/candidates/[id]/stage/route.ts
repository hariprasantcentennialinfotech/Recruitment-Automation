import { NextResponse } from 'next/server'
import { candidateProfilesCollection, activitiesCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { ObjectId } from 'mongodb'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Auth guard — derives organization from session
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const { id } = await params
    const body = await req.json()
    const { stage } = body

    if (!stage) {
      return NextResponse.json({ error: 'Stage is required' }, { status: 400 })
    }

    const collection = candidateProfilesCollection()

    // Fetch candidate and enforce org ownership — a user cannot move
    // a candidate that belongs to a different organization
    const candidate = await collection.findOne({ _id: new ObjectId(id) })

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (candidate.organization !== organization) {
      return NextResponse.json(
        { error: 'Forbidden. This candidate does not belong to your organization.' },
        { status: 403 }
      )
    }

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { stage, updatedAt: new Date() } }
    )

    // Log activity
    try {
      const actCol = activitiesCollection()
      await actCol.insertOne({
        organization,
        title: 'Candidate stage updated',
        detail: `${candidate.fullName} moved to ${stage}`,
        type: 'candidate_moved',
        createdAt: new Date(),
      } as any)
    } catch {}

    return NextResponse.json({
      success: true,
      candidate: { id, fullName: candidate.fullName, stage },
    })
  } catch (error: any) {
    console.error('Failed to update candidate stage:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update stage' },
      { status: 500 }
    )
  }
}
