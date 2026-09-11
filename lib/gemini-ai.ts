import { z } from 'zod'
import { ScoringWeights } from '@/lib/types'
import { recordModelUsage } from '@/lib/model-usage-logger'

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
    const prompt = `You are an expert recruitment parser. Extract ONLY information that is clearly present as human-readable contact/profile data in the resume below.

STRICT RULES — MUST FOLLOW:
1. candidate_name: Extract the person's full name. It must be a real human name (2+ words, only letters/spaces/hyphens). DO NOT use file IDs, numbers, timestamps, email addresses, or generic words like "Resume" or "Curriculum Vitae".
2. email: Must match a valid email pattern (contains @ and a domain). Look closely at header/contact lines. Only return empty string if not found.
3. phone: Extract the candidate's phone/mobile number. Keep all valid international and domestic formats (e.g. +1 555-123-4567, (650) 215-2369, +91 98765 43210, +44 7911 123456, or 10-digit mobile). NEVER omit the phone number if visible in the header or contact section. NEVER return page dimensions, timestamps, or file sizes.
4. location: The candidate's city, state, and/or country or address (e.g., "Seattle, WA", "Bangalore, India", "Austin, TX", "London, UK", or full street address). Look at the top contact section.
5. current_title: The person's job title or profession (e.g. "Software Engineer", "DevOps Engineer", "UI/UX Designer"). NOT metadata or keywords.
6. total_experience: A number followed by "years" (e.g. "7 years", "10+ years"). Return empty string if not explicitly stated.
7. skills: Only real technical or professional skills explicitly mentioned. Max 20 skills.
8. NEVER invent, assume, or hallucinate missing information. Return empty string or empty array for any field not clearly present.

Return ONLY a valid JSON object with exactly these keys:
{
  "candidate_name": "Full Name",
  "email": "email@example.com or empty string",
  "phone": "phone number in readable format or empty string",
  "location": "City, State or Country or empty string",
  "current_title": "Job Title or empty string",
  "current_company": "Company Name or empty string",
  "total_experience": "X years or empty string",
  "skills": ["Skill1", "Skill2"],
  "education": [{"institution": "University", "degree": "Degree"}],
  "certifications": ["Certification"],
  "work_authorization": "US Citizen / Green Card / H-1B / OPT / TN / Authorized / empty string",
  "availability": "Immediate / 2 weeks / X weeks / empty string"
}

Resume Text:
"""
${resumeText.slice(0, 28_000)}
"""`

    // Try multiple Gemini model names for resilience
    const models = [
      'gemini-flash-latest',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
    ]

    for (const model of models) {
      const startTime = Date.now()
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(12000),
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.05,
              },
            }),
          }
        )
        const durationMs = Date.now() - startTime

        if (response.ok) {
          const data = await response.json()
          recordModelUsage({
            model,
            operation: 'candidate_extraction',
            statusCode: 200,
            durationMs,
            usageMetadata: data.usageMetadata,
          })

          const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (rawContent) {
            try {
              const parsedJson = JSON.parse(rawContent)
              const validated = CandidateExtractionSchema.parse(parsedJson)
              // Sanity check: reject if name looks like a file ID/timestamp or resume section header
              const name = validated.candidate_name || ''
              const isSectionHeader = /highlight|qualification|summary|competenc|experience|education|skill|certif|responsibilit|accomplish|overview|employ|history|background|reference|award|interest|activit|declaration|technical|leadership|career/i.test(name)
              if (name && !/^\d+$/.test(name) && !isSectionHeader && name.length > 2 && name.length < 80) {
                return validated
              }
            } catch {
              // JSON parse or Zod error — try next model
            }
          }
        } else {
          recordModelUsage({
            model,
            operation: 'candidate_extraction',
            statusCode: response.status,
            durationMs,
            errorMessage: `HTTP ${response.status}`,
          })
          if (response.status === 429 || response.status === 503) {
            console.warn(`[Gemini] Model ${model} overloaded (${response.status}), trying next...`)
          } else {
            console.warn(`[Gemini] Model ${model} returned HTTP ${response.status}, trying next...`)
          }
          continue
        }
      } catch (err: any) {
        const durationMs = Date.now() - startTime
        recordModelUsage({
          model,
          operation: 'candidate_extraction',
          statusCode: 0,
          durationMs,
          errorMessage: err.message || 'Network error',
        })
        console.warn(`[Gemini] Model ${model} failed:`, err)
      }
    }
  }

  // Deterministic Structured Extraction Fallback (Zod-validated, 0 hallucination)
  return fallbackExtractProfile(resumeText, fileName)
}

