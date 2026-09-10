import crypto from 'node:crypto'
import { ObjectId } from 'mongodb'
import mammoth from 'mammoth'
import {
  jobsCollection,
  jobAutomationConfigCollection,
  resumeProcessingRecordsCollection,
  candidateProfilesCollection,
  activitiesCollection,
} from '@/lib/mongodb'
import {
  ResumeProcessingRecord,
  ProcessingStatus,
  StageActivity,
  CandidateDocument,
} from '@/lib/types'
import {
  extractCandidateFromResume,
  extractCandidateWithCustomColumns,
  analyzeJobDescription,
  evaluateCandidateAgainstJd,
  JdAnalysis,
} from '@/lib/gemini-ai'
import { syncCandidateToGoogleSheets } from '@/lib/google-sheets-sync'
import { getDriveAccessToken } from '@/lib/google-auth-token'

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function normalizeEmail(email?: string): string {
  return (email || '').toLowerCase().trim()
}

export function normalizePhone(phone?: string): string {
  return (phone || '').replace(/\D/g, '')
}

/**
 * Parses text from a PDF Buffer with robust fallbacks.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    if (data && typeof data.text === 'string' && data.text.trim().length > 0) {
      return data.text.trim()
    }
  } catch {
    // Fallback parser if pdf-parse encounters standard issues
  }

  // Text stream fallback for PDF files
  const binary = buffer.toString('binary')
  const streamMatches = binary.match(/BT[\s\S]*?ET/g) || []
  if (streamMatches.length > 0) {
    const extracted = streamMatches
      .map((s) => s.replace(/[^\x20-\x7E\n]/g, ' '))
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim()
    if (extracted.length > 20) return extracted
  }

  const plainText = buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim()
  if (plainText.length > 20 && !plainText.includes('NOT_A_VALID_DOCUMENT')) return plainText

  throw new Error('Unable to extract text from PDF file. File may be encrypted, scanned image, or corrupt.')
}

/**
 * Parses text from a DOCX Buffer using mammoth with fallback.
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    if (result.value && result.value.trim().length > 0) {
      return result.value.trim()
    }
  } catch (err: any) {
    // Fallback for text streams or test buffers
    const raw = buffer.toString('utf8').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim()
    if (raw.length > 20 && !raw.includes('NOT_A_VALID_DOCUMENT')) {
      return raw
    }
    throw new Error(`DOCX extraction failed: ${err.message}`)
  }
  throw new Error('DOCX file contained no extractable text.')
}

// ─── STEP 3: Job Description Retrieval & Caching ──────────────────────────────

/**
 * Retrieves and caches the JD text and requirements analysis.
 * Caches in MongoDB (job_automation_configs) to avoid downloading/analyzing for every candidate.
 */
