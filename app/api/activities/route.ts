import { NextResponse } from 'next/server'
import { activitiesCollection } from '@/lib/mongodb'
import { requireOrganization, isAuthError } from '@/lib/server-auth'

export async function GET(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const collection = activitiesCollection()
    const activities = await collection
      .find({ organization })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray()

    const formatted = activities.map((act) => {
      const date = new Date(act.createdAt)
      const diffMinutes = Math.round((Date.now() - date.getTime()) / 60000)
      let timeStr = 'Just now'
      if (diffMinutes >= 60 * 24) {
        timeStr = `${Math.floor(diffMinutes / (60 * 24))}d ago`
      } else if (diffMinutes >= 60) {
        timeStr = `${Math.floor(diffMinutes / 60)}h ago`
      } else if (diffMinutes > 1) {
        timeStr = `${diffMinutes}m ago`
      }

      return {
        id: act._id.toString(),
        organization: act.organization,
        title: act.title,
        detail: act.detail,
        type: act.type || 'system',
        time: timeStr,
        createdAt: act.createdAt,
      }
    })

    return NextResponse.json({ activities: formatted })
  } catch (error: any) {
    console.error('Failed to get activities:', error)
    return NextResponse.json({ activities: [] })
  }
}

export async function POST(req: Request) {
  const authResult = await requireOrganization(req)
  if (isAuthError(authResult)) return authResult.error

  const { organization } = authResult

  try {
    const body = await req.json()
    const { title, detail, type = 'system' } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const collection = activitiesCollection()
    const newAct = {
      organization,
      title: title.trim(),
      detail: (detail || '').trim(),
      type,
      createdAt: new Date(),
    }

    const result = await collection.insertOne(newAct as any)

    return NextResponse.json({
      success: true,
      activity: { id: result.insertedId.toString(), ...newAct, time: 'Just now' },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to log activity' },
      { status: 500 }
    )
  }
}
