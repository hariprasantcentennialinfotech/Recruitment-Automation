import { MongoClient } from 'mongodb'

const globalForMongo = globalThis as typeof globalThis & { mongoClient?: MongoClient }

export function getMongoClient() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not configured')
  const client = globalForMongo.mongoClient ?? new MongoClient(uri)
  if (process.env.NODE_ENV !== 'production') globalForMongo.mongoClient = client
  return client
}

export function candidateProfilesCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('candidate_profiles')
}
