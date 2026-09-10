import { NextResponse } from 'next/server'
import { clientsCollection } from '@/lib/mongodb'
import { requireSuperAdmin, isAuthError } from '@/lib/server-auth'
import { ClientCompany } from '@/lib/types'

export async function GET(req: Request) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const collection = clientsCollection()
    const clients = await collection.find({}).sort({ createdAt: -1 }).toArray()

    const formatted = clients.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      contactEmail: c.contactEmail,
      contactPerson: c.contactPerson || '',
      domain: c.domain || '',
      plan: c.plan || 'Growth',
      status: c.status || 'Active',
      monthlyFee: c.monthlyFee || 499,
      brandColor: c.brandColor || '#1e3a8a',
      whiteLabelName: c.whiteLabelName || `${c.name} Hiring`,
      maxJobs: c.maxJobs || 20,
      maxCandidates: c.maxCandidates || 500,
      activeJobsCount: c.activeJobsCount || 0,
      candidatesCount: c.candidatesCount || 0,
      createdAt: c.createdAt,
    }))

    return NextResponse.json({ clients: formatted })
  } catch (error: any) {
    console.error('Failed to get clients:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const body = await req.json()
    const {
      name,
      contactEmail,
      contactPerson,
      domain,
      plan = 'Growth',
      status = 'Active',
      brandColor = '#2563eb',
      whiteLabelName,
      maxJobs = 20,
      maxCandidates = 500,
    } = body

    if (!name || !contactEmail) {
      return NextResponse.json(
        { error: 'Company name and contact email are required' },
        { status: 400 }
      )
    }

    const collection = clientsCollection()
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const existing = await collection.findOne({
      $or: [{ slug }, { contactEmail: contactEmail.toLowerCase().trim() }],
    })
    if (existing) {
      return NextResponse.json(
        { error: 'A client company with this name or email already exists' },
        { status: 409 }
      )
    }

    const planFeeMap: Record<string, number> = {
      Starter: 299,
      Growth: 799,
      Enterprise: 1499,
    }

    const newClient = {
      name: name.trim(),
      slug,
      contactEmail: contactEmail.toLowerCase().trim(),
      contactPerson: (contactPerson || '').trim(),
      domain: (domain || '').trim(),
      plan,
      status,
      monthlyFee: planFeeMap[plan] || 499,
      brandColor: brandColor || '#2563eb',
      whiteLabelName: whiteLabelName?.trim() || `${name.trim()} Talent Portal`,
      maxJobs: Number(maxJobs) || 20,
      maxCandidates: Number(maxCandidates) || 500,
      activeJobsCount: 0,
      candidatesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(newClient as any)

    // ---------- Create admin user for this organization ----------
    const usersCol = (await import('@/lib/mongodb')).usersCollection()
    const { hashPassword } = await import('@/lib/auth')
    const tempPassword = Math.random().toString(36).slice(-8) // simple temp pwd
    const passwordHash = hashPassword(tempPassword)
    await usersCol.insertOne({
      email: contactEmail.toLowerCase().trim(),
      fullName: contactPerson || 'Admin',
      organization: slug,
      role: 'admin',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      client: { id: result.insertedId.toString(), ...newClient },
      adminCredentials: { email: contactEmail.toLowerCase().trim(), password: tempPassword },
    })
  } catch (error: any) {
    console.error('Failed to create client:', error)
    return NextResponse.json({ error: error.message || 'Failed to create client' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const { ObjectId } = await import('mongodb')
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    const collection = clientsCollection()
    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update client' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const authResult = await requireSuperAdmin()
  if (isAuthError(authResult)) return authResult.error

  try {
    const { ObjectId } = await import('mongodb')
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 })
    }

    const collection = clientsCollection()
    await collection.deleteOne({ _id: new ObjectId(id) })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete client' }, { status: 500 })
  }
}
