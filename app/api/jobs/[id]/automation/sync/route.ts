import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobsCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { scanAndIngestJobDriveFolder } from '@/lib/google-drive-ingestion'

// POST /api/jobs/[id]/automation/sync — trigger Google Drive resume folder scan & ingestion
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
      return NextResponse.json({ error: 'Invalid Job ID' }, { status: 400 })
    }

    const jobCol = jobsCollection()
    const job = await jobCol.findOne({ _id: new ObjectId(id), organization })
    if (!job) {
      return NextResponse.json({ error: 'Job not found in this organization' }, { status: 404 })
    }

    const result = await scanAndIngestJobDriveFolder(id, organization)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Drive resume sync failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync Google Drive resumes' },
      { status: 500 }
    )
  }
}