/**
 * Multimodal extraction directly from a PDF Buffer using Gemini.
 * Used when local text extraction cannot extract text (e.g. scanned image PDFs, complex font encodings).
 */
export async function extractCandidateFromPdfBuffer(
  pdfBuffer: Buffer,
  fileName: string
): Promise<CandidateExtraction | null> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return null

  const base64Data = pdfBuffer.toString('base64')
  const prompt = `You are an expert recruitment parser. Extract ONLY information that is clearly present as human-readable contact/profile data from this resume PDF.

STRICT RULES — MUST FOLLOW:
1. candidate_name: Extract the person's full name. It must be a real human name (2+ words, only letters/spaces/hyphens). DO NOT use file IDs, numbers, timestamps, email addresses, or generic words like "Resume".
2. email: Must match a valid email pattern (contains @ and a domain). Only return empty string if not found.
3. phone: Must be a real phone number in standard format (e.g. +1 555-123-4567, (650) 215-2369). Return empty string if unclear.
4. location: A city, state, or country name. Not an ID or code.
5. current_title: The person's job title or profession (e.g. "Software Engineer", "DevOps Engineer").
6. current_company: Company name or empty string.
7. total_experience: e.g. "5 years", "10+ years" or empty string.
8. skills: Array of actual skills mentioned. Max 20 skills.
9. education: Array of { institution, degree }.
10. certifications: Array of certification names.
11. work_authorization: e.g. "US Citizen", "Green Card", "H-1B" or empty string.
12. availability: e.g. "Immediate", "2 weeks" or empty string.
13. NEVER invent or hallucinate missing info. Return empty string or array if not present.

Return ONLY a valid JSON object matching these keys.`

  const models = [
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
  ]

  for (const model of models) {
    const startTime = Date.now()
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: 'application/pdf',
                      data: base64Data,
                    },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.05,
            },
          }),
        }
      )
      const durationMs = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()
        recordModelUsage({
          model,
          operation: 'pdf_multimodal_extraction',
          statusCode: 200,
          durationMs,
          usageMetadata: data.usageMetadata,
        })

        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (rawContent) {
          try {
            const parsed = JSON.parse(rawContent)
            const validated = CandidateExtractionSchema.parse(parsed)
            if (validated.candidate_name && !/^\d+$/.test(validated.candidate_name)) {
              return validated
            }
          } catch {
            // parsing error, try next model
          }
        }
      } else {
        recordModelUsage({
          model,
          operation: 'pdf_multimodal_extraction',
          statusCode: response.status,
          durationMs,
          errorMessage: `HTTP ${response.status}`,
        })
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime
      recordModelUsage({
        model,
        operation: 'pdf_multimodal_extraction',
        statusCode: 0,
        durationMs,
        errorMessage: err.message || 'Network error',
      })
      console.warn(`[Gemini Multimodal] Model ${model} failed for ${fileName}:`, err)
    }
  }

  return null
}

