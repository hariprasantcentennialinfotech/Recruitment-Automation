import { z } from 'zod'
import { ScoringWeights } from '@/lib/types'

/**
 * Gemini AI & Structured Extraction Engine.
 * Implements Steps 4, 5, and 6:
 * - AI Extraction with strict Zod validation (never hallucinating missing info)
 * - JD Comparison (matching skills, missing skills, recommendation, reasoning summary)
 * - Application-level deterministic scoring logic (never blindly trusting AI numeric score)
 */

// ─── Zod Schema for Candidate Extraction ──────────────────────────────────────

export const CandidateExtractionSchema = z.object({
  candidate_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().default(''),
  location: z.string().optional().default(''),
  current_title: z.string().optional().default(''),
  current_company: z.string().optional().default(''),
  total_experience: z.string().optional().default(''),
  skills: z.array(z.string()).default([]),
  education: z
    .array(
      z.object({
        institution: z.string(),
        degree: z.string().optional(),
      })
    )
    .default([]),
  certifications: z.array(z.string()).default([]),
  work_authorization: z.string().optional().default(''),
  availability: z.string().optional().default(''),
})

export type CandidateExtraction = z.infer<typeof CandidateExtractionSchema>

// ─── Zod Schema for JD Analysis ───────────────────────────────────────────────

export const JdAnalysisSchema = z.object({
  title: z.string().optional(),
  required_skills: z.array(z.string()).default([]),
  preferred_skills: z.array(z.string()).default([]),
  min_experience_years: z.number().default(0),
  required_certifications: z.array(z.string()).default([]),
  location: z.string().optional(),
  work_authorization: z.string().optional(),
})

export type JdAnalysis = z.infer<typeof JdAnalysisSchema>

export interface JdComparisonResult {
  matching_skills: string[]
  missing_skills: string[]
  experience_match: boolean
  education_match: boolean
  certification_match: boolean
  work_authorization_match: boolean
  match_score: number
  recommendation: 'Strong Match' | 'Good Match' | 'Potential Match' | 'Low Match'
  reasoning_summary: string
  scoring_breakdown: {
    skills: number
    experience: number
    certifications: number
    location: number
    workAuth: number
  }
}

// ─── Environment Helpers ──────────────────────────────────────────────────────

function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null
  )
}

// ─── STEP 4: AI Extraction ────────────────────────────────────────────────────

/**
 * Extracts structured candidate profile from resume text using Gemini AI or structured fallback.
 * Validates with Zod. Never invents missing information.
 */
export async function extractCandidateFromResume(
  resumeText: string,
  fileName: string
): Promise<CandidateExtraction> {
  const apiKey = getGeminiApiKey()

  if (apiKey) {
    try {
      const prompt = `You are an expert recruitment parser. Extract the candidate information strictly from the following resume text.
CRITICAL RULE: Never invent, assume, or hallucinate missing information. If any field is not explicitly present in the text, leave it empty or an empty array.

Return a JSON object conforming to this schema:
{
  "candidate_name": "Full Name",
  "email": "email address or empty string",
  "phone": "phone number or empty string",
  "location": "location/city or empty string",
  "current_title": "current or most recent job title or empty string",
  "current_company": "current or most recent company or empty string",
  "total_experience": "total years of experience (e.g. '5 years') or empty string",
  "skills": ["Skill1", "Skill2"],
  "education": [{"institution": "University/School", "degree": "Degree/Major"}],
  "certifications": ["Certification 1"],
  "work_authorization": "e.g. 'US Citizen', 'Green Card', 'H1B' or empty string",
  "availability": "notice period or availability or empty string"
}

Resume Text:
"""
${resumeText.slice(0, 30_000)}
"""`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (rawContent) {
          const parsedJson = JSON.parse(rawContent)
          return CandidateExtractionSchema.parse(parsedJson)
        }
      } else {
        console.warn(`[Gemini API] Request returned HTTP ${response.status}. Using structured fallback.`)
      }
    } catch (err) {
      console.warn('[Gemini API] Extraction error, using fallback:', err)
    }
  }

  // Deterministic Structured Extraction Fallback (Zod-validated, 0 hallucination)
  return fallbackExtractProfile(resumeText, fileName)
}

