import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobAutomationConfigCollection } from '@/lib/mongodb'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'
import {
  verifyResumeFolderAccess,
  verifyJdFileAccess,
  verifyGoogleSheetsAccess,
} from '@/lib/google-verifier'

/**
 * POST /api/admin/automation/[configId]/test
 *
 * Performs a lightweight connectivity test against the configured Google
 * resources for a given job automation config.
 *
 * Returns per-resource status (CONNECTED / NOT_CONFIGURED / ERROR).
 * NEVER exposes OAuth tokens, refresh tokens, or any credentials.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const { configId } = await params

    const configCol = jobAutomationConfigCollection()
    const config = await configCol.findOne({ _id: new ObjectId(configId) })

    if (!config) {
      return NextResponse.json({ error: 'Automation config not found' }, { status: 404 })
    }

    // Run all three checks in parallel
    const [folderResult, jdResult, sheetsResult] = await Promise.all([
      verifyResumeFolderAccess(config.googleDriveResumeFolderId),
      verifyJdFileAccess(config.googleDriveJdFileId),
      verifyGoogleSheetsAccess(config.googleSheetsSpreadsheetId, config.googleSheetsSheetName),
    ])

    const toStatus = (r: { success: boolean; status: string }) =>
      !r ? 'NOT_CONFIGURED' : r.success ? 'CONNECTED' : 'ERROR'

    const results = {
      resumeFolder: {
        status: toStatus(folderResult),
        message: folderResult.message,
      },
      jdFile: {
        status: toStatus(jdResult),
        message: jdResult.message,
      },
      tracker: {
        status: toStatus(sheetsResult),
        message: sheetsResult.message,
      },
    }

    // Stamp last-tested timestamp
    await configCol.updateOne(
      { _id: new ObjectId(configId) },
      { $set: { lastTestedAt: new Date(), updatedAt: new Date() } }
    )

    return NextResponse.json({ configId, results, testedAt: new Date().toISOString() })
  } catch (error: any) {
    console.error('[admin/automation/test] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Test failed' },
      { status: 500 }
    )
  }
}