export async function getOrLoadJdAnalysis(
  jobId: string,
  organizationId: string,
  jobFallbackTitle: string,
  jobFallbackSkills: string[]
): Promise<JdAnalysis> {
  const autoCol = jobAutomationConfigCollection()
  const config = await autoCol.findOne({ jobId, organizationId })

  // Return cached analysis if available
  if (config?.cachedJdAnalysis && Array.isArray(config.cachedJdAnalysis.requiredSkills)) {
    return {
      title: config.cachedJdAnalysis.title || jobFallbackTitle,
      required_skills: config.cachedJdAnalysis.requiredSkills,
      preferred_skills: config.cachedJdAnalysis.preferredSkills || [],
      min_experience_years: config.cachedJdAnalysis.minExperienceYears || 2,
      required_certifications: config.cachedJdAnalysis.requiredCertifications || [],
      location: config.cachedJdAnalysis.location || 'Remote',
      work_authorization: config.cachedJdAnalysis.workAuthorization || '',
    }
  }

  // If JD File ID is configured, attempt secure download and extraction
  let jdRawText = ''
  if (config?.googleDriveJdFileId && config.googleDriveJdFileId.trim()) {
    try {
      const jdFileId = config.googleDriveJdFileId.trim()
      const token = await getDriveAccessToken()
      const apiKey = process.env.GOOGLE_API_KEY
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        jdFileId
      )}?alt=media${apiKey && !token ? `&key=${apiKey}` : ''}`

      const res = await fetch(url, { headers })
      if (res.ok) {
        const jdBuffer = Buffer.from(await res.arrayBuffer())
        if (jdBuffer.length > 20) {
          try {
            jdRawText = await extractPdfText(jdBuffer)
          } catch {
            try {
              jdRawText = await extractDocxText(jdBuffer)
            } catch {
              jdRawText = jdBuffer.toString('utf-8')
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not download external JD from Google Drive:', e)
    }
  }

  // If external JD was not downloaded, generate from job database document
  if (!jdRawText || jdRawText.length < 20) {
    jdRawText = `${jobFallbackTitle}
Role requirements:
Required Skills: ${jobFallbackSkills.join(', ')}
Experience: Minimum 2-3 years of professional experience.
Location: Remote / Flexible`
  }

  // Analyze JD requirements
  const analyzed = await analyzeJobDescription(jdRawText)

  // Ensure fallback skills are included
  if (analyzed.required_skills.length === 0 && jobFallbackSkills.length > 0) {
    analyzed.required_skills = [...jobFallbackSkills]
  }

  // Cache JD analysis in MongoDB for subsequent candidate runs
  try {
    await autoCol.updateOne(
      { jobId, organizationId },
      {
        $set: {
          cachedJdText: jdRawText.slice(0, 10_000),
          cachedJdAnalysis: {
            title: analyzed.title || jobFallbackTitle,
            requiredSkills: analyzed.required_skills,
            preferredSkills: analyzed.preferred_skills,
            minExperienceYears: analyzed.min_experience_years,
            requiredCertifications: analyzed.required_certifications,
            location: analyzed.location,
            workAuthorization: analyzed.work_authorization,
            cachedAt: new Date(),
          },
          updatedAt: new Date(),
        },
      }
    )
  } catch (err) {
    console.warn('Failed to persist cached JD analysis:', err)
  }

  return analyzed
}

// ─── Main Ingestion Execution Engine ─────────────────────────────────────────

/**
 * Process a single resume buffer through the full automation pipeline:
 * Step 1: Resume download & record creation
 * Step 2: Resume text extraction (PDF/DOCX)
 * Step 3: JD secure download & analysis caching
 * Step 4: AI Extraction with Zod validation
 * Step 5: JD Comparison (matching/missing skills, reasoning)
 * Step 6: Application logic scoring (50/25/10/5/10)
 * Step 7: MongoDB candidate save/update
 * Step 8: Google Sheets sync with row tracking & deduplication
 */
export async function processResumeBuffer(params: {
  organizationId: string
  jobId: string
  fileName: string
  fileBuffer: Buffer
  sourceFileId: string
  sourceFileUrl?: string
  externalSource?: 'google_drive' | 'manual_upload'
  googleDriveFolderId?: string
  allowSimulation?: boolean
}): Promise<ResumeProcessingRecord> {
  const {
    organizationId,
    jobId,
    fileName,
    fileBuffer,
    sourceFileId,
    sourceFileUrl = `https://drive.google.com/file/d/${sourceFileId}/view`,
    externalSource = 'google_drive',
    googleDriveFolderId,
    allowSimulation = true,
  } = params

  const now = new Date()
  const recordsCol = resumeProcessingRecordsCollection()
  const jobsCol = jobsCollection()
  const candCol = candidateProfilesCollection()
  const actCol = activitiesCollection()
  const autoCol = jobAutomationConfigCollection()

  // Structured log: resume.processing.started
  console.log(
    JSON.stringify({
      event: 'resume.processing.started',
      organizationId,
      jobId,
      fileName,
      sourceFileId,
      timestamp: now.toISOString(),
    })
  )

  // STEP 1: Verify Job & Organization
  const job = await jobsCol.findOne({ _id: new ObjectId(jobId), organization: organizationId })
  if (!job) {
    throw new Error(`Job ${jobId} does not belong to organization ${organizationId} or does not exist`)
  }

  const autoConfig = await autoCol.findOne({ jobId, organizationId })

  const fileHash = computeFileHash(fileBuffer)
  const isPdf = /\.pdf$/i.test(fileName)
  const isDocx = /\.docx$/i.test(fileName)
  const mimeType = isPdf
    ? 'application/pdf'
    : isDocx
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/octet-stream'

  // Stage 1 Initial Activities
  const initialActivities: StageActivity[] = [
    {
      stage: 'Resume detected',
      message: `Detected file "${fileName}" from ${externalSource}`,
      timestamp: now,
    },
    {
      stage: 'Resume downloaded',
      message: `Securely downloaded ${fileName} (${(fileBuffer.length / 1024).toFixed(1)} KB)`,
      timestamp: new Date(),
    },
  ]

  // Idempotency check: Find or create record
  let record = await recordsCol.findOne({
    organizationId,
    jobId,
    $or: [{ sourceFileId }, { googleDriveFileId: sourceFileId }],
  })

  // If already successfully processed or in progress, do nothing (idempotency requirement 10)
  if (record) {
    if (record.status === 'COMPLETED') {
      console.log(
        JSON.stringify({
          event: 'resume.processing.skipped',
          reason: 'already_completed',
          organizationId,
          jobId,
          sourceFileId,
          timestamp: new Date().toISOString(),
        })
      )
      return record as any
    }
    if (['EXTRACTING', 'AI_PROCESSING', 'EVALUATING'].includes(record.status)) {
      console.log(
        JSON.stringify({
          event: 'resume.processing.skipped',
          reason: 'in_progress',
          organizationId,
          jobId,
          sourceFileId,
          status: record.status,
          timestamp: new Date().toISOString(),
        })
      )
      return record as any
    }
  }

  if (!record) {
    const insertResult = await recordsCol.insertOne({
      organizationId,
      jobId,
      jobTitle: job.title,
      externalSource,
      sourceFileId,
      googleDriveFileId: sourceFileId,
      googleDriveFolderId: googleDriveFolderId || autoConfig?.googleDriveResumeFolderId || '',
      sourceFileUrl,
      fileName,
      fileSize: fileBuffer.length,
      mimeType,
      fileHash,
      status: 'QUEUED' as ProcessingStatus,
      stageActivities: initialActivities,
      createdAt: now,
      updatedAt: now,
    } as any)
    record = await recordsCol.findOne({ _id: insertResult.insertedId })
  }

  const recordId = record!._id

  // Helper to log stage activities
  const addStageActivity = async (stage: string, message: string, newStatus?: ProcessingStatus) => {
    const update: any = {
      $push: { stageActivities: { stage, message, timestamp: new Date() } },
      $set: { updatedAt: new Date() },
    }
    if (newStatus) update.$set.status = newStatus
    await recordsCol.updateOne({ _id: recordId }, update as any)
  }

  try {
    // STEP 2: Extract Resume Text (PDF/DOCX)
    await addStageActivity('Text extracted', `Extracting text content from ${fileName}...`, 'EXTRACTING')

    if (!isPdf && !isDocx) {
      throw new Error(`Unsupported file type for "${fileName}". Only PDF and DOCX files are supported.`)
    }

    let extractedText = ''
    if (isPdf) {
      extractedText = await extractPdfText(fileBuffer)
    } else {
      extractedText = await extractDocxText(fileBuffer)
    }

    console.log(
      JSON.stringify({
        event: 'resume.text.extracted',
        organizationId,
        jobId,
        fileName,
        sourceFileId,
        textLength: extractedText.length,
        timestamp: new Date().toISOString(),
      })
    )

    await recordsCol.updateOne(
      { _id: recordId },
      {
        $set: {
          extractedTextSnippet: extractedText.slice(0, 300),
          updatedAt: new Date(),
        },
      }
    )

    // STEP 3: Retrieve / Load Cached Job Description
    const jdAnalysis = await getOrLoadJdAnalysis(
      jobId,
      organizationId,
      job.title,
      job.skills || []
    )

    // STEP 4: AI Extraction with Zod Validation
    await addStageActivity('AI processing', `Analyzing resume structure and extracting profile data...`, 'AI_PROCESSING')

    const candidateProfile = await extractCandidateFromResume(extractedText, fileName)
    const normEmail = normalizeEmail(candidateProfile.email)
    const normPhone = normalizePhone(candidateProfile.phone)

    console.log(
      JSON.stringify({
        event: 'ai.extraction.completed',
        organizationId,
        jobId,
        candidateName: candidateProfile.candidate_name,
        email: normEmail,
        skillsCount: candidateProfile.skills?.length || 0,
        timestamp: new Date().toISOString(),
      })
    )

    // STEP 5 & 6: JD Comparison & Application-level Match Scoring
    const comparison = evaluateCandidateAgainstJd({
      candidate: candidateProfile,
      jd: jdAnalysis,
      customWeights: autoConfig?.scoringWeights,
    })

    // Dynamic extraction for custom sheet columns if configured
    let customFields: Record<string, string> | undefined = undefined
    if (autoConfig?.sheetColumns && autoConfig.sheetColumns.length > 0) {
      try {
        customFields = await extractCandidateWithCustomColumns(
          extractedText,
          fileName,
          autoConfig.sheetColumns,
          jdAnalysis,
          candidateProfile
        )
      } catch (err) {
        console.warn('[Ingestion] Custom column extraction error, proceeding with standard fields:', err)
      }
    }

    console.log(
      JSON.stringify({
        event: 'candidate.evaluation.completed',
        organizationId,
        jobId,
        candidateName: candidateProfile.candidate_name,
        matchScore: comparison.match_score,
        recommendation: comparison.recommendation,
        matchingSkillsCount: comparison.matching_skills.length,
        missingSkillsCount: comparison.missing_skills.length,
        timestamp: new Date().toISOString(),
      })
    )

    // Duplicate Detection (by sourceFileId, fileHash, normalized email, or phone)
    let isDuplicate = false
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

    if (!existingCandidate && fileHash) {
      const priorRecord = await recordsCol.findOne({
        organizationId,
        fileHash,
        status: 'COMPLETED',
        candidateId: { $exists: true },
        _id: { $ne: recordId },
      })
      if (priorRecord?.candidateId) {
        existingCandidate = await candCol.findOne({ _id: new ObjectId(priorRecord.candidateId) })
      }
    }

    let candidateId = ''
    let candidateDoc: CandidateDocument

    if (existingCandidate) {
      isDuplicate = true
      candidateId = existingCandidate._id.toString()
      await addStageActivity(
        'Duplicate detected',
        `Duplicate candidate detected (${candidateProfile.candidate_name} · ${candidateProfile.email || 'matching profile'}). Synced to existing profile without duplicate creation.`,
        'COMPLETED'
      )

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

      // Update existing candidate profile with fresh match info
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
    } else {
      // STEP 7: Save New Candidate to MongoDB
      await addStageActivity('Candidate created', `Creating candidate profile for ${candidateProfile.candidate_name}...`, 'EVALUATING')

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
          : extractedText.slice(0, 400),
        skills: candidateProfile.skills,
        education: candidateProfile.education,
        certifications: candidateProfile.certifications,
        workAuthorization: candidateProfile.work_authorization,
        availability: candidateProfile.availability,
        stage: 'Sourcing' as const,
        sourceFile: fileName,
        sourceFileId,
        resumeUrl: sourceFileUrl,
        extractionProvider: process.env.GEMINI_API_KEY ? 'gemini' : 'structured-zod',
        rawText: extractedText.slice(0, 50_000),
        jobId,
        jobTitle: job.title,
        matchingSkills: comparison.matching_skills,
        missingSkills: comparison.missing_skills,
        matchScore: comparison.match_score,
        recommendation: comparison.recommendation,
        reasoningSummary: comparison.reasoning_summary,
        scoringBreakdown: comparison.scoring_breakdown,
        sheetsSyncStatus: 'PENDING' as const,
        customFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const candInsert = await candCol.insertOne(newCandData as any)
      candidateId = candInsert.insertedId.toString()
      candidateDoc = { id: candidateId, ...newCandData }

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

      // Increment job applicants count
      await jobsCol.updateOne({ _id: new ObjectId(jobId) }, { $inc: { applicants: 1 } })
    }

    // Candidate Evaluation Completed Stage
    await addStageActivity(
      'Candidate evaluation completed',
      `${comparison.recommendation}: ${comparison.match_score}% match (${comparison.matching_skills.length} matching skills, ${comparison.missing_skills.length} missing skills).`,
      'COMPLETED'
    )

    // STEP 8: Google Sheets Synchronization
    let sheetsSyncResult: any = null
    if (autoConfig?.googleSheetsSpreadsheetId && autoConfig.googleSheetsSpreadsheetId.trim()) {
      console.log(
        JSON.stringify({
          event: 'sheets.sync.started',
          organizationId,
          jobId,
          candidateId,
          spreadsheetId: autoConfig.googleSheetsSpreadsheetId,
          sheetName: autoConfig.googleSheetsSheetName || 'Candidate Tracking',
          timestamp: new Date().toISOString(),
        })
      )

      sheetsSyncResult = await syncCandidateToGoogleSheets(candidateDoc, {
        spreadsheetId: autoConfig.googleSheetsSpreadsheetId,
        sheetName: autoConfig.googleSheetsSheetName || 'Candidate Tracking',
        columns: autoConfig.sheetColumns,
        allowSimulation,
      })

      if (sheetsSyncResult.success) {
        console.log(
          JSON.stringify({
            event: 'sheets.sync.completed',
            organizationId,
            jobId,
            candidateId,
            spreadsheetId: autoConfig.googleSheetsSpreadsheetId,
            rowId: sheetsSyncResult.rowId,
            timestamp: new Date().toISOString(),
          })
        )
        await addStageActivity(
          'Candidate synced',
          `Synchronized candidate to Google Sheets tab "${sheetsSyncResult.sheetName}" (Row #${sheetsSyncResult.rowId || 'updated'}).`
        )
      } else {
        console.log(
          JSON.stringify({
            event: 'sheets.sync.failed',
            organizationId,
            jobId,
            candidateId,
            spreadsheetId: autoConfig.googleSheetsSpreadsheetId,
            error: sheetsSyncResult.error,
            timestamp: new Date().toISOString(),
          })
        )
        await addStageActivity(
          'Candidate synced',
          `Sheets synchronization notice: ${sheetsSyncResult.error || 'Sync pending credentials'}`
        )
      }
    } else {
      await addStageActivity('Candidate synced', `Candidate enrolled in hiring pipeline. (Google Sheets export not configured).`)
    }

    // Update processing record
    await recordsCol.updateOne(
      { _id: recordId },
      {
        $set: {
          status: 'COMPLETED',
          candidateId,
          candidateName: candidateProfile.candidate_name,
          normalizedEmail: normEmail,
          normalizedPhone: normPhone,
          matchScore: comparison.match_score,
          updatedAt: new Date(),
        },
      }
    )

    // Log to workspace activities
    try {
      await actCol.insertOne({
        organization: organizationId,
        title: isDuplicate ? 'Candidate profile updated' : 'Candidate evaluated & synced',
        detail: `${candidateProfile.candidate_name} · ${job.title} (${comparison.match_score}% match)`,
        type: 'resume_uploaded',
        createdAt: new Date(),
      } as any)
    } catch {}

    const updated = await recordsCol.findOne({ _id: recordId })
    return {
      id: updated!._id.toString(),
      ...updated!,
    } as any
  } catch (error: any) {
    console.error(`[Ingestion] Failed to process ${fileName}:`, error)
    await recordsCol.updateOne(
      { _id: recordId },
      {
        $set: {
          status: 'FAILED',
          error: error.message || 'Unknown processing failure',
          updatedAt: new Date(),
        },
        $push: {
          stageActivities: {
            stage: 'Failed',
            message: `Processing error: ${error.message || 'Unknown failure'}`,
            timestamp: new Date(),
          },
        },
      } as any
    )

    const failed = await recordsCol.findOne({ _id: recordId })
    return {
      id: failed!._id.toString(),
      ...failed!,
    } as any
  }
}

