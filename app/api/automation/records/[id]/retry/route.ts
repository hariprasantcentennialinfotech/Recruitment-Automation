import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { resumeProcessingRecordsCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { retryProcessingRecord } from '@/lib/google-drive-ingestion'

// POST /api/automation/records/[id]/retry — retry a failed resume processing record
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const { id } = await params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid record ID' }, { status: 400 })
    }

    const recordsCol = resumeProcessingRecordsCollection()
    const existing = await recordsCol.findOne({
      _id: new ObjectId(id),
      organizationId: organization,
    })

    if (!existing) {
      return NextResponse.json({ error: 'Processing record not found' }, { status: 404 })
    }

    const updated = await retryProcessingRecord(id, organization)

    return NextResponse.json({
      success: true,
      record: updated,
    })
  } catch (error: any) {
    console.error('Failed to retry resume processing:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retry processing record' },
      { status: 500 }
    )
  }
}
