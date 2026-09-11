import { candidateProfilesCollection } from '../lib/mongodb'

async function main() {
  const candCol = candidateProfilesCollection()
  const cand = await candCol.findOne({ fullName: { $regex: /tripti/i } })
  if (!cand || !cand.rawText) {
    console.log('No raw text')
    return
  }
  console.log('Length:', cand.rawText.length)
  const lines = cand.rawText.split('\n')
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    console.log(`Line ${i + 1}: ${lines[i]}`)
  }
  const emailMatch = cand.rawText.match(/[\w.-]+@[\w.-]+\.\w+/)
  console.log('Regex Email match in whole doc:', emailMatch)
  const phoneMatch = cand.rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
  console.log('Regex Phone match in whole doc:', phoneMatch)
}

main().catch(console.error)