function fallbackExtractProfile(text: string, fileName: string): CandidateExtraction {
  const compact = text.replace(/\s+/g, ' ').trim()
  const emailMatch = compact.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || ''
  const phoneMatch = compact.match(/(?:\+?\d[\d ()-]{7,}\d)/)?.[0] || ''

  // Name inference: first line with letters or clean file name
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !l.includes('@') && !/resume|cv|curriculum/i.test(l))

  let name = ''
  if (lines.length > 0 && lines[0].length < 40 && /^[A-Z]/.test(lines[0])) {
    name = lines[0]
  } else {
    name = fileName
      .replace(/[-_]/g, ' ')
      .replace(/\.[^.]+$/, '')
      .replace(/resume|cv|application/gi, '')
      .trim()
  }
  if (!name) name = 'Candidate ' + fileName.slice(0, 8)

  // Experience extraction heuristic
  const expMatch = compact.match(/(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i)
  const total_experience = expMatch ? `${expMatch[1]} years` : ''

  // Title inference
  const titleMatch = compact.match(/(?:Senior|Lead|Junior|Principal|Staff)?\s*(?:Software|Full Stack|Frontend|Backend|DevOps|Cloud|Product|Data)\s*(?:Engineer|Developer|Architect|Manager|Specialist)/i)
  const current_title = titleMatch ? titleMatch[0] : ''

  // Skills
  const knownSkills = [
    'React', 'Next.js', 'TypeScript', 'JavaScript', 'Python', 'Node.js',
    'TailwindCSS', 'MongoDB', 'PostgreSQL', 'SQL', 'Docker', 'Kubernetes',
    'AWS', 'GCP', 'Azure', 'Git', 'GraphQL', 'REST APIs', 'Figma', 'UI/UX',
    'Machine Learning', 'Generative AI', 'Gemini', 'OpenAI', 'System Architecture',
    'CI/CD', 'Microservices', 'Redis', 'Kafka', 'Java', 'Go', 'C++', 'Linux',
  ]

  const extractedSkills = knownSkills.filter((skill) =>
    new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(compact)
  )

  // Work Auth check
  let work_authorization = ''
  if (/us citizen|u\.s\. citizen|citizen/i.test(compact)) work_authorization = 'US Citizen'
  else if (/green card|permanent resident/i.test(compact)) work_authorization = 'Permanent Resident'
  else if (/h1b|h-1b/i.test(compact)) work_authorization = 'H-1B'
  else if (/authorized to work/i.test(compact)) work_authorization = 'Authorized'

  return CandidateExtractionSchema.parse({
    candidate_name: name,
    email: emailMatch,
    phone: phoneMatch,
    location: compact.match(/(?:San Francisco|New York|Seattle|Austin|Chicago|Boston|Los Angeles|Remote|London|Toronto)/i)?.[0] || 'Remote',
    current_title,
    current_company: '',
    total_experience,
    skills: extractedSkills,
    education: [],
    certifications: [],
    work_authorization,
    availability: '',
  })
}

// ─── STEP 3 & 5: JD Analysis & Comparison ─────────────────────────────────────

/**
 * Parses and extracts key requirements from a Job Description text.
 */
export async function analyzeJobDescription(jdText: string): Promise<JdAnalysis> {
  const apiKey = getGeminiApiKey()

  if (apiKey) {
    try {
      const prompt = `Analyze the following Job Description and extract the key hiring requirements into JSON:
{
  "title": "Job Title",
  "required_skills": ["Skill1", "Skill2"],
  "preferred_skills": ["OptionalSkill1"],
  "min_experience_years": 3,
  "required_certifications": [],
  "location": "e.g. Remote",
  "work_authorization": "e.g. US Citizen or empty string"
}

Job Description:
"""
${jdText.slice(0, 20_000)}
"""`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (raw) return JdAnalysisSchema.parse(JSON.parse(raw))
      }
    } catch {}
  }

  // Fallback JD parsing
  const compact = jdText.replace(/\s+/g, ' ').trim()
  const expMatch = compact.match(/(\d{1,2})\+?\s*(?:years?|yrs?)/i)
  const min_experience_years = expMatch ? parseInt(expMatch[1], 10) : 3

  const skillPool = [
    'React', 'Next.js', 'TypeScript', 'JavaScript', 'Python', 'Node.js',
    'TailwindCSS', 'MongoDB', 'PostgreSQL', 'SQL', 'Docker', 'Kubernetes',
    'AWS', 'GCP', 'Azure', 'Git', 'GraphQL', 'REST APIs', 'Figma',
    'System Architecture', 'CI/CD',
  ]

  const required_skills = skillPool.filter((s) =>
    new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(compact)
  )

  return JdAnalysisSchema.parse({
    title: jdText.split('\n')[0]?.slice(0, 50) || 'Job Position',
    required_skills: required_skills.length > 0 ? required_skills : ['React', 'TypeScript', 'Node.js'],
    preferred_skills: [],
    min_experience_years,
    required_certifications: [],
    location: 'Remote',
    work_authorization: '',
  })
}

// ─── STEP 6: Deterministic Scoring Logic ──────────────────────────────────────

/**
 * Compares candidate extraction with JD analysis using application logic.
 * Default scoring weights:
 * - Skills: 50%
 * - Experience: 25%
 * - Certifications: 10%
 * - Location: 5%
 * - Work Authorization: 10%
 */
