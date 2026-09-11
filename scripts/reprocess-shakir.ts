import { candidateProfilesCollection, resumeProcessingRecordsCollection, jobAutomationConfigCollection } from '../lib/mongodb'
import { downloadDriveFile } from '../lib/google-drive-sync'
import { processResumeBuffer } from '../lib/google-drive-ingestion'
import { ObjectId } from 'mongodb'

async function main() {
  const candCol = candidateProfilesCollection()
  const recCol = resumeProcessingRecordsCollection()
  const autoCol = jobAutomationConfigCollection()

  const cand = await candCol.findOne({
    $or: [
      { fullName: { $regex: /shakir|imran|highlight/i } },
      { sourceFile: { $regex: /shakir/i } },
    ]
  })

  if (!cand) {
    console.log('Shakir candidate not found')
    return
  }

  console.log('Found candidate:', {
    _id: cand._id,
    fullName: cand.fullName,
    organization: cand.organization,
    sourceFileId: cand.sourceFileId,
    sourceFile: cand.sourceFile,
  })

  const config = await autoCol.findOne({
    organizationId: cand.organization,
    googleDriveResumeFolderId: { $exists: true, $ne: '' }
  })

  if (!config) {
    console.log('No automation config found')
    return
  }

  console.log('Using config for job:', config.jobId)
  console.log('Downloading file:', cand.sourceFileId)

  const fileBuffer = await downloadDriveFile(cand.sourceFileId!, cand.organization)

  const result = await processResumeBuffer({
    organizationId: cand.organization,
    jobId: config.jobId,
    fileName: cand.sourceFile || 'Shakir_Imran_Resume_Centennial_SalesforcePM.pdf',
    fileBuffer,
    sourceFileId: cand.sourceFileId!,
    sourceFileUrl: `https://drive.google.com/file/d/${cand.sourceFileId}/view`,
    forceReprocess: true,
  })

  console.log('\n--- Process Result ---')
  console.log('Status:', result.status)
  console.log('Candidate Name:', result.candidateName)
  console.log('Email:', result.normalizedEmail)
  console.log('Phone:', result.normalizedPhone)

  const updatedCand = await candCol.findOne({ _id: new ObjectId(result.candidateId) })
  console.log('\n--- Updated Candidate in DB ---')
  console.log({
    _id: updatedCand?._id,
    fullName: updatedCand?.fullName,
    email: updatedCand?.email,
    phone: updatedCand?.phone,
    location: updatedCand?.location,
  })
}

main().catch(console.error)
