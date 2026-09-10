import { inngest } from '../client'
import { ObjectId } from 'mongodb'
import {
  jobsCollection,
  jobAutomationConfigCollection,
  resumeProcessingRecordsCollection,
  candidateProfilesCollection,
  activitiesCollection,
} from '@/lib/mongodb'
import {
  extractPdfText,
  extractDocxText,
  computeFileHash,
  normalizeEmail,
  normalizePhone,
  getOrLoadJdAnalysis,
} from '@/lib/google-drive-ingestion'
import {
  extractCandidateFromResume,
  evaluateCandidateAgainstJd,
} from '@/lib/gemini-ai'
import { syncCandidateToGoogleSheets } from '@/lib/google-sheets-sync'
import { downloadDriveFile } from '@/lib/google-drive-sync'
import { CandidateDocument, ProcessingStatus } from '@/lib/types'

/**
 * Helper to push an activity message and transition status on the processing record.
 */
async function recordProgress(
  recordId: string,
  stage: string,
  message: string,
  status?: ProcessingStatus
) {
  const recordsCol = resumeProcessingRecordsCollection()
  const update: any = {
    $push: { stageActivities: { stage, message, timestamp: new Date() } },
    $set: { updatedAt: new Date() },
  }
  if (status) update.$set.status = status
  await recordsCol.updateOne({ _id: new ObjectId(recordId) }, update)
}

/**
 * Inngest function: processGoogleDriveResume
 * Triggered by event: 'google/drive.resume.detected'
 *
 * Implements Step Isolation:
 * - Step 1: verify-and-download (Status: DOWNLOADING)
 * - Step 2: extract-text (Status: EXTRACTING)
 * - Step 3: ai-extraction-and-evaluation (Status: AI_PROCESSING -> EVALUATING)
 * - Step 4: sheets-sync (Status: SHEETS_SYNCING)
 * - Step 5: finalize (Status: COMPLETED)
 *
 * If Sheets sync fails, Inngest only retries Step 4; Gemini AI is never re-run.
 */
