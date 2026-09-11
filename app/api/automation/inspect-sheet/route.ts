import { NextResponse } from 'next/server'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { extractGoogleId, getSheetColumns } from '@/lib/google-drive-hierarchy'

export const runtime = 'nodejs'

// POST /api/automation/inspect-sheet
// Body: { spreadsheetInput: string, sheetName?: string }
export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const body = await req.json()
    const rawInput = body.spreadsheetInput || body.spreadsheetId || ''
    const requestedSheet = body.sheetName || ''

    if (!rawInput || typeof rawInput !== 'string') {
      return NextResponse.json(
        { error: 'Please provide a valid Google Sheet ID or URL' },
        { status: 400 }
      )
    }

    const spreadsheetId = extractGoogleId(rawInput)
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Could not extract valid Google Spreadsheet ID' },
        { status: 400 }
      )
    }

    const sheetResult = await getSheetColumns(
      spreadsheetId,
      null,
      organization,
      requestedSheet || undefined
    )

    return NextResponse.json({
      success: true,
      spreadsheetId,
      sheetName: sheetResult.sheetName,
      availableSheets: sheetResult.availableSheets || [sheetResult.sheetName],
      columns: sheetResult.columns,
    })
  } catch (error: any) {
    console.error('[inspect-sheet] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to inspect Google Sheet' },
      { status: 500 }
    )
  }
}
