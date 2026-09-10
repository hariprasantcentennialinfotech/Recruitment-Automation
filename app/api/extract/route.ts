import { NextResponse } from 'next/server'
import { candidateProfilesCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { processResumeBuffer } from '@/lib/google-drive-ingestion'

export const runtime = 'nodejs'

/**
 * POST /api/extract
 *
 * Website resume upload path.
 * Now uses the SAME processResumeBuffer() pipeline as the Google Drive ingestion path.
 *
 * Both upload paths converge here:
 *   Website Upload → processResumeBuffer()
 *   Google Drive   → processResumeBuffer()
 */
export async function POST(request: Request) {
  const authResult = await requireOrganization(request)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const jobId = (formData.get('jobId') as string) || ''

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A resume file is required.' }, { status: 400 })
    }
    if (!/\.(pdf|docx|doc|txt)$/i.test(file.name)) {
      return NextResponse.json(
        { error: 'Only PDF, DOCX, DOC, or TXT files are supported.' },
        { status: 400 }
      )
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Files must be smaller than 10 MB.' }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const sourceFileId = `web_upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // If no jobId provided, find the first active job for this organization
    let resolvedJobId = jobId
    if (!resolvedJobId) {
      const { jobsCollection } = await import('@/lib/mongodb')
      const jobsCol = jobsCollection()
      const firstJob = await jobsCol.findOne({ organization, status: 'Open' })
      if (firstJob) {
        resolvedJobId = firstJob._id.toString()
      }
    }

    if (!resolvedJobId) {
      // Fallback: legacy simple extraction path (no job matching)
      return legacyExtract(request, organization, file)
    }

    // Run through the full shared processing pipeline
    const record = await processResumeBuffer({
      organizationId: organization,
      jobId: resolvedJobId,
      fileName: file.name,
      fileBuffer,
      sourceFileId,
      sourceFileUrl: '', // no Drive URL for manual uploads
      externalSource: 'manual_upload',
      allowSimulation: false,
    })

    // Return in the format the UI expects
    return NextResponse.json({
      id: record.candidateId || record.id,
      record,
      profile: record.candidateName
        ? {
            fullName: record.candidateName,
            stage: 'Sourcing',
            sourceFile: file.name,
            organization,
            id: record.candidateId,
          }
        : null,
    })
  } catch (error: any) {
    console.error('[extract] Resume processing failed:', error)
    return NextResponse.json(
      { error: error.message || 'Candidate extraction could not be completed.' },
      { status: 500 }
    )
  }
}

/**
 * Legacy fallback extraction path for when no job is available.
 * Preserves backward compatibility for orgs that haven't set up jobs yet.
 */
async function legacyExtract(request: Request, organization: string, file: File) {
  const mammoth = await import('mammoth')
  const { z } = await import('zod')
  const { activitiesCollection } = await import('@/lib/mongodb')

  const buffer = Buffer.from(await file.arrayBuffer())
  let text = ''
  if (file.name.toLowerCase().endsWith('.docx')) {
    const result = await mammoth.default.extractRawText({ buffer })
    text = result.value
  } else {
    text = buffer.toString('utf8')
  }

  const compact = text.replace(/\s+/g, ' ').trim()
  const email = compact.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? ''
  const phone = compact.match(/(?:\+?\d[\d ()-]{7,}\d)/)?.[0]
  const name =
    compact.split(/\n| · | - /)[0]?.trim() ||
    file.name.replace(/[-_].*/, '').replace(/\.[^.]+$/, '')

  const collection = candidateProfilesCollection()
  const document = {
    organization,
    fullName: name,
    email,
    phone,
    summary: compact.slice(0, 420),
    skills: [],
    stage: 'Sourcing',
    sourceFile: file.name,
    extractionProvider: 'structured-fallback',
    rawText: text.slice(0, 100_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const result = await collection.insertOne(document as any)

  try {
    const actCol = activitiesCollection()
    await actCol.insertOne({
      organization,
      title: 'Resume uploaded',
      detail: `${name} added to Sourcing`,
      type: 'resume_uploaded',
      createdAt: new Date(),
    } as any)
  } catch {}

  return NextResponse.json({
    id: result.insertedId.toString(),
    profile: { fullName: name, email, phone, stage: 'Sourcing', id: result.insertedId.toString() },
  })
}

export async function GET(request: Request) {
  const authResult = await requireOrganization(request)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const collection = candidateProfilesCollection()
    const docs = await collection
      .find({ organization })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    const profiles = docs.map((doc) => ({
      id: doc._id.toString(),
      fullName: doc.fullName,
      email: doc.email,
      phone: doc.phone,
      location: doc.location,
      summary: doc.summary,
      skills: doc.skills || [],
      stage: doc.stage || 'Sourcing',
      sourceFile: doc.sourceFile,
      extractionProvider: doc.extractionProvider,
      organization: doc.organization,
      createdAt: doc.createdAt,
    }))

    return NextResponse.json({ profiles })
  } catch {
    return NextResponse.json({ profiles: [] })
  }
}