export const processGoogleDriveResumeFunction = inngest.createFunction(
  {
    id: 'process-google-drive-resume',
    retries: 3,
    concurrency: {
      limit: 5, // Process up to 5 resumes concurrently per tenant
      key: 'event.data.organizationId',
    },
    triggers: [{ event: 'google/drive.resume.detected' }],
  },
  async ({ event, step }: any) => {
    const {
      processingRecordId,
      organizationId,
      jobId,
      googleDriveFileId,
      googleDriveFolderId,
      fileName,
    } = event.data

    console.log(
      JSON.stringify({
        event: 'drive.resume.processing.started',
        organizationId,
        jobId,
        processingRecordId,
        googleDriveFileId,
        fileName,
        timestamp: new Date().toISOString(),
      })
    )

    try {
      // ─────────────────────────────────────────────────────────────────────────
      // STEP 1: Verify Job & Download Resume File
      // ─────────────────────────────────────────────────────────────────────────
      const downloaded = await step.run('verify-and-download', async () => {
        const jobsCol = jobsCollection()
        const job = await jobsCol.findOne({
          _id: new ObjectId(jobId),
          organization: organizationId,
        })
        if (!job) {
          throw new Error(`Permanent: Job ${jobId} does not belong to organization ${organizationId}`)
        }

        const autoCol = jobAutomationConfigCollection()
        const autoConfig = await autoCol.findOne({ jobId, organizationId })
        if (!autoConfig || !autoConfig.enabled) {
          throw new Error(`Permanent: Automation is disabled for job ${jobId}`)
        }

        await recordProgress(
          processingRecordId,
          'Resume downloading',
          `Securely downloading "${fileName}" from Google Drive...`,
          'DOWNLOADING'
        )

        const fileBuffer = await downloadDriveFile(googleDriveFileId, organizationId)
        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error(`Permanent: Downloaded file "${fileName}" is empty`)
        }

        const fileHash = computeFileHash(fileBuffer)
        const base64Data = fileBuffer.toString('base64')

        await recordProgress(
          processingRecordId,
          'Resume downloaded',
          `Downloaded ${fileName} (${(fileBuffer.length / 1024).toFixed(1)} KB)`
        )

        return {
          fileHash,
          fileSize: fileBuffer.length,
          base64Data,
          jobTitle: job.title,
          jobSkills: job.skills || [],
          customWeights: autoConfig.scoringWeights,
          sheetsSpreadsheetId: autoConfig.googleSheetsSpreadsheetId || '',
          sheetsSheetName: autoConfig.googleSheetsSheetName || 'Candidate Tracking',
        }
      })

      // ─────────────────────────────────────────────────────────────────────────
      // STEP 2: Extract Resume Text (PDF / DOCX)
      // ─────────────────────────────────────────────────────────────────────────
      const textData = await step.run('extract-text', async () => {
        await recordProgress(
          processingRecordId,
          'Text extracted',
          `Extracting document text from ${fileName}...`,
          'EXTRACTING'
        )

        const fileBuffer = Buffer.from(downloaded.base64Data, 'base64')
        const isPdf = /\.pdf$/i.test(fileName)
        const isDocx = /\.docx$/i.test(fileName)

        if (!isPdf && !isDocx) {
          throw new Error(`Permanent: Unsupported file type for "${fileName}". Only PDF and DOCX are supported.`)
        }

        let extractedText = ''
        if (isPdf) {
          extractedText = await extractPdfText(fileBuffer)
        } else {
          extractedText = await extractDocxText(fileBuffer)
        }

        const recordsCol = resumeProcessingRecordsCollection()
        await recordsCol.updateOne(
          { _id: new ObjectId(processingRecordId) },
          {
            $set: {
              extractedTextSnippet: extractedText.slice(0, 400),
              fileHash: downloaded.fileHash,
              fileSize: downloaded.fileSize,
              updatedAt: new Date(),
            },
          }
        )

        console.log(
          JSON.stringify({
            event: 'resume.text.extracted',
            organizationId,
            jobId,
            processingRecordId,
            textLength: extractedText.length,
            timestamp: new Date().toISOString(),
          })
        )

        return { extractedText }
      })

      // ─────────────────────────────────────────────────────────────────────────
      // STEP 3: AI Candidate Extraction & Deterministic JD Evaluation
      // ─────────────────────────────────────────────────────────────────────────
      const evaluationData = await step.run('ai-extraction-and-eval', async () => {
        await recordProgress(
          processingRecordId,
          'AI processing',
          `Analyzing resume with Gemini AI and checking job requirements...`,
          'AI_PROCESSING'
        )

        // Load or download cached JD analysis
        const jdAnalysis = await getOrLoadJdAnalysis(
          jobId,
          organizationId,
          downloaded.jobTitle,
          downloaded.jobSkills
        )

        // Run Gemini AI extraction
        const candidateProfile = await extractCandidateFromResume(textData.extractedText, fileName)
        const normEmail = normalizeEmail(candidateProfile.email)
        const normPhone = normalizePhone(candidateProfile.phone)

        console.log(
          JSON.stringify({
            event: 'ai.extraction.completed',
            organizationId,
            jobId,
            candidateName: candidateProfile.candidate_name,
            email: normEmail,
            timestamp: new Date().toISOString(),
          })
        )

        await recordProgress(
          processingRecordId,
          'Candidate evaluation',
          `Evaluating profile match against ${downloaded.jobTitle}...`,
          'EVALUATING'
        )

        // Deterministic multi-factor scoring
        const comparison = evaluateCandidateAgainstJd({
          candidate: candidateProfile,
          jd: jdAnalysis,
          customWeights: downloaded.customWeights,
        })

        // Candidate Deduplication Check
        const candCol = candidateProfilesCollection()
        let existingCandidate: any = null

        if (normEmail) {
          existingCandidate = await candCol.findOne({
            organization: organizationId,
            email: { $regex: new RegExp(`^${normEmail}$`, 'i') },
          })
        }

        if (!existingCandidate && normPhone && normPhone.length >= 7) {
          existingCandidate = await candCol.findOne({
            organization: organizationId,
            phone: { $regex: new RegExp(normPhone.slice(-7)) },
          })
        }

        let candidateId = ''
        let candidateDoc: CandidateDocument

        if (existingCandidate) {
          candidateId = existingCandidate._id.toString()
          await candCol.updateOne(
            { _id: new ObjectId(candidateId) },
            {
              $set: {
                matchingSkills: comparison.matching_skills,
                missingSkills: comparison.missing_skills,
                matchScore: comparison.match_score,
                recommendation: comparison.recommendation,
                reasoningSummary: comparison.reasoning_summary,
                scoringBreakdown: comparison.scoring_breakdown,
                updatedAt: new Date(),
              },
            }
          )
          candidateDoc = (await candCol.findOne({ _id: new ObjectId(candidateId) })) as any

          console.log(
            JSON.stringify({
              event: 'candidate.updated',
              organizationId,
              jobId,
              candidateId,
              candidateName: candidateProfile.candidate_name,
              timestamp: new Date().toISOString(),
            })
          )
        } else {
          const newCandData = {
            organization: organizationId,
            fullName: candidateProfile.candidate_name,
            email: candidateProfile.email || '',
            phone: candidateProfile.phone || '',
            location: candidateProfile.location || 'Remote',
            currentTitle: candidateProfile.current_title || 'Software Professional',
            currentCompany: candidateProfile.current_company || '',
            totalExperience: candidateProfile.total_experience || '',
            summary: candidateProfile.current_title
              ? `${candidateProfile.current_title} with ${candidateProfile.total_experience || 'professional'} experience.`
              : textData.extractedText.slice(0, 400),
            skills: candidateProfile.skills,
            education: candidateProfile.education,
            certifications: candidateProfile.certifications,
            workAuthorization: candidateProfile.work_authorization,
            availability: candidateProfile.availability,
            stage: 'Sourcing' as const,
            sourceFile: fileName,
            sourceFileId: googleDriveFileId,
            resumeUrl: `https://drive.google.com/file/d/${googleDriveFileId}/view`,
            extractionProvider: process.env.GEMINI_API_KEY ? 'gemini' : 'structured-zod',
            rawText: textData.extractedText.slice(0, 50_000),
            jobId,
            jobTitle: downloaded.jobTitle,
            matchingSkills: comparison.matching_skills,
            missingSkills: comparison.missing_skills,
            matchScore: comparison.match_score,
            recommendation: comparison.recommendation,
            reasoningSummary: comparison.reasoning_summary,
            scoringBreakdown: comparison.scoring_breakdown,
            sheetsSyncStatus: 'PENDING' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          const candInsert = await candCol.insertOne(newCandData as any)
          candidateId = candInsert.insertedId.toString()
          candidateDoc = { id: candidateId, ...newCandData }

          const jobsCol = jobsCollection()
          await jobsCol.updateOne({ _id: new ObjectId(jobId) }, { $inc: { applicants: 1 } })

          console.log(
            JSON.stringify({
              event: 'candidate.created',
              organizationId,
              jobId,
              candidateId,
              candidateName: candidateProfile.candidate_name,
              timestamp: new Date().toISOString(),
            })
          )
        }

        // Update processing record with candidate and score
        const recordsCol = resumeProcessingRecordsCollection()
        await recordsCol.updateOne(
          { _id: new ObjectId(processingRecordId) },
          {
            $set: {
              candidateId,
              candidateName: candidateProfile.candidate_name,
              normalizedEmail: normEmail,
              normalizedPhone: normPhone,
              matchScore: comparison.match_score,
              updatedAt: new Date(),
            },
          }
        )

        return {
          candidateId,
          candidateName: candidateProfile.candidate_name,
          matchScore: comparison.match_score,
          recommendation: comparison.recommendation,
          isDuplicate: !!existingCandidate,
        }
      })

      // ─────────────────────────────────────────────────────────────────────────
      // STEP 4: Google Sheets Synchronization (Isolated Step)
      // ─────────────────────────────────────────────────────────────────────────
      await step.run('sheets-sync', async () => {
        if (!downloaded.sheetsSpreadsheetId) {
          await recordProgress(
            processingRecordId,
            'Candidate synced',
            'Candidate saved in hiring pipeline (Google Sheets not configured).'
          )
          return { skipped: true }
        }

        await recordProgress(
          processingRecordId,
          'Sheets syncing',
          `Synchronizing candidate to Google Sheets tab "${downloaded.sheetsSheetName}"...`,
          'SHEETS_SYNCING'
        )

        const candCol = candidateProfilesCollection()
        const candidateDoc = (await candCol.findOne({
          _id: new ObjectId(evaluationData.candidateId),
        })) as any

        if (!candidateDoc) return { skipped: true, error: 'Candidate profile missing' }

        const syncResult = await syncCandidateToGoogleSheets(candidateDoc, {
          spreadsheetId: downloaded.sheetsSpreadsheetId,
          sheetName: downloaded.sheetsSheetName,
          allowSimulation: false,
        })

        if (syncResult.success) {
          await recordProgress(
            processingRecordId,
            'Candidate synced',
            `Synchronized candidate to Google Sheets tab "${syncResult.sheetName}" (Row #${syncResult.rowId || 'updated'}).`
          )
        } else {
          await recordProgress(
            processingRecordId,
            'Candidate synced',
            `Sheets notice: ${syncResult.error || 'Pending credentials'}`
          )
        }

        return syncResult
      })

      // ─────────────────────────────────────────────────────────────────────────
      // STEP 5: Finalize Processing & Workspace Activity
      // ─────────────────────────────────────────────────────────────────────────
      await step.run('finalize', async () => {
        const recordsCol = resumeProcessingRecordsCollection()
        await recordsCol.updateOne(
          { _id: new ObjectId(processingRecordId) },
          {
            $set: {
              status: 'COMPLETED',
              updatedAt: new Date(),
            },
            $push: {
              stageActivities: {
                stage: 'Completed',
                message: `Automated recruitment processing finished successfully (${evaluationData.matchScore}% match).`,
                timestamp: new Date(),
              },
            } as any,
          }
        )

        const actCol = activitiesCollection()
        await actCol.insertOne({
          organization: organizationId,
          title: evaluationData.isDuplicate
            ? 'Candidate profile updated via Drive'
            : 'New candidate processed from Drive',
          detail: `${evaluationData.candidateName} · ${downloaded.jobTitle} (${evaluationData.matchScore}% match)`,
          type: 'resume_uploaded',
          createdAt: new Date(),
        } as any)

        console.log(
          JSON.stringify({
            event: 'drive.resume.processing.completed',
            organizationId,
            jobId,
            processingRecordId,
            candidateId: evaluationData.candidateId,
            candidateName: evaluationData.candidateName,
            timestamp: new Date().toISOString(),
          })
        )
      })

      return { success: true, candidateId: evaluationData.candidateId }
    } catch (err: any) {
      console.error(
        JSON.stringify({
          event: 'drive.resume.processing.failed',
          organizationId,
          jobId,
          processingRecordId,
          error: err.message,
          timestamp: new Date().toISOString(),
        })
      )

      // Mark record as FAILED in MongoDB
      try {
        const recordsCol = resumeProcessingRecordsCollection()
        await recordsCol.updateOne(
          { _id: new ObjectId(processingRecordId) },
          {
            $set: {
              status: 'FAILED',
              error: err.message || 'Processing failed',
              updatedAt: new Date(),
            },
            $push: {
              stageActivities: {
                stage: 'Failed',
                message: `Error: ${err.message || 'Processing failed'}`,
                timestamp: new Date(),
              },
            } as any,
          }
        )
      } catch {}

      // Permanent failures (marked with 'Permanent:') should not trigger infinite retries
      if (err.message && err.message.startsWith('Permanent:')) {
        console.warn(`[process-resume] Permanent failure encountered. Halting retries: ${err.message}`)
        return { success: false, permanentError: err.message }
      }

      // Re-throw transient errors for Inngest to retry
      throw err
    }
  }
)
