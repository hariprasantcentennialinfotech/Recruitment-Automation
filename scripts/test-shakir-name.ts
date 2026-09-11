import { candidateProfilesCollection } from '../lib/mongodb'
import { fallbackExtractProfile, extractCandidateFromResume } from '../lib/gemini-ai'

async function main() {
  const candCol = candidateProfilesCollection()
  const cand = await candCol.findOne({ sourceFile: { $regex: /shakir/i } })
  if (!cand?.rawText) {
    console.log('No raw text found')
    return
  }

  console.log('--- Testing fallbackExtractProfile ---')
  const fallbackResult = fallbackExtractProfile(cand.rawText, cand.sourceFile || 'Shakir_Imran_Resume_Centennial_SalesforcePM.pdf')
  console.log('Fallback extracted candidate_name:', fallbackResult.candidate_name)

  console.log('--- Testing extractCandidateFromResume ---')
  const aiResult = await extractCandidateFromResume(cand.rawText, cand.sourceFile || 'Shakir_Imran_Resume_Centennial_SalesforcePM.pdf')
  console.log('AI extracted candidate_name:', aiResult.candidate_name)
}

main().catch(console.error)