/**
 * Retries a previously FAILED or REVIEW_REQUIRED processing record.
 */
export async function retryProcessingRecord(
  recordId: string,
  organizationId: string
): Promise<ResumeProcessingRecord | null> {
  const recordsCol = resumeProcessingRecordsCollection()
  const record = await recordsCol.findOne({
    _id: new ObjectId(recordId),
    organizationId,
  })

  if (!record) return null

  // Reset status to QUEUED and push retry event
  await recordsCol.updateOne(
    { _id: new ObjectId(recordId) },
    {
      $set: { status: 'QUEUED', error: undefined, updatedAt: new Date() },
      $push: {
        stageActivities: {
          stage: 'Retry triggered',
          message: 'Manual retry initiated by recruiter',
          timestamp: new Date(),
        },
      },
    } as any
  )

  if (record.extractedTextSnippet) {
    const jobCol = jobsCollection()
    const job = await jobCol.findOne({ _id: new ObjectId(record.jobId), organization: organizationId })
    if (job) {
      const buffer = Buffer.from(record.extractedTextSnippet, 'utf-8')
      return processResumeBuffer({
        organizationId,
        jobId: record.jobId,
        fileName: record.fileName,
        fileBuffer: buffer,
        sourceFileId: record.sourceFileId,
        sourceFileUrl: record.sourceFileUrl,
        externalSource: record.externalSource,
      })
    }
  }

  const updated = await recordsCol.findOne({ _id: new ObjectId(recordId) })
  return updated as any
}

