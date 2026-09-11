import { NextResponse } from 'next/server'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import {
  jobAutomationConfigCollection,
  jobsCollection,
  resumeProcessingRecordsCollection,
  organizationAutomationSettingsCollection,
  activitiesCollection,
} from '@/lib/mongodb'
import { processResumeBuffer } from '@/lib/google-drive-ingestion'
import { downloadDriveFile, scanFolderDirectly } from '@/lib/google-drive-sync'
import { ObjectId } from 'mongodb'

export const runtime = 'nodejs'

// POST /api/automation/start-workflow — run end-to-end resume ingestion across all jobs
export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    let body: any = {}
    try {
      body = await req.json()
    } catch {}

    const forceReprocess = Boolean(body?.forceReprocess)
    const targetJobId = body?.jobId

    const autoCol = jobAutomationConfigCollection()
    const jobsCol = jobsCollection()
    const recordsCol = resumeProcessingRecordsCollection()
    const orgSettingsCol = organizationAutomationSettingsCollection()
    const actCol = activitiesCollection()

    const configFilter: any = {
      organizationId: organization,
      enabled: true,
      googleDriveResumeFolderId: { $exists: true, $ne: '' },
    }
    if (targetJobId) {
      configFilter.jobId = targetJobId
    }

    const activeConfigs = await autoCol.find(configFilter).toArray()

    if (activeConfigs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active job automation configurations found. Connect your Google Drive folder first.',
        jobsChecked: 0,
        candidatesProcessed: 0,
        results: [],
      })
    }

    interface FileExecutionLog {
      fileName: string
      jobId: string
      jobTitle: string
      status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
      candidateName?: string | null
      matchScore?: number | null
      message: string
      timestamp: string
    }

    const fileLogs: FileExecutionLog[] = []
    const results: Array<{
      jobId: string
      jobTitle: string
      resumesDetected: number
      resumesProcessed: number
      errors: string[]
    }> = []

    let totalProcessed = 0

    for (const config of activeConfigs) {
      const job = await jobsCol.findOne({ _id: new ObjectId(config.jobId) })
      const jobTitle = job?.title || 'Job'
      const folderId = config.googleDriveResumeFolderId
      const errors: string[] = []
      let processedCount = 0

      if (folderId) {
        try {
          const files = await scanFolderDirectly(folderId, organization)
          const supportedFiles = files.filter(
            (f) =>
              f.name.toLowerCase().endsWith('.pdf') ||
              f.name.toLowerCase().endsWith('.docx')
          )

          for (const file of supportedFiles) {
            // Check idempotency: skip if already COMPLETED, UNLESS:
            // 1. forceReprocess is true
            // 2. Candidate name is placeholder "Candidate" or section heading
            // 3. Contact information is missing
            const existingRecord = await recordsCol.findOne({
              organizationId: organization,
              jobId: config.jobId,
              sourceFileId: file.id,
            })

            const isGenericName =
              !existingRecord?.candidateName ||
              existingRecord.candidateName.toLowerCase() === 'candidate' ||
              existingRecord.candidateName.toLowerCase().includes('competenc') ||
              existingRecord.candidateName.toLowerCase().includes('summary') ||
              existingRecord.candidateName.toLowerCase().includes('resume')

            const isMissingContact = !existingRecord?.normalizedEmail && !existingRecord?.normalizedPhone

            if (
              !forceReprocess &&
              existingRecord &&
              existingRecord.status === 'COMPLETED' &&
              !isGenericName &&
              !isMissingContact
            ) {
              fileLogs.push({
                fileName: file.name,
                jobId: config.jobId,
                jobTitle,
                status: 'SKIPPED',
                candidateName: existingRecord.candidateName || null,
                matchScore: existingRecord.matchScore || null,
                message: `Already verified & processed (${existingRecord.candidateName})`,
                timestamp: new Date().toISOString(),
              })
              continue
            }

            try {
              const fileBuffer = await downloadDriveFile(file.id, organization)
              const recordResult: any = await processResumeBuffer({
                fileBuffer,
                fileName: file.name,
                jobId: config.jobId,
                organizationId: organization,
                sourceFileId: file.id,
                sourceFileUrl: `https://drive.google.com/file/d/${file.id}/view`,
                forceReprocess,
              })

              if (recordResult?.status === 'FAILED') {
                const failMsg = recordResult.error || 'Failed to extract text or evaluate resume'
                errors.push(`${file.name}: ${failMsg}`)
                fileLogs.push({
                  fileName: file.name,
                  jobId: config.jobId,
                  jobTitle,
                  status: 'FAILED',
                  message: failMsg,
                  timestamp: new Date().toISOString(),
                })
              } else {
                processedCount++
                const candName = recordResult?.candidateName || 'Candidate'
                const score = recordResult?.matchScore ?? 0
                fileLogs.push({
                  fileName: file.name,
                  jobId: config.jobId,
                  jobTitle,
                  status: 'SUCCESS',
                  candidateName: candName,
                  matchScore: score,
                  message: `Candidate "${candName}" extracted (${score}% match)`,
                  timestamp: new Date().toISOString(),
                })
              }
            } catch (err: any) {
              const errMsg = err.message || 'File processing error'
              errors.push(`${file.name}: ${errMsg}`)
              fileLogs.push({
                fileName: file.name,
                jobId: config.jobId,
                jobTitle,
                status: 'FAILED',
                message: errMsg,
                timestamp: new Date().toISOString(),
              })
            }
          }

          results.push({
            jobId: config.jobId,
            jobTitle,
            resumesDetected: supportedFiles.length,
            resumesProcessed: processedCount,
            errors,
          })
          totalProcessed += processedCount
        } catch (err: any) {
          results.push({
            jobId: config.jobId,
            jobTitle,
            resumesDetected: 0,
            resumesProcessed: 0,
            errors: [err.message || 'Failed to scan folder'],
          })
        }
      } else {
        // Fallback or simulated mode
        results.push({
          jobId: config.jobId,
          jobTitle,
          resumesDetected: 0,
          resumesProcessed: 0,
          errors: ['Google Drive resume folder not configured.'],
        })
      }
    }

    // Update organization settings last run
    await orgSettingsCol.updateOne(
      { organizationId: organization },
      {
        $set: {
          lastWorkflowRunAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    // Record activity
    await actCol.insertOne({
      organization,
      title: 'Workflow Execution Completed',
      detail: `Processed ${totalProcessed} resume(s) across ${activeConfigs.length} job(s).`,
      type: 'system',
      createdAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      message: `Workflow completed: ${totalProcessed} resume(s) processed across ${activeConfigs.length} configured job(s).`,
      jobsChecked: activeConfigs.length,
      candidatesProcessed: totalProcessed,
      results,
      logs: fileLogs,
    })
  } catch (error: any) {
    console.error('[start-workflow] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Workflow execution failed' },
      { status: 500 }
    )
  }
}
