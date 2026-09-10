import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobsCollection, jobAutomationConfigCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { verifyGoogleSheetsAccess } from '@/lib/google-verifier'

// POST /api/jobs/[id]/automation/test-sheets — test Google Sheets Candidate Tracker spreadsheet & tab access
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

    let spreadsheetId = ''
    let sheetName = 'Candidate Tracking'

    try {
      const body = await req.json()
      spreadsheetId = body.spreadsheetId || body.googleSheetsSpreadsheetId || ''
      sheetName = body.sheetName || body.googleSheetsSheetName || 'Candidate Tracking'
    } catch {}

    // If not in body, read from existing config
    if (!spreadsheetId) {
      const autoCol = jobAutomationConfigCollection()
      const cfg = await autoCol.findOne({ jobId: id, organizationId: organization })
      spreadsheetId = cfg?.googleSheetsSpreadsheetId || ''
      if (cfg?.googleSheetsSheetName) sheetName = cfg.googleSheetsSheetName
    }

    const result = await verifyGoogleSheetsAccess(spreadsheetId, sheetName)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Failed to test Google Sheets access:', error)
    return NextResponse.json(
      {
        success: false,
        status: 'Error',
        message: error.message || 'Internal error while verifying Google Sheets access',
      },
      { status: 500 }
    )
  }
}
