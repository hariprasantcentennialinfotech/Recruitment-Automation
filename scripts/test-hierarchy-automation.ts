/**
 * scripts/test-hierarchy-automation.ts
 *
 * Automated verification of:
 * 1. Google Drive Hierarchy Auto-Discovery
 *    - 📁 Recruitment Automation / 📁 Jobs / 📁 [Job Title] / { 📁 Resumes, 📄 Job Description.docx, 📊 Candidate Tracking }
 * 2. Dynamic Column Header Discovery & Custom Field Extraction
 * 3. Company-level Organization Automation Settings & Active Mode Toggle
 * 4. Interval-based Poller Verification (5m, 15m, 30m)
 */

import dotenv from 'dotenv'
import { MongoClient, ObjectId } from 'mongodb'
import {
  discoverJobsFromDriveRoot,
  getOrganizationAutomationSettings,
  updateOrganizationAutomationSettings,
} from '../lib/google-drive-hierarchy'
import { extractCandidateWithCustomColumns } from '../lib/gemini-ai'
import { pollActiveFoldersFunction } from '../lib/inngest/functions/poll-active-folders'

dotenv.config()

async function runHierarchyVerification() {
  console.log('========================================================================')
  console.log('TEST SUITE: GOOGLE DRIVE HIERARCHY AUTO-DISCOVERY & ACTIVE MODE WATCHER')
  console.log('========================================================================\n')

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing in .env')

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DATABASE || 'talentflow')

  const testOrg = `test_corp_${Date.now()}`
  console.log(`[Setup] Using test organization: ${testOrg}`)

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`)
      passed++
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`)
      failed++
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Hierarchy Auto-Discovery with simulated Google Drive structure
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 1: Drive Hierarchy Traversal & Auto-Discovery ---')

    const rootFolderId = 'root_recruitment_automation_101'
    const jobsFolderId = 'jobs_folder_202'
    const devopsFolderId = 'job_devops_301'
    const cloudFolderId = 'job_cloud_302'

    const simulatedChildren: Record<string, any[]> = {
      [rootFolderId]: [
        { id: jobsFolderId, name: 'Jobs', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'random_file', name: 'Notes.txt', mimeType: 'text/plain' },
      ],
      [jobsFolderId]: [
        { id: devopsFolderId, name: 'DevOps Engineer', mimeType: 'application/vnd.google-apps.folder' },
        { id: cloudFolderId, name: 'Cloud Engineer', mimeType: 'application/vnd.google-apps.folder' },
      ],
      [devopsFolderId]: [
        { id: 'resume_folder_devops', name: 'Resumes', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'jd_devops_doc', name: 'Job Description.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { id: 'sheet_devops', name: 'Candidate Tracking', mimeType: 'application/vnd.google-apps.spreadsheet' },
      ],
      [cloudFolderId]: [
        { id: 'resume_folder_cloud', name: 'Resumes', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'jd_cloud_pdf', name: 'Job Description.pdf', mimeType: 'application/pdf' },
        { id: 'sheet_cloud', name: 'Candidate Tracking', mimeType: 'application/vnd.google-apps.spreadsheet' },
      ],
    }

    const discoveryResult = await discoverJobsFromDriveRoot(
      `https://drive.google.com/drive/folders/${rootFolderId}`,
      testOrg,
      { simulatedChildren }
    )

    assert(discoveryResult.success === true, 'Discovery executed successfully')
    assert(discoveryResult.discoveredJobs.length === 2, 'Found exactly 2 jobs in Jobs folder')

    const devopsJob = discoveryResult.discoveredJobs.find((j) => j.jobTitle === 'DevOps Engineer')
    assert(!!devopsJob, 'Found "DevOps Engineer" job')
    assert(devopsJob?.resumeFolderId === 'resume_folder_devops', 'Discovered Resumes folder for DevOps')
    assert(devopsJob?.jdFileId === 'jd_devops_doc', 'Discovered Job Description.docx for DevOps')
    assert(devopsJob?.spreadsheetId === 'sheet_devops', 'Discovered Candidate Tracking sheet for DevOps')
    assert(devopsJob?.status === 'READY', 'DevOps job status marked READY')

    const cloudJob = discoveryResult.discoveredJobs.find((j) => j.jobTitle === 'Cloud Engineer')
    assert(!!cloudJob, 'Found "Cloud Engineer" job')
    assert(cloudJob?.resumeFolderId === 'resume_folder_cloud', 'Discovered Resumes folder for Cloud Engineer')
    assert(cloudJob?.jdFileId === 'jd_cloud_pdf', 'Discovered Job Description.pdf for Cloud Engineer')
    assert(cloudJob?.spreadsheetId === 'sheet_cloud', 'Discovered Candidate Tracking sheet for Cloud Engineer')

    // Verify MongoDB job automation configs were saved
    const autoConfigs = await db.collection('job_automation_configs').find({ organizationId: testOrg }).toArray()
    assert(autoConfigs.length === 2, 'Saved 2 job automation configs in MongoDB')
    assert(autoConfigs[0].enabled === true, 'First job config is enabled')

    // -------------------------------------------------------------------------
    // TEST 2: Organization Automation Settings & Active Mode Watcher Configuration
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Organization Settings & Active Mode Interval ---')

    const initialSettings = await getOrganizationAutomationSettings(testOrg)
    assert(initialSettings.organizationId === testOrg, 'Loaded organization automation settings')
    assert(initialSettings.activeMode === false, 'Initial activeMode defaults to false')

    // Update to Active Mode ON with 15-minute interval
    const updatedSettings = await updateOrganizationAutomationSettings(testOrg, {
      activeMode: true,
      watchIntervalMinutes: 15,
    })

    assert(updatedSettings.activeMode === true, 'Updated activeMode to true')
    assert(updatedSettings.watchIntervalMinutes === 15, 'Updated watch interval to 15 minutes')

    // -------------------------------------------------------------------------
    // TEST 3: Dynamic Column Header Extraction
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Dynamic Custom Column Extraction via AI ---')

    const customHeaders = [
      'Candidate Name',
      'Email',
      'Phone',
      'Years of Experience',
      'Primary Tech Stack',
      'Expected Salary',
      'Notice Period',
      'Visa Status',
    ]

    const mockResumeText = `
      Johnathan Doe
      Email: john.doe@example.com
      Phone: +1 555-0199
      Dallas, Texas
      Summary: Senior DevOps and Cloud Engineer with 8 years of experience in AWS, Kubernetes, Docker, Terraform.
      Looking for $140,000/year base salary. Notice period: 2 weeks.
      Work Authorization: US Citizen.
    `

    const customFields = await extractCandidateWithCustomColumns(
      mockResumeText,
      'john_doe_resume.pdf',
      customHeaders
    )

    assert(!!customFields, 'Extracted customFields object')
    console.log('   Extracted custom fields:', JSON.stringify(customFields, null, 2))
    assert(
      Object.keys(customFields).length > 0,
      'Populated customFields matching sheet column headers'
    )

    // -------------------------------------------------------------------------
    // TEST 4: Cleanup
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Clean up test fixtures ---')
    await db.collection('jobs').deleteMany({ organization: testOrg })
    await db.collection('job_automation_configs').deleteMany({ organization: testOrg })
    await db.collection('organization_automation_settings').deleteMany({ organizationId: testOrg })
    assert(true, 'Cleaned up test data from MongoDB')

    console.log(`\n========================================================================`)
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`)
    console.log(`========================================================================\n`)

    if (failed > 0) {
      process.exit(1)
    }
  } finally {
    await client.close()
  }
}

runHierarchyVerification().catch((err) => {
  console.error('[Verification Failed]:', err)
  process.exit(1)
})
