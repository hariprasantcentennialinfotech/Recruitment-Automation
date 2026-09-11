import { candidateProfilesCollection, resumeProcessingRecordsCollection } from '../lib/mongodb'
import { ObjectId } from 'mongodb'

async function main() {
  const recordsCol = resumeProcessingRecordsCollection()
  const candCol = candidateProfilesCollection()

  const record = await recordsCol.findOne({ sourceFileId: '1hOTI3WhzAboRaeggudznCrAMYPoS0vF0' })
  console.log('Record:', {
    _id: record?._id,
    candidateName: record?.candidateName,
    candidateId: record?.candidateId,
    status: record?.status,
    syncStatus: record?.syncStatus,
  })

  if (record?.candidateId) {
    const cand = await candCol.findOne({ _id: new ObjectId(record.candidateId) })
    console.log('Cand by record.candidateId:', cand ? {
      _id: cand._id,
      fullName: cand.fullName,
      email: cand.email,
      phone: cand.phone,
      location: cand.location,
      sourceFileId: cand.sourceFileId,
    } : null)
  }

  const allMatching = await candCol.find({
    $or: [
      { sourceFileId: '1hOTI3WhzAboRaeggudznCrAMYPoS0vF0' },
      { email: 'sheik.zahir.abbash@gmail.com' },
    ]
  }).toArray()
  console.log('All matching cands count:', allMatching.length)
  for (const c of allMatching) {
    console.log(' - Cand:', c._id, c.fullName, c.email, c.phone, c.location, c.sourceFileId)
  }
}

main().catch(console.error)
