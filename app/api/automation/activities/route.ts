import { NextResponse } from 'next/server'
import { resumeProcessingRecordsCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'

// GET /api/automation/activities — get organization-wide automation activities and statistics
export async function GET(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const recordsCol = resumeProcessingRecordsCollection()

    // Fetch recent 50 processing records
    const records = await recordsCol
      .find({ organizationId: organization })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray()

    // Extract all stage activities
    const allActivities: any[] = []
    let completedCount = 0
    let failedCount = 0
    let queuedCount = 0

    for (const rec of records) {
      if (rec.status === 'COMPLETED') completedCount++
      else if (rec.status === 'FAILED') failedCount++
      else queuedCount++

      if (Array.isArray(rec.stageActivities)) {
        for (const act of rec.stageActivities) {
          allActivities.push({
            recordId: rec._id.toString(),
            jobId: rec.jobId,
            jobTitle: rec.jobTitle,
            fileName: rec.fileName,
            stage: act.stage,
            message: act.message,
            timestamp: act.timestamp,
            status: rec.status,
          })
        }
      }
    }

    // Sort activities by timestamp descending
    allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      activities: allActivities.slice(0, 40),
      stats: {
        totalProcessed: records.length,
        completed: completedCount,
        failed: failedCount,
        queued: queuedCount,
      },
    })
  } catch (error: any) {
    console.error('Failed to get automation activities:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve automation activities' },
      { status: 500 }
    )
  }
}
