import { NextResponse } from 'next/server'
import { clientsCollection, candidateProfilesCollection, jobsCollection } from '@/lib/mongodb'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'

export async function GET(req: Request) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const clientsCol = clientsCollection()
    const candidatesCol = candidateProfilesCollection()
    const jobsCol = jobsCollection()

    const clients = await clientsCol.find({}).toArray()
    const totalCandidatesCount = await candidatesCol.countDocuments()
    const totalJobsCount = await jobsCol.countDocuments()

    const totalClients = clients.length
    const activeClients = clients.filter((c) => c.status === 'Active').length
    const trialClients = clients.filter((c) => c.status === 'Trial').length

    const monthlyRevenue = clients.reduce((sum, c) => {
      if (c.status === 'Active') return sum + (c.monthlyFee || 499)
      return sum
    }, 0)

    const totalJobs =
      totalJobsCount || clients.reduce((sum, c) => sum + (c.activeJobsCount || 0), 0)
    const totalCandidates =
      totalCandidatesCount || clients.reduce((sum, c) => sum + (c.candidatesCount || 0), 0)

    return NextResponse.json({
      stats: {
        totalClients,
        activeClients,
        trialClients,
        totalJobs,
        totalCandidates,
        monthlyRevenue,
      },
    })
  } catch (error: any) {
    console.error('Failed to get admin stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin stats' },
      { status: 500 }
    )
  }
}
