import { NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { z } from 'zod'
import { candidateProfilesCollection } from '@/lib/mongodb'

export const runtime = 'nodejs'

const CandidateProfileSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experience: z.array(z.object({ company: z.string(), title: z.string(), period: z.string().optional() })).default([]),
  education: z.array(z.object({ institution: z.string(), degree: z.string().optional() })).default([]),
  sourceFile: z.string(),
  extractionProvider: z.enum(['gemini', 'structured-fallback']),
})

function inferProfile(text: string, sourceFile: string) {
  const compact = text.replace(/\s+/g, ' ').trim()
  const email = compact.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? ''
  const phone = compact.match(/(?:\+?\d[\d ()-]{7,}\d)/)?.[0]
  const name = compact.split(/\n| · | - /)[0]?.trim() || sourceFile.replace(/[-_].*/, '').replace(/\.[^.]+$/, '')
  const knownSkills = ['React', 'TypeScript', 'JavaScript', 'Python', 'Figma', 'Node.js', 'SQL', 'Product strategy', 'User research', 'Leadership']
  const skills = knownSkills.filter((skill) => compact.toLowerCase().includes(skill.toLowerCase()))
  return CandidateProfileSchema.parse({ fullName: name, email, phone, summary: compact.slice(0, 420), skills, experience: [], education: [], sourceFile, extractionProvider: 'structured-fallback' })
}

async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  if (file.name.toLowerCase().endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }
  return buffer.toString('utf8')
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const organization = String(formData.get('organization') ?? 'Northstar Labs')
    if (!(file instanceof File)) return NextResponse.json({ error: 'A resume file is required.' }, { status: 400 })
    if (!/\.(pdf|docx|doc|txt)$/i.test(file.name)) return NextResponse.json({ error: 'Only PDF, DOCX, DOC, or TXT files are supported.' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Files must be smaller than 10 MB.' }, { status: 400 })

    const text = await extractText(file)
    const profile = inferProfile(text, file.name)
    const collection = candidateProfilesCollection()
    const document = { organization, ...profile, rawText: text.slice(0, 100_000), createdAt: new Date(), updatedAt: new Date() }
    const result = await collection.insertOne(document)
    return NextResponse.json({ id: result.insertedId.toString(), profile })
  } catch (error) {
    console.error('[v0] Candidate extraction failed:', error)
    return NextResponse.json({ error: 'Candidate extraction could not be completed.' }, { status: 500 })
  }
}
