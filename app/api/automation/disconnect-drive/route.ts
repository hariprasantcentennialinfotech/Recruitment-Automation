import { NextResponse } from 'next/server'
import { requireOrganization, isAuthError } from '@/lib/server-auth'
import { disconnectGoogleDrive } from '@/lib/google-auth-token'
import { activitiesCollection } from '@/lib/mongodb'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    await disconnectGoogleDrive(organization)

    try {
      const actCol = activitiesCollection()
      await actCol.insertOne({
        organization,
        title: 'Google Drive Disconnected',
        detail: 'Disconnected Google Drive OAuth integration.',
        type: 'system',
        createdAt: new Date(),
      })
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Google Drive disconnected successfully.',
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to disconnect Google Drive' },
      { status: 500 }
    )
  }
}
