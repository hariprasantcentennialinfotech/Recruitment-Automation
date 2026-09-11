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

export function usersCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('users')
}

export function clientsCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('clients')
}

export function jobsCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('jobs')
}

export function activitiesCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('activities')
}

export function jobAutomationConfigCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('job_automation_configs')
}

export function resumeProcessingRecordsCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('resume_processing_records')
}

export function driveWatchChannelsCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('drive_watch_channels')
}

export function organizationAutomationSettingsCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('organization_automation_settings')
}

export function creditTransactionsCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('credit_transactions')
}

export function geminiModelUsageCollection() {
  return getMongoClient().db(process.env.MONGODB_DATABASE ?? 'talentflow').collection('gemini_model_usage')
}

