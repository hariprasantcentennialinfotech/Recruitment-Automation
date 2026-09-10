import dotenv from 'dotenv'
dotenv.config()
import { extractCandidateFromResume, analyzeJobDescription } from '../lib/gemini-ai'

async function testGemini() {
  console.log('Testing Gemini API key connection...')
  console.log('Key detected:', !!process.env.GEMINI_API_KEY)

  const sampleResume = `Jane Doe
jane.doe@example.com · +1 555-0192 · Boston, MA
Senior Cloud Architect with 7 years of experience in AWS, Kubernetes, Terraform, and Docker.
Current Position: Lead DevOps Engineer at CloudScale
Education: B.S. in Computer Science, MIT
Certifications: AWS Solutions Architect Professional`

  const candidate = await extractCandidateFromResume(sampleResume, 'jane_resume.pdf')
  console.log('Extracted Candidate:', JSON.stringify(candidate, null, 2))

  const sampleJd = `Senior Cloud Architect
Requirements:
- 5+ years of AWS and Kubernetes experience
- Strong background in Terraform and CI/CD
- Location: Boston or Remote`

  const jd = await analyzeJobDescription(sampleJd)
  console.log('Analyzed JD:', JSON.stringify(jd, null, 2))

  console.log('SUCCESS: Gemini AI is fully connected and operational!')
  process.exit(0)
}

testGemini().catch((err) => {
  console.error('Gemini test failed:', err)
  process.exit(1)
})
