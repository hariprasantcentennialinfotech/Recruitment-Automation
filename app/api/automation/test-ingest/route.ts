import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { jobsCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { processResumeBuffer } from '@/lib/google-drive-ingestion'

export const runtime = 'nodejs'

// POST /api/automation/test-ingest — test the resume automation pipeline with PDF/DOCX/duplicate/failure
export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const contentType = req.headers.get('content-type') || ''
    let jobId = ''
    let fileName = ''
    let buffer: Buffer = Buffer.alloc(0)
    let sourceFileId = ''
    let testMode = 'normal'

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      jobId = (formData.get('jobId') as string) || ''
      testMode = (formData.get('testMode') as string) || 'normal'
      const file = formData.get('file')

      if (file instanceof File) {
        fileName = file.name
        buffer = Buffer.from(await file.arrayBuffer())
        sourceFileId = `test_file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      }
    } else {
      const body = await req.json()
      jobId = body.jobId || ''
      fileName = body.fileName || 'candidate_resume.pdf'
      testMode = body.testMode || 'normal'
      sourceFileId = body.sourceFileId || `sim_drive_${Date.now()}`

      if (body.fileBase64) {
        buffer = Buffer.from(body.fileBase64, 'base64')
      } else if (body.rawText) {
        buffer = Buffer.from(body.rawText, 'utf-8')
      } else {
        // Generate a synthetic test resume
        const sampleName = body.candidateName || 'Sarah Chen'
        const sampleEmail = body.candidateEmail || 'sarah.chen@example.com'
        const sampleText = `%PDF-1.4
${sampleName}
${sampleEmail} · +1 (555) 234-5678 · San Francisco, CA
Senior Full-Stack Engineer with 6+ years of experience.
Skills: React, Next.js, TypeScript, Node.js, Python, MongoDB, Docker, GraphQL, System Architecture
Experience: Senior Software Engineer at TechCorp (2021-Present)
Education: B.S. in Computer Science, University of California`
        buffer = Buffer.from(sampleText, 'utf-8')
      }
    }

    if (!jobId) {
      // Find the first job in the organization if not provided
      const jobsCol = jobsCollection()
      const firstJob = await jobsCol.findOne({ organization })
      if (!firstJob) {
        return NextResponse.json(
          { error: 'No jobs found in this organization. Create a job first.' },
          { status: 400 }
        )
      }
      jobId = firstJob._id.toString()
    } else if (!ObjectId.isValid(jobId)) {
      return NextResponse.json({ error: 'Invalid Job ID' }, { status: 400 })
    }

    // Corrupt file test simulation
    if (testMode === 'corrupt') {
      buffer = Buffer.from('NOT_A_VALID_DOCUMENT_CORRUPT_BYTES_0000000000', 'utf-8')
      fileName = 'corrupted_resume.unsupported'
    }

    const record = await processResumeBuffer({
      organizationId: organization,
      jobId,
      fileName,
      fileBuffer: buffer,
      sourceFileId,
      externalSource: 'google_drive',
    })

    return NextResponse.json({
      success: record.status !== 'FAILED',
      record,
    })
  } catch (error: any) {
    console.error('Test ingestion failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Test ingestion failed' },
      { status: 500 }
    )
  }
}
