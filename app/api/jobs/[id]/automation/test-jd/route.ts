import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobsCollection, jobAutomationConfigCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { verifyJdFileAccess } from '@/lib/google-verifier'

// POST /api/jobs/[id]/automation/test-jd — test Google Drive Job Description File access
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

    let jdFileId = ''
    try {
      const body = await req.json()
      jdFileId = body.jdFileId || body.googleDriveJdFileId || ''
    } catch {}

    // If not in body, read from existing config
    if (!jdFileId) {
      const autoCol = jobAutomationConfigCollection()
      const cfg = await autoCol.findOne({ jobId: id, organizationId: organization })
      jdFileId = cfg?.googleDriveJdFileId || ''
    }

    const result = await verifyJdFileAccess(jdFileId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Failed to test JD file access:', error)
    return NextResponse.json(
      {
        success: false,
        status: 'Error',
        message: error.message || 'Internal error while verifying JD file access',
      },
      { status: 500 }
    )
  }
}
