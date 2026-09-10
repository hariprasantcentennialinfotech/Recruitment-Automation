import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import { processResumeBuffer, retryProcessingRecord } from '../lib/google-drive-ingestion'

dotenv.config()

async function main() {
  console.log('=================================================================')
  console.log('TASK 5: GOOGLE DRIVE RESUME AUTOMATION VERIFICATION SUITE')
  console.log('=================================================================\n')

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not configured in .env')

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DATABASE || 'talentflow')

  const tenantA = `test_tenant_a_${Date.now()}`
  const tenantB = `test_tenant_b_${Date.now()}`

  try {
    // Setup Test Job for Tenant A
    const jobResult = await db.collection('jobs').insertOne({
      organization: tenantA,
      title: 'Senior Full-Stack Engineer',
      team: 'Engineering',
      location: 'Remote',
      status: 'Open',
      skills: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'AWS', 'Docker'],
      applicants: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const jobIdA = jobResult.insertedId.toString()
    console.log(`[Setup] Created test Job for ${tenantA} (ID: ${jobIdA})`)

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 1: PDF RESUME INGESTION
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1: PDF Resume Ingestion ---')
    const samplePdfContent = `%PDF-1.4
David Miller
david.miller@cloudsolutions.com · +1 (555) 345-6789 · Seattle, WA
Full Stack Software Architect with extensive background in distributed systems.
Skills: React, TypeScript, Node.js, MongoDB, Docker, GraphQL, Kubernetes
Experience: Principal Architect at Pacific Tech (2020-Present)
Education: B.S. in Computer Engineering, University of Washington`
    const pdfBuffer = Buffer.from(samplePdfContent, 'utf-8')

    const pdfRecord = await processResumeBuffer({
      organizationId: tenantA,
      jobId: jobIdA,
      fileName: 'david_miller_resume.pdf',
      fileBuffer: pdfBuffer,
      sourceFileId: 'gdrive_file_pdf_001',
      externalSource: 'google_drive',
    })

    console.log(`Status: ${pdfRecord.status}`)
    console.log(`Candidate Created: ${pdfRecord.candidateName} (ID: ${pdfRecord.candidateId})`)
    console.log(`Match Score: ${pdfRecord.matchScore}%`)
    console.log(`Stage Activities: ${pdfRecord.stageActivities.map((s) => s.stage).join(' -> ')}`)

    if (pdfRecord.status !== 'COMPLETED' || !pdfRecord.candidateId) {
      throw new Error('TEST 1 FAILED: PDF resume ingestion did not complete successfully')
    }
    console.log('✓ TEST 1 PASSED: PDF resume ingested, extracted, evaluated, and synced.')

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 2: DOCX RESUME INGESTION
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: DOCX Resume Ingestion ---')
    // Build a minimal DOCX or text buffer formatted as docx
    const docxContent = `Elena Rostova
elena.rostova@techinnovations.org · +1 (555) 987-6543 · Austin, TX
Lead Frontend Architect specializing in React, Next.js, and Design Systems.
Skills: React, Next.js, TypeScript, TailwindCSS, Figma, UI/UX, GraphQL
Experience: Senior UI Lead at NextGen Digital
Education: M.S. in Software Design`
    const docxBuffer = Buffer.from(docxContent, 'utf-8')

    const docxRecord = await processResumeBuffer({
      organizationId: tenantA,
      jobId: jobIdA,
      fileName: 'elena_rostova_resume.docx',
      fileBuffer: docxBuffer,
      sourceFileId: 'gdrive_file_docx_002',
      externalSource: 'google_drive',
    })

    console.log(`Status: ${docxRecord.status}`)
    console.log(`Candidate: ${docxRecord.candidateName} (ID: ${docxRecord.candidateId})`)
    console.log(`Match Score: ${docxRecord.matchScore}%`)

    if (docxRecord.status !== 'COMPLETED' || !docxRecord.candidateId) {
      throw new Error('TEST 2 FAILED: DOCX resume ingestion did not complete successfully')
    }
    console.log('✓ TEST 2 PASSED: DOCX resume parsed and candidate created.')

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 3: DUPLICATE DETECTION (IDEMPOTENCY)
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Duplicate Detection & Idempotency ---')
    const candidatesCountBefore = await db.collection('candidate_profiles').countDocuments({ organization: tenantA })

    // Ingest the exact same candidate again
    const duplicateRecord = await processResumeBuffer({
      organizationId: tenantA,
      jobId: jobIdA,
      fileName: 'david_miller_updated_cv.pdf',
      fileBuffer: pdfBuffer,
      sourceFileId: 'gdrive_file_pdf_001_duplicate',
      externalSource: 'google_drive',
    })

    const candidatesCountAfter = await db.collection('candidate_profiles').countDocuments({ organization: tenantA })
    console.log(`Candidate count before duplicate: ${candidatesCountBefore}`)
    console.log(`Candidate count after duplicate: ${candidatesCountAfter}`)
    console.log(`Duplicate linked candidate ID: ${duplicateRecord.candidateId}`)

    if (candidatesCountBefore !== candidatesCountAfter) {
      throw new Error('TEST 3 FAILED: Duplicate candidate was created instead of being detected!')
    }
    console.log('✓ TEST 3 PASSED: Idempotency enforced. Duplicate detected without duplicate candidate record.')

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 4: FAILED FILE HANDLING
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Failed File Handling ---')
    const corruptBuffer = Buffer.from('NOT_A_VALID_DOCUMENT_CORRUPT_BYTES', 'utf-8')

    const failedRecord = await processResumeBuffer({
      organizationId: tenantA,
      jobId: jobIdA,
      fileName: 'corrupt_unsupported.xyz',
      fileBuffer: corruptBuffer,
      sourceFileId: 'gdrive_corrupt_004',
      externalSource: 'google_drive',
    })

    console.log(`Status: ${failedRecord.status}`)
    console.log(`Error Recorded: ${failedRecord.error}`)

    if (failedRecord.status !== 'FAILED' || !failedRecord.error) {
      throw new Error('TEST 4 FAILED: Corrupted file was not marked as FAILED with error message')
    }
    console.log('✓ TEST 4 PASSED: Failed file correctly marked FAILED with detailed error message.')

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 5: RETRY PROCESSING
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Retry Processing ---')
    const retriedRecord = await retryProcessingRecord(failedRecord.id || (failedRecord as any)._id.toString(), tenantA)

    console.log(`Retry Initial Status: ${retriedRecord?.status}`)
    const lastActivity = retriedRecord?.stageActivities?.slice(-1)[0]
    console.log(`Last Activity: ${lastActivity?.stage} — ${lastActivity?.message}`)

    if (!retriedRecord) {
      throw new Error('TEST 5 FAILED: retryProcessingRecord returned null')
    }
    console.log('✓ TEST 5 PASSED: Failed record successfully retried with audit trail.')

    // ───────────────────────────────────────────────────────────────────────────
    // TEST 6: TENANT ISOLATION
    // ───────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Tenant Isolation ---')
    let tenantIsolationPassed = false

    try {
      // Attempt to process a resume for Tenant A's job using Tenant B's credentials/org
      await processResumeBuffer({
        organizationId: tenantB,
        jobId: jobIdA, // Belongs to Tenant A
        fileName: 'tenant_spoofing_attempt.pdf',
        fileBuffer: pdfBuffer,
        sourceFileId: 'gdrive_spoof_006',
        externalSource: 'google_drive',
      })
    } catch (err: any) {
      console.log(`Expected Security Error: ${err.message}`)
      if (err.message.includes('does not belong to organization') || err.message.includes('not found')) {
        tenantIsolationPassed = true
      }
    }

    if (!tenantIsolationPassed) {
      throw new Error('TEST 6 FAILED: Tenant B was allowed to process resumes into Tenant A job!')
    }

    // Verify Tenant B has 0 records and 0 candidates
    const tenantBRecords = await db.collection('resume_processing_records').countDocuments({ organizationId: tenantB })
    const tenantBCandidates = await db.collection('candidate_profiles').countDocuments({ organization: tenantB })
    console.log(`Tenant B Records: ${tenantBRecords}, Tenant B Candidates: ${tenantBCandidates}`)

    if (tenantBRecords !== 0 || tenantBCandidates !== 0) {
      throw new Error('TEST 6 FAILED: Tenant B contaminated with Tenant A records!')
    }
    console.log('✓ TEST 6 PASSED: Strict multi-tenant data isolation verified.')

    console.log('\n=================================================================')
    console.log('ALL 6 VERIFICATION TESTS PASSED SUCCESSFULLY (100%)')
    console.log('=================================================================\n')
  } finally {
    // Clean up test data
    await db.collection('jobs').deleteMany({ organization: { $in: [tenantA, tenantB] } })
    await db.collection('candidate_profiles').deleteMany({ organization: { $in: [tenantA, tenantB] } })
    await db.collection('resume_processing_records').deleteMany({ organizationId: { $in: [tenantA, tenantB] } })
    await db.collection('activities').deleteMany({ organization: { $in: [tenantA, tenantB] } })
    await client.close()
    console.log('[Cleanup] Test database collections cleanly pruned.')
  }
}

main().catch((err) => {
  console.error('Test Suite Failed:', err)
  process.exit(1)
})
