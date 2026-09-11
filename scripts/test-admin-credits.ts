import { usersCollection, creditTransactionsCollection } from '../lib/mongodb'
import { allocateCredits, deductResumeCredits, getUserCredits, RESUME_PROCESSING_CREDIT_COST } from '../lib/credits'

async function main() {
  console.log('=== 1. Testing Admin Credentials from .env ===')
  const envUser = process.env.ADMIN_USERNAME
  const envPass = process.env.ADMIN_PASSWORD
  console.log(`Configured ADMIN_USERNAME: "${envUser}"`)
  console.log(`Configured ADMIN_PASSWORD: ${envPass ? '*** (set)' : 'MISSING'}`)
  if (envUser !== 'Sharp' || envPass !== 'h0405200615') {
    throw new Error('Admin credentials from .env do not match expected values')
  }
  console.log('✓ Admin environment variables verified.')

  console.log('\n=== 2. Testing Bulk Credit Allocation (+1000 credits to all users) ===')
  const usersCol = usersCollection()
  const initialUsers = await usersCol.find({}).toArray()
  console.log(`Found ${initialUsers.length} initial users.`)

  const allocResult = await allocateCredits({
    allUsers: true,
    amount: 1000,
    note: 'Automated verification test grant (+1000)',
    adminUser: 'Sharp (Super Admin)',
  })
  console.log(`✓ Allocation completed: modified ${allocResult.modifiedCount} user record(s).`)

  const updatedUsers = await usersCol.find({}).toArray()
  for (const u of updatedUsers) {
    console.log(`- User: ${u.fullName || u.email} | Credits: ${u.credits} | Org: ${u.organization || u.company}`)
    if (typeof u.credits !== 'number' || u.credits < 1000) {
      throw new Error(`User ${u.email} credits were not properly allocated (found: ${u.credits})`)
    }
  }

  console.log('\n=== 3. Testing 6-Credit Deduction on Resume Processing ===')
  const krctUser = updatedUsers.find((u) => u.organization === 'krct' || u.company === 'krct') || updatedUsers[0]
  const balanceBefore = krctUser.credits
  console.log(`Testing deduction for org "${krctUser.organization || krctUser.company}" (Current balance: ${balanceBefore})`)

  const deductResult = await deductResumeCredits({
    organizationId: krctUser.organization || krctUser.company || '',
    fileName: 'candidate_shakir_imran.pdf',
    candidateName: 'Shakir Imran',
    userId: krctUser._id.toString(),
  })

  console.log('Deduct result:', deductResult)
  if (!deductResult.success) {
    throw new Error(`Credit deduction failed: ${deductResult.error}`)
  }

  const expectedBalance = balanceBefore - RESUME_PROCESSING_CREDIT_COST
  if (deductResult.remainingCredits !== expectedBalance) {
    throw new Error(`Expected balance ${expectedBalance}, got ${deductResult.remainingCredits}`)
  }
  console.log(`✓ Exactly ${RESUME_PROCESSING_CREDIT_COST} credits deducted! New balance: ${deductResult.remainingCredits}`)

  console.log('\n=== 4. Checking Credit Transaction Log ===')
  const txCol = creditTransactionsCollection()
  const recentTxs = await txCol.find({ userId: krctUser._id.toString() }).sort({ createdAt: -1 }).limit(2).toArray()
  console.log('Recent transactions for user:', recentTxs.map(t => ({
    type: t.type,
    amount: t.amount,
    desc: t.description,
    time: t.createdAt,
  })))

  if (recentTxs.length === 0 || recentTxs[0].amount !== -6) {
    throw new Error('Transaction log did not record the -6 deduction!')
  }
  console.log('✓ Transaction log verified.')

  console.log('\n=== 5. Testing Insufficient Credits Block ===')
  // Temporarily set user's credits to 3
  await usersCol.updateOne({ _id: krctUser._id }, { $set: { credits: 3 } })
  const lowResult = await deductResumeCredits({
    organizationId: krctUser.organization || krctUser.company || '',
    fileName: 'blocked_resume.pdf',
    userId: krctUser._id.toString(),
  })

  console.log('Result when credits = 3:', lowResult)
  if (lowResult.success) {
    throw new Error('Expected deduction to FAIL when credits < 6, but it succeeded!')
  }
  console.log(`✓ Processing successfully blocked: "${lowResult.error}"`)

  // Restore balance
  await usersCol.updateOne({ _id: krctUser._id }, { $set: { credits: expectedBalance } })
  console.log(`✓ Restored user balance to ${expectedBalance} credits.`)

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