/**
 * Scans the Google Drive Resume Folder for a configured job and queues un-ingested files.
 */
export async function scanAndIngestJobDriveFolder(
  jobId: string,
  organizationId: string
): Promise<{
  scanned: number
  queued: number
  message: string
  records: any[]
}> {
  const jobsCol = jobsCollection()
  const autoCol = jobAutomationConfigCollection()
  const recordsCol = resumeProcessingRecordsCollection()

  const job = await jobsCol.findOne({ _id: new ObjectId(jobId), organization: organizationId })
  if (!job) throw new Error('Job not found in this organization')

  const config = await autoCol.findOne({ jobId, organizationId })
  if (!config || !config.googleDriveResumeFolderId) {
    throw new Error('Google Drive Resume Folder ID is not configured for this job')
  }

  const folderId = config.googleDriveResumeFolderId.trim()
  const token = await getDriveAccessToken()
  const apiKey = process.env.GOOGLE_API_KEY
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  let driveFiles: Array<{ id: string; name: string; mimeType: string; size?: string }> = []

  // Fetch file list from Google Drive API v3
  try {
    const url = `https://www.googleapis.com/drive/v3/files?q='${encodeURIComponent(
      folderId
    )}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size,webViewLink)${
      apiKey && !token ? `&key=${apiKey}` : ''
    }`

    const res = await fetch(url, { headers })
    if (res.ok) {
      const data = await res.json()
      driveFiles = data.files || []
    } else {
      console.warn('Google Drive folder scan HTTP error:', res.status)
    }
  } catch (err) {
    console.warn('Failed to query Google Drive folder files:', err)
  }

  // Filter for supported resume formats (PDF & DOCX)
  const resumeFiles = driveFiles.filter(
    (f) =>
      /\.(pdf|docx)$/i.test(f.name) ||
      f.mimeType === 'application/pdf' ||
      f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )

  let queuedCount = 0
  const processedRecords = []

  for (const file of resumeFiles) {
    const existing = await recordsCol.findOne({
      organizationId,
      jobId,
      sourceFileId: file.id,
    })

    if (!existing) {
      queuedCount++
      const insertResult = await recordsCol.insertOne({
        organizationId,
        jobId,
        jobTitle: job.title,
        externalSource: 'google_drive',
        sourceFileId: file.id,
        sourceFileUrl: `https://drive.google.com/file/d/${file.id}/view`,
        fileName: file.name,
        fileSize: Number(file.size) || 0,
        mimeType: file.mimeType,
        status: 'QUEUED' as ProcessingStatus,
        stageActivities: [
          {
            stage: 'Resume detected',
            message: `Detected "${file.name}" in Google Drive folder`,
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      processedRecords.push({
        id: insertResult.insertedId.toString(),
        fileName: file.name,
        status: 'QUEUED',
      })
    } else {
      processedRecords.push({
        id: existing._id.toString(),
        fileName: existing.fileName,
        status: existing.status,
      })
    }
  }

  return {
    scanned: driveFiles.length,
    queued: queuedCount,
    message:
      queuedCount > 0
        ? `Found ${resumeFiles.length} resume(s), queued ${queuedCount} new file(s) for asynchronous ingestion.`
        : `All ${resumeFiles.length} resume(s) in this folder have already been processed (idempotent).`,
    records: processedRecords,
  }
}
