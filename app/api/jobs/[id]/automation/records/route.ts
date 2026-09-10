import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobsCollection, resumeProcessingRecordsCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'

// GET /api/jobs/[id]/automation/records — fetch all processing records for a job
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const { id } = await params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid Job ID' }, { status: 400 })
    }

    const jobCol = jobsCollection()
    const job = await jobCol.findOne({ _id: new ObjectId(id), organization })
    if (!job) {
      return NextResponse.json({ error: 'Job not found in this organization' }, { status: 404 })
    }

    const recordsCol = resumeProcessingRecordsCollection()
    const docs = await recordsCol
      .find({ jobId: id, organizationId: organization })
      .sort({ createdAt: -1 })
      .toArray()

    const records = docs.map((doc) => ({
      id: doc._id.toString(),
      organizationId: doc.organizationId,
      jobId: doc.jobId,
      jobTitle: doc.jobTitle || job.title,
      externalSource: doc.externalSource,
      sourceFileId: doc.sourceFileId,
      sourceFileUrl: doc.sourceFileUrl,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      fileHash: doc.fileHash,
      status: doc.status,
      error: doc.error,
      extractedTextSnippet: doc.extractedTextSnippet,
      candidateId: doc.candidateId,
      candidateName: doc.candidateName,
      normalizedEmail: doc.normalizedEmail,
      normalizedPhone: doc.normalizedPhone,
      matchScore: doc.matchScore,
      stageActivities: doc.stageActivities || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }))

    return NextResponse.json({ records })
  } catch (error: any) {
    console.error('Failed to get automation records:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve automation records' },
      { status: 500 }
    )
  }
}
