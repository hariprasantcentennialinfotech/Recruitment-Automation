import { candidateProfilesCollection, resumeProcessingRecordsCollection } from '../lib/mongodb'

async function main() {
  const candCol = candidateProfilesCollection()
  const recCol = resumeProcessingRecordsCollection()

  const candidates = await candCol.find({
    $or: [
      { fullName: { $regex: /shakir|imran|highlight/i } },
      { sourceFile: { $regex: /shakir|imran/i } },
      { rawText: { $regex: /shakir/i } },
    ]
  }).toArray()

  console.log(`Found ${candidates.length} candidates matching Shakir/Imran/Highlight:`)
  for (const c of candidates) {
    console.log({
      _id: c._id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      sourceFile: c.sourceFile,
      sourceFileId: c.sourceFileId,
    })
    if (c.rawText) {
      console.log('--- First 600 chars of rawText ---')
      console.log(c.rawText.slice(0, 600))
    }
  }

  const records = await recCol.find({
    $or: [
      { candidateName: { $regex: /shakir|imran|highlight/i } },
      { fileName: { $regex: /shakir|imran/i } },
    ]
  }).toArray()
  console.log(`\nFound ${records.length} records matching:`)
  for (const r of records) {
    console.log({
      _id: r._id,
      candidateName: r.candidateName,
      fileName: r.fileName,
      status: r.status,
      candidateId: r.candidateId,
    })
  }
}

main().catch(console.error)
