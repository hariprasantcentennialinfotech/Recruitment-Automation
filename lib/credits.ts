import { ObjectId } from 'mongodb'
import { usersCollection, creditTransactionsCollection } from '@/lib/mongodb'

export const RESUME_PROCESSING_CREDIT_COST = 6

export interface CreditTransaction {
  id?: string
  userId: string
  userEmail?: string
  organization?: string
  amount: number
  type: 'allocation' | 'deduction' | 'adjustment'
  description: string
  createdAt: Date
}

/**
 * Gets the current credit balance for a user by user ID or organization slug.
 */
export async function getUserCredits(userIdOrOrg: string): Promise<number> {
  const col = usersCollection()
  let user = null

  if (ObjectId.isValid(userIdOrOrg)) {
    user = await col.findOne({ _id: new ObjectId(userIdOrOrg) })
  }

  if (!user) {
    user = await col.findOne({
      $or: [{ organization: userIdOrOrg }, { company: userIdOrOrg }]
    })
  }

  return typeof user?.credits === 'number' ? user.credits : 0
}

/**
 * Allocates credits to selected users or all users.
 */
export async function allocateCredits(params: {
  userIds?: string[]
  allUsers?: boolean
  amount: number
  note?: string
  adminUser?: string
}): Promise<{ modifiedCount: number }> {
  const { userIds, allUsers, amount, note, adminUser = 'Admin' } = params
  const col = usersCollection()
  const txCol = creditTransactionsCollection()
  const now = new Date()

  let filter: any = {}
  if (!allUsers) {
    if (!userIds || userIds.length === 0) {
      return { modifiedCount: 0 }
    }
    const validIds = userIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
    filter = { _id: { $in: validIds } }
  }

  // Fetch target users to create detailed transaction logs
  const targetUsers = await col.find(filter).toArray()
  if (targetUsers.length === 0) {
    return { modifiedCount: 0 }
  }

  // Update credits for target users (if credits was null/undefined, set to amount, else increment)
  const result = await col.updateMany(filter, [
    {
      $set: {
        credits: {
          $add: [{ $ifNull: ['$credits', 0] }, amount]
        },
        lastCreditUpdate: now
      }
    }
  ])

  // Log transactions for each user
  const transactions = targetUsers.map((u) => ({
    userId: u._id.toString(),
    userEmail: u.email,
    organization: u.organization || u.company || '',
    amount,
    type: 'allocation',
    description: note || `Allocated ${amount} credits by ${adminUser}`,
    createdAt: now,
  }))

  if (transactions.length > 0) {
    await txCol.insertMany(transactions)
  }

  return { modifiedCount: result.modifiedCount }
}

/**
 * Deducts 6 credits for processing a single resume.
 * If user does not have sufficient credits, returns success: false.
 */
export async function deductResumeCredits(params: {
  organizationId: string
  fileName: string
  candidateName?: string
  userId?: string
}): Promise<{ success: boolean; remainingCredits: number; error?: string }> {
  const { organizationId, fileName, candidateName, userId } = params
  const col = usersCollection()
  const txCol = creditTransactionsCollection()

  let user = null
  if (userId && ObjectId.isValid(userId)) {
    user = await col.findOne({ _id: new ObjectId(userId) })
  }

  if (!user && organizationId) {
    // Find primary user associated with this organization
    user = await col.findOne({
      $or: [{ organization: organizationId }, { company: organizationId }]
    })
  }

  // If no user found in DB for this org, find any active user or allow fallback
  if (!user) {
    user = await col.findOne({})
  }

  if (!user) {
    // No users exist in the system at all
    return { success: true, remainingCredits: 9999 }
  }

  const currentCredits = typeof user.credits === 'number' ? user.credits : 0

  if (currentCredits < RESUME_PROCESSING_CREDIT_COST) {
    return {
      success: false,
      remainingCredits: currentCredits,
      error: `Insufficient credits: Processing a resume requires ${RESUME_PROCESSING_CREDIT_COST} credits. Current balance: ${currentCredits} credits. Please contact your administrator to allocate credits.`
    }
  }

  // Atomically decrement credits
  const updateRes = await col.findOneAndUpdate(
    {
      _id: user._id,
      $or: [
        { credits: { $gte: RESUME_PROCESSING_CREDIT_COST } },
        { credits: { $exists: false } }
      ]
    },
    {
      $inc: { credits: -RESUME_PROCESSING_CREDIT_COST },
      $set: { lastCreditDeduction: new Date() }
    },
    { returnDocument: 'after' }
  )

  const updatedDoc = (updateRes as any)?.value || updateRes
  const newBalance = typeof updatedDoc?.credits === 'number' ? updatedDoc.credits : currentCredits - RESUME_PROCESSING_CREDIT_COST

  // Record deduction transaction
  await txCol.insertOne({
    userId: user._id.toString(),
    userEmail: user.email,
    organization: organizationId || user.organization || '',
    amount: -RESUME_PROCESSING_CREDIT_COST,
    type: 'deduction',
    description: `Processed resume: ${fileName}${candidateName ? ` (${candidateName})` : ''} [-${RESUME_PROCESSING_CREDIT_COST} credits]`,
    createdAt: new Date(),
  })

  return {
    success: true,
    remainingCredits: newBalance
  }
}

/**
 * Gets credit transactions history for a user or organization.
 */
export async function getCreditTransactions(params: {
  userId?: string
  organizationId?: string
  limit?: number
}): Promise<CreditTransaction[]> {
  const { userId, organizationId, limit = 50 } = params
  const txCol = creditTransactionsCollection()

  const filter: any = {}
  if (userId) filter.userId = userId
  else if (organizationId) filter.organization = organizationId

  const list = await txCol
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()

  return list.map((doc) => ({
    id: doc._id.toString(),
    userId: doc.userId,
    userEmail: doc.userEmail,
    organization: doc.organization,
    amount: doc.amount,
    type: doc.type,
    description: doc.description,
    createdAt: doc.createdAt,
  }))
}