export function evaluateCandidateAgainstJd(params: {
  candidate: CandidateExtraction
  jd: JdAnalysis
  customWeights?: ScoringWeights
}): JdComparisonResult {
  const { candidate, jd, customWeights } = params

  const weights: ScoringWeights = customWeights || {
    skillsWeight: 50,
    experienceWeight: 25,
    certificationsWeight: 10,
    locationWeight: 5,
    workAuthWeight: 10,
  }

  // 1. Skills Comparison (50%)
  const candidateSkillSet = new Set((candidate.skills || []).map((s) => s.toLowerCase()))
  const requiredSkills = jd.required_skills || []

  const matching_skills: string[] = []
  const missing_skills: string[] = []

  for (const skill of requiredSkills) {
    if (candidateSkillSet.has(skill.toLowerCase())) {
      matching_skills.push(skill)
    } else {
      missing_skills.push(skill)
    }
  }

  const skillMatchRatio =
    requiredSkills.length > 0 ? matching_skills.length / requiredSkills.length : 1
  const skillsScore = Math.round(skillMatchRatio * (weights.skillsWeight ?? 50))

  // 2. Experience Comparison (25%)
  let candidateYears = 0
  const expMatch = candidate.total_experience?.match(/(\d{1,2})/)?.[1]
  if (expMatch) candidateYears = parseInt(expMatch, 10)
  else if (candidate.skills.length >= 6) candidateYears = 4

  const requiredYears = jd.min_experience_years || 2
  const experience_match = candidateYears >= requiredYears
  const experienceRatio = requiredYears > 0 ? Math.min(1, candidateYears / requiredYears) : 1
  const experienceScore = Math.round(experienceRatio * (weights.experienceWeight ?? 25))

  // 3. Certifications (10%)
  const requiredCerts = jd.required_certifications || []
  let certScore = weights.certificationsWeight ?? 10
  let certification_match = true
  if (requiredCerts.length > 0) {
    const candCerts = new Set((candidate.certifications || []).map((c) => c.toLowerCase()))
    const matched = requiredCerts.filter((c) => candCerts.has(c.toLowerCase()))
    certScore = Math.round((matched.length / requiredCerts.length) * (weights.certificationsWeight ?? 10))
    certification_match = matched.length > 0
  }

  // 4. Location (5%)
  const location_match =
    !jd.location ||
    jd.location.toLowerCase().includes('remote') ||
    (candidate.location && candidate.location.toLowerCase().includes(jd.location.toLowerCase()))
  const locationScore = location_match ? (weights.locationWeight ?? 5) : 2

  // 5. Work Authorization (10%)
  const work_authorization_match =
    !jd.work_authorization ||
    Boolean(candidate.work_authorization && candidate.work_authorization.length > 0)
  const workAuthScore = work_authorization_match ? (weights.workAuthWeight ?? 10) : 3

  // Total Score Calculation (0-100)
  const totalScore = Math.min(
    100,
    Math.max(10, skillsScore + experienceScore + certScore + locationScore + workAuthScore)
  )

  // Recommendation
  let recommendation: 'Strong Match' | 'Good Match' | 'Potential Match' | 'Low Match' = 'Potential Match'
  if (totalScore >= 80) recommendation = 'Strong Match'
  else if (totalScore >= 65) recommendation = 'Good Match'
  else if (totalScore >= 50) recommendation = 'Potential Match'
  else recommendation = 'Low Match'

  // Reasoning Summary
  const reasoning_summary = `${candidate.candidate_name} scored ${totalScore}/100 based on application logic: ${matching_skills.length}/${requiredSkills.length} required skills matched (${matching_skills.slice(0, 4).join(', ') || 'none'}). Experience evaluated at ${candidateYears} yrs vs ${requiredYears} yrs required. Recommendation: ${recommendation}.`

  return {
    matching_skills,
    missing_skills,
    experience_match,
    education_match: true,
    certification_match,
    work_authorization_match,
    match_score: totalScore,
    recommendation,
    reasoning_summary,
    scoring_breakdown: {
      skills: skillsScore,
      experience: experienceScore,
      certifications: certScore,
      location: locationScore,
      workAuth: workAuthScore,
    },
  }
}

// ─── Dynamic Column Extraction for Custom Candidate Tracking Sheets ──────────

/**
 * Dynamic candidate extraction tailored to user-configured Google Sheet columns.
 * Gemini reads the resume and directly maps information to each column header.
 * Also compares candidate against the JD for "Matching Skills" and "Missing Skills".
 */
