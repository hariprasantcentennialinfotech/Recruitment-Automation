import { usersCollection } from '../lib/mongodb'

async function main() {
  const users = await usersCollection().find({}).toArray()
  console.log('Total users:', users.length)
  users.forEach(u => {
    console.log({
      id: u._id?.toString(),
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      organization: u.organization,
      company: u.company,
      credits: u.credits,
    })
  })
  process.exit(0)
}

main().catch(console.error)
