import { jobAutomationConfigCollection, resumeProcessingRecordsCollection, candidateProfilesCollection } from '../lib/mongodb'
import { downloadDriveFile, scanFolderDirectly } from '../lib/google-drive-sync'
import { processResumeBuffer } from '../lib/google-drive-ingestion'
import { ObjectId } from 'mongodb'

async function main() {
  const organization = 'krct'
  const autoCol = jobAutomationConfigCollection()
  const recordsCol = resumeProcessingRecordsCollection()
  const candCol = candidateProfilesCollection()

  const config = await autoCol.findOne({
    organizationId: organization,
    enabled: true,
    googleDriveResumeFolderId: { $exists: true, $ne: '' },
  })

  if (!config) {
    console.log('No active config found')
    return
  }

  console.log('Active config found for job:', config.jobId)
  console.log('Folder ID:', config.googleDriveResumeFolderId)
  console.log('Sheet ID:', config.googleSheetsSpreadsheetId)
  console.log('Sheet Name:', config.googleSheetsSheetName)

  const files = await scanFolderDirectly(config.googleDriveResumeFolderId, organization)
  console.log(`Found ${files.length} total files in resume folder`)

  // Test processing 3 files that were previously marked "Candidate"
  const targetFiles = files.filter(f => f.name.endsWith('.pdf') || f.name.endsWith('.docx')).slice(0, 3)

  for (const f of targetFiles) {
    console.log(`\n--- Testing file: ${f.name} (${f.id}) ---`)
    const fileBuffer = await downloadDriveFile(f.id, organization)
    const result: any = await processResumeBuffer({
      fileBuffer,
      fileName: f.name,
      jobId: config.jobId,
      organizationId: organization,
      sourceFileId: f.id,
      sourceFileUrl: `https://drive.google.com/file/d/${f.id}/view`,
      forceReprocess: true,
    })

    console.log('Result Candidate Name:', result?.candidateName)
    console.log('Result Status:', result?.status)

    const cand = result?.candidateId
      ? await candCol.findOne({ _id: new ObjectId(result.candidateId) })
      : await candCol.findOne({ organization, sourceFileId: f.id, fullName: { $ne: 'Candidate' } })
    if (cand) {
      console.log('Candidate in DB:', {
        fullName: cand.fullName,
        email: cand.email,
        phone: cand.phone,
        location: cand.location,
        matchingSkills: cand.matchingSkills?.slice(0, 3),
        missingSkills: cand.missingSkills?.slice(0, 3),
      })
    }
  }
}

main().catch(console.error)