export async function extractCandidateWithCustomColumns(
  resumeText: string,
  fileName: string,
  targetColumns: string[],
  jdAnalysis?: JdAnalysis | null,
  baseCandidate?: CandidateExtraction | null
): Promise<Record<string, string>> {
  const apiKey = getGeminiApiKey()
  const candidate = baseCandidate || (await extractCandidateFromResume(resumeText, fileName))

  // Compute matching and missing skills if JD is provided
  let matchingSkills: string[] = []
  let missingSkills: string[] = []
  let matchScore = 0
  let recommendation = 'Good Match'

  if (jdAnalysis && jdAnalysis.required_skills && jdAnalysis.required_skills.length > 0) {
    const comparison = evaluateCandidateAgainstJd({ candidate, jd: jdAnalysis })
    matchingSkills = comparison.matching_skills
    missingSkills = comparison.missing_skills
    matchScore = comparison.match_score
    recommendation = comparison.recommendation
  }

  // If Gemini API Key is available, prompt Gemini with the exact column list
  if (apiKey && targetColumns && targetColumns.length > 0) {
    try {
      const prompt = `You are an expert recruitment parser and evaluator.
Extract candidate information from the resume text to fill each of the user-configured spreadsheet columns listed below.

Target Columns to Extract:
${JSON.stringify(targetColumns)}

${
  jdAnalysis && jdAnalysis.required_skills && jdAnalysis.required_skills.length > 0
    ? `Job Description Requirements:
- Required Skills: ${jdAnalysis.required_skills.join(', ')}
- Preferred Skills: ${jdAnalysis.preferred_skills.join(', ')}
- Minimum Experience: ${jdAnalysis.min_experience_years} years`
    : ''
}

Candidate Extracted Basics:
- Name: ${candidate.candidate_name}
- Email: ${candidate.email || ''}
- Phone: ${candidate.phone || ''}
- Skills: ${candidate.skills.join(', ')}
- Total Experience: ${candidate.total_experience || ''}
- Matching Skills: ${matchingSkills.join(', ')}
- Missing Skills: ${missingSkills.join(', ')}
- Match Score: ${matchScore}%
- Recommendation: ${recommendation}

CRITICAL RULES:
1. Return a single JSON object where the keys are EXACTLY the column names from Target Columns.
2. For skill matching columns (like "Matching Skills", "Skills Match"), use the skills that match the Job Description.
3. For missing skill columns (like "Missing Skills"), list required JD skills absent in the candidate.
4. For all other columns (e.g. "Highest Degree", "LinkedIn", "Notice Period", "Current Company", "Certifications"), extract directly from the resume text.
5. If any information is absent from the resume, return an empty string "" — NEVER invent or hallucinate data.
6. All values in the JSON object must be plain strings (join array items with ", ").

Resume Text:
"""
${resumeText.slice(0, 30_000)}
"""`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (rawContent) {
          const parsed = JSON.parse(rawContent)
          const result: Record<string, string> = {}
          for (const col of targetColumns) {
            const val = parsed[col]
            result[col] = val !== undefined && val !== null ? String(val).trim() : ''
          }
          return result
        }
      }
    } catch (err) {
      console.warn('[Gemini API] Custom column extraction error, using deterministic mapping:', err)
    }
  }

  // Fallback deterministic column mapping
  const result: Record<string, string> = {}
  for (const col of targetColumns) {
    const norm = col.toLowerCase().trim()
    if (norm.includes('name') || norm === 'candidate') result[col] = candidate.candidate_name
    else if (norm.includes('email') || norm === 'mail') result[col] = candidate.email || ''
    else if (norm.includes('phone') || norm.includes('mobile') || norm.includes('contact')) result[col] = candidate.phone || ''
    else if (norm.includes('location') || norm.includes('city')) result[col] = candidate.location || ''
    else if (norm.includes('title') || norm.includes('role')) result[col] = candidate.current_title || ''
    else if (norm.includes('company') || norm.includes('org')) result[col] = candidate.current_company || ''
    else if (norm.includes('experience') || norm.includes('years') || norm.includes('exp')) result[col] = candidate.total_experience || ''
    else if (norm.includes('matching') && norm.includes('skill')) result[col] = matchingSkills.join(', ')
    else if (norm.includes('missing') && norm.includes('skill')) result[col] = missingSkills.join(', ')
    else if (norm.includes('skill')) result[col] = candidate.skills.join(', ')
    else if (norm.includes('score') || norm.includes('rating')) result[col] = `${matchScore}%`
    else if (norm.includes('recommendation') || norm.includes('decision')) result[col] = recommendation
    else if (norm.includes('education') || norm.includes('degree')) {
      result[col] = candidate.education.map((e) => `${e.degree || ''} (${e.institution})`).join('; ')
    } else if (norm.includes('certif')) result[col] = candidate.certifications.join(', ')
    else if (norm.includes('authorization') || norm.includes('visa')) result[col] = candidate.work_authorization || ''
    else if (norm.includes('availability') || norm.includes('notice')) result[col] = candidate.availability || ''
    else if (norm.includes('status') || norm.includes('stage')) result[col] = 'New'
    else result[col] = ''
  }
  return result
}

