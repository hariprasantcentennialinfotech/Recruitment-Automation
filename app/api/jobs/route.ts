import { NextResponse } from 'next/server'
import { jobsCollection, activitiesCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'

export async function GET(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const collection = jobsCollection()
    const jobs = await collection
      .find({ organization })
      .sort({ createdAt: -1 })
      .toArray()

    const formatted = jobs.map((job) => ({
      id: job._id.toString(),
      organization: job.organization,
      title: job.title,
      team: job.team || 'General',
      location: job.location || 'Remote',
      status: job.status || 'Open',
      skills: job.skills || [],
      description: job.description || '',
      applicants: job.applicants || 0,
      updated: job.updatedAt ? new Date(job.updatedAt).toLocaleDateString() : 'Recently',
      createdAt: job.createdAt,
    }))

    return NextResponse.json({ jobs: formatted })
  } catch (error: any) {
    console.error('Failed to get jobs:', error)
    return NextResponse.json({ jobs: [] })
  }
}

export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const body = await req.json()
    const { title, team, location, status = 'Open', skills = [], description = '' } = body

    if (!title) {
      return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
    }

    const newJob = {
      organization,
      title: title.trim(),
      team: (team || 'General').trim(),
      location: (location || 'Remote').trim(),
      status,
      skills: Array.isArray(skills) ? skills : [],
      description: (description || '').trim(),
      applicants: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const jobsCol = jobsCollection()
    const result = await jobsCol.insertOne(newJob as any)
    const jobId = result.insertedId.toString()

    // Log to activities
    try {
      const actCol = activitiesCollection()
      await actCol.insertOne({
        organization,
        title: 'Job posting created',
        detail: `${newJob.title} · ${newJob.team}`,
        type: 'job_created',
        createdAt: new Date(),
      } as any)
    } catch {}

    return NextResponse.json({
      success: true,
      job: { id: jobId, ...newJob, updated: 'Just now' },
    })
  } catch (error: any) {
    console.error('Failed to create job:', error)
    return NextResponse.json({ error: error.message || 'Failed to create job' }, { status: 500 })
  }
}
