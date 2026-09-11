import { candidateProfilesCollection, resumeProcessingRecordsCollection } from '../lib/mongodb'

async function main() {
  const candCol = candidateProfilesCollection()
  const recCol = resumeProcessingRecordsCollection()

  const cand = await candCol.findOne({ fullName: { $regex: /tripti/i } })
  console.log('Candidate TRIPTI:', cand ? {
    _id: cand._id,
    fullName: cand.fullName,
    email: cand.email,
    phone: cand.phone,
    location: cand.location,
    sourceFile: cand.sourceFile,
    sourceFileId: cand.sourceFileId,
  } : 'Not found')

  const rec = await recCol.findOne({
    $or: [
      { candidateName: { $regex: /tripti/i } },
      { fileName: { $regex: /tripti/i } },
    ]
  })
  console.log('Record TRIPTI:', rec ? {
    _id: rec._id,
    candidateName: rec.candidateName,
    fileName: rec.fileName,
    sourceFileId: rec.sourceFileId,
    snippet: rec.extractedTextSnippet?.slice(0, 300),
  } : 'Not found')

  if (cand?.rawText) {
    console.log('Raw text first 600 chars:')
    console.log(cand.rawText.slice(0, 600))
  }
}

main().catch(console.error)