export function fallbackExtractProfile(text: string, fileName: string): CandidateExtraction {
  const compact = text.replace(/\s+/g, ' ').trim()
  const emailMatch = compact.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || ''

  // Phone: look for international formats (+1, +91, +44, etc.), US formats, or domestic 10-digit numbers
  // Must contain between 7 and 15 digits, and not look like a timestamp or years (e.g. 2020-2024)
  let phoneMatch = ''
  const phoneCandidates = compact.matchAll(/(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}(?:\s*(?:ext|x)[\s.]*\d{1,5})?/g)
  for (const m of phoneCandidates) {
    const raw = m[0]?.trim() || ''
    const digitsOnly = raw.replace(/\D/g, '')
    if (
      digitsOnly.length >= 7 &&
      digitsOnly.length <= 15 &&
      !/^(?:19|20)\d{2}/.test(digitsOnly) &&
      !digitsOnly.startsWith('0000')
    ) {
      phoneMatch = raw.replace(/[^\d+() -]/g, '').trim()
      break
    }
  }

  // Name inference: must look like a real person's name (only letters, 2–4 capitalized words)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) =>
      l.length > 2 &&
      l.length < 60 &&
      !l.includes('@') &&
      !l.includes('|') &&
      !/^[\d\s.,%/\\]+$/.test(l) && // skip lines that are only numbers/symbols
      !/resume|cv|curriculum|page|objective|summary|skills|experience|education|competenc|profile|project|certif|highlight|qualification|responsibilit|accomplish|overview|employ|history|background|reference|award|interest|activit|declaration|technical|leadership|career/i.test(l) &&
      /[a-zA-Z]/.test(l)
    )

  let name = ''
  for (const rawLine of lines.slice(0, 8)) {
    // Strip trailing credentials in parentheses or after comma, e.g. "Shakir Imran (PMP, ...)" -> "Shakir Imran"
    const cleaned = rawLine
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/,\s*(?:PMP|SAFe|PSM|ITIL|MBA|CPA|PhD|MD|BSc|MSc|CSM|AWS|GCP|CISSP|CISA|PRINCE2|P\.Eng).*$/i, '')
      .trim()

    // Accept line as a name if it looks like "First Last" (2-4 capitalized words)
    if (/^[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3}$/.test(cleaned)) {
      const isAllUpper = cleaned === cleaned.toUpperCase()
      const isHeaderWord = /QUALIFICATION|HIGHLIGHT|EXPERIENCE|SUMMARY|SKILLS|EDUCATION|CERTIFICATE|MANAGEMENT|PROJECT|DEVELOPER|ENGINEER/i.test(cleaned)
      if (!isAllUpper || !isHeaderWord) {
        name = cleaned
        break
      }
    }
  }

  // If not found in text, check beginning of filename (e.g. "Shakir_Imran_Resume...")
  if (!name) {
    const fileBase = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    const nameMatch = fileBase.match(/^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,2})/)
    if (nameMatch && !/resume|cv|candidate|application/i.test(nameMatch[1])) {
      name = nameMatch[1].trim()
    }
  }

  if (!name) {
    // Fall back to the file name (cleaned up)
    name = fileName
      .replace(/[-_]/g, ' ')
      .replace(/\.[^.]+$/, '')
      .replace(/resume|cv|application|\d{4,}/gi, '')
      .replace(/[(0-9)]+/g, '')
      .trim()
  }

  if (!name || /^[\d\s()._-]+$/.test(name) || name.length < 3) {
    if (emailMatch) {
      const emailPrefix = emailMatch.split('@')[0].replace(/[\d._-]+/g, ' ').trim()
      if (emailPrefix.length >= 3) {
        name = emailPrefix.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      }
    }
  }

  if (!name || /^[\d\s()._-]+$/.test(name) || name.length < 3) name = 'Candidate'

  // Experience extraction heuristic
  const expMatch = compact.match(/(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i)
  const total_experience = expMatch ? `${expMatch[1]} years` : ''

  // Title inference — look for common title patterns
  const titleMatch = compact.match(
    /(?:Senior\s+|Lead\s+|Junior\s+|Principal\s+|Staff\s+|Sr\.?\s+|Jr\.?\s+)?(?:Software|Full[- ]Stack|Frontend|Backend|DevOps|Cloud|Product|Data|QA|Network|Security|Systems?|IT|Web|Mobile|UI\/UX|UX\/UI|Visual|Product Designer)\s*(?:Engineer(?:ing)?|Developer|Architect|Manager|Analyst|Specialist|Administrator|Consultant|Technician|Designer)/i
  )
  const current_title = titleMatch ? titleMatch[0].trim() : ''

  // Skills
  const knownSkills = [
    'React', 'Next.js', 'TypeScript', 'JavaScript', 'Python', 'Node.js',
    'TailwindCSS', 'MongoDB', 'PostgreSQL', 'SQL', 'Docker', 'Kubernetes',
    'AWS', 'GCP', 'Azure', 'Git', 'GraphQL', 'REST APIs', 'Figma', 'UI/UX',
    'Machine Learning', 'Generative AI', 'OpenAI', 'System Architecture',
    'CI/CD', 'Microservices', 'Redis', 'Kafka', 'Java', 'Go', 'C++', 'Linux',
    'VMware', 'Hyper-V', 'vSphere', 'Virtualization', 'Networking', 'CCNA', 'CCNP',
    'Active Directory', 'Azure Active Directory', 'Office 365', 'PowerShell',
    'Terraform', 'Ansible', 'Jenkins', 'Windows Server', 'RHEL', 'Ubuntu',
    'Design Systems', 'Wireframing', 'Prototyping', 'User Research', 'Sketch',
    'Adobe XD', 'InVision', 'Interaction Design', 'Visual Design',
  ]

  const extractedSkills = knownSkills.filter((skill) =>
    new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(compact)
  )

  // Work Auth check
  let work_authorization = ''
  if (/\bus citizen\b|u\.s\. citizen/i.test(compact)) work_authorization = 'US Citizen'
  else if (/green card|permanent resident/i.test(compact)) work_authorization = 'Permanent Resident'
  else if (/h-?1b\b/i.test(compact)) work_authorization = 'H-1B'
  else if (/\bopt\b/i.test(compact)) work_authorization = 'OPT'
  else if (/authorized to work/i.test(compact)) work_authorization = 'Authorized'

  // Location / Address heuristic — look for "City, State", "City, Country", zip codes, or known locations
  const US_STATES = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC'
  const CAN_PROV = 'AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT|Ontario|Quebec|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick'
  const addressPatterns = [
    new RegExp(`\\b([A-Z][a-zA-Z\\s.-]{2,30},\\s*(?:${US_STATES}|${CAN_PROV}|USA|US|India|UK|United Kingdom|Canada|Australia))\\b`),
    /\b(?:San Francisco|New York|Seattle|Austin|Chicago|Boston|Los Angeles|San Jose|Dallas|Atlanta|Houston|Phoenix|Denver|Miami|Raleigh|San Diego|Portland|Washington|Philadelphia|Charlotte|Detroit|Minneapolis|Orlando|Tampa|Pittsburgh|Columbus|Indianapolis|Nashville|Salt Lake City)\b/i,
    /\b(?:Hyderabad|Bangalore|Bengaluru|Chennai|Mumbai|Delhi|New Delhi|Pune|Noida|Gurgaon|Gurugram|Kolkata|Ahmedabad|Jaipur|Kochi|Coimbatore)\b/i,
    /\b(?:London|Toronto|Vancouver|Montreal|Sydney|Melbourne|Singapore|Berlin|Paris|Dubai)\b/i,
    /\b(?:Remote)\b/i,
  ]
  let location = ''
  for (const pat of addressPatterns) {
    const m = compact.match(pat)
    if (m) {
      // Ignore if matched text looks like technical terms (e.g. AI)
      if (/\b(?:AI|IT|ML|QA|UI|UX|PM)\b/.test(m[0])) continue
      let loc = m[0].trim()
      const commaIdx = loc.lastIndexOf(',')
      if (commaIdx > 0) {
        const cityPart = loc.slice(0, commaIdx).trim()
        const statePart = loc.slice(commaIdx + 1).trim()
        const cityWords = cityPart.split(/\s+/)
        // Take at most 2 words for city name (e.g. Toronto, San Francisco, New York)
        const cleanCity = cityWords.slice(-2).join(' ')
        loc = `${cleanCity}, ${statePart}`
      }
      location = loc
      break
    }
  }

  return CandidateExtractionSchema.parse({
    candidate_name: name,
    email: emailMatch,
    phone: phoneMatch,
    location,
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

      const startTime = Date.now()
      const model = 'gemini-3.6-flash'
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
        }
      )
      const durationMs = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()
        recordModelUsage({
          model,
          operation: 'jd_analysis',
          statusCode: 200,
          durationMs,
          usageMetadata: data.usageMetadata,
        })
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (raw) return JdAnalysisSchema.parse(JSON.parse(raw))
      } else {
        recordModelUsage({
          model,
          operation: 'jd_analysis',
          statusCode: response.status,
          durationMs,
          errorMessage: `HTTP ${response.status}`,
        })
      }
    } catch (err: any) {
      recordModelUsage({
        model: 'gemini-3.6-flash',
        operation: 'jd_analysis',
        statusCode: 0,
        durationMs: 0,
        errorMessage: err.message || 'Error',
      })
    }
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

      const models = [
        'gemini-flash-latest',
        'gemini-3.7-flash',
        'gemini-3.8-flash',
        'gemini-3.5-flash',
        'gemini-3.6-flash',
      ]

      for (const model of models) {
        const startTime = Date.now()
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(12000),
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.1,
                },
              }),
            }
          )
          const durationMs = Date.now() - startTime

          if (response.ok) {
            const data = await response.json()
            recordModelUsage({
              model,
              operation: 'custom_column_extraction',
              statusCode: 200,
              durationMs,
              usageMetadata: data.usageMetadata,
            })

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
          } else {
            recordModelUsage({
              model,
              operation: 'custom_column_extraction',
              statusCode: response.status,
              durationMs,
              errorMessage: `HTTP ${response.status}`,
            })
          }
        } catch (err: any) {
          const durationMs = Date.now() - startTime
          recordModelUsage({
            model,
            operation: 'custom_column_extraction',
            statusCode: 0,
            durationMs,
            errorMessage: err.message || 'Error',
          })
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
    else if (norm.includes('location') || norm.includes('city') || norm.includes('address')) result[col] = candidate.location || ''
    else if (norm.includes('title') || norm.includes('role')) result[col] = candidate.current_title || ''
    else if (norm.includes('company') || norm.includes('org')) result[col] = candidate.current_company || ''
    else if (norm.includes('experience') || norm.includes('years') || norm.includes('exp')) result[col] = candidate.total_experience || ''
    else if (
      norm.includes('missed') ||
      norm.includes('missing') ||
      norm.includes('gap') ||
      norm.includes('lacking')
    ) {
      result[col] = missingSkills.join(', ') || 'None'
    } else if (norm.includes('matching') && norm.includes('skill')) result[col] = matchingSkills.join(', ')
    else if (norm.includes('skill')) result[col] = candidate.skills.join(', ')
    else if (norm.includes('score') || norm.includes('rating')) result[col] = `${matchScore}%`
    else if (norm.includes('recommendation') || norm.includes('decision')) result[col] = recommendation
    else if (norm.includes('education') || norm.includes('degree')) {
      result[col] = candidate.education.map((e) => `${e.degree || ''} (${e.institution})`).join('; ')
    } else if (norm.includes('certif')) result[col] = candidate.certifications.join(', ')
    else if (norm.includes('authorization') || norm.includes('visa') || norm.includes('viza')) result[col] = candidate.work_authorization || ''
    else if (norm.includes('availability') || norm.includes('notice')) result[col] = candidate.availability || ''
    else if (norm.includes('status') || norm.includes('stage')) result[col] = 'New'
    else result[col] = ''
  }
  return result
}

