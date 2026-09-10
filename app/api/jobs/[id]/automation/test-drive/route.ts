import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobsCollection, jobAutomationConfigCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { verifyGoogleDriveConnection, verifyResumeFolderAccess } from '@/lib/google-verifier'

// POST /api/jobs/[id]/automation/test-drive — test Google Drive & Resume Folder access
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

    let folderId = ''
    try {
      const body = await req.json()
      folderId = body.resumeFolderId || body.googleDriveResumeFolderId || ''
    } catch {}

    // If not sent in request body, retrieve from saved config
    if (!folderId) {
      const autoCol = jobAutomationConfigCollection()
      const cfg = await autoCol.findOne({ jobId: id, organizationId: organization })
      folderId = cfg?.googleDriveResumeFolderId || ''
    }

    // If a folderId was provided or saved, test folder access
    if (folderId && folderId.trim()) {
      const result = await verifyResumeFolderAccess(folderId)
      return NextResponse.json(result)
    }

    // Otherwise test root Google Drive connection
    const result = await verifyGoogleDriveConnection()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Failed to test Google Drive connection:', error)
    return NextResponse.json(
      {
        success: false,
        status: 'Error',
        message: error.message || 'Internal server error while testing Google Drive connection',
      },
      { status: 500 }
    )
  }
}
