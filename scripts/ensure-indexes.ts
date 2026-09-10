/**
 * scripts/ensure-indexes.ts
 * Run once to create MongoDB indexes for tenant-scoped queries.
 *
 * Usage:
 *   npx ts-node -e "require('./scripts/ensure-indexes.ts')"
 *   OR just deploy — Next.js startup will call this if you import it in instrumentation.ts
 */

import { getMongoClient } from '@/lib/mongodb'

export async function ensureIndexes() {
  const client = getMongoClient()
  const db = client.db(process.env.MONGODB_DATABASE ?? 'talentflow')

  // ── candidate_profiles ──────────────────────────────────────────────────────
  await db.collection('candidate_profiles').createIndexes([
    { key: { organization: 1 }, name: 'org_scope' },
    { key: { organization: 1, stage: 1 }, name: 'org_stage' },
    { key: { organization: 1, createdAt: -1 }, name: 'org_created_desc' },
    { key: { organization: 1, email: 1 }, name: 'org_email', sparse: true },
  ])

  // ── jobs ────────────────────────────────────────────────────────────────────
  await db.collection('jobs').createIndexes([
    { key: { organization: 1 }, name: 'org_scope' },
    { key: { organization: 1, status: 1 }, name: 'org_status' },
    { key: { organization: 1, createdAt: -1 }, name: 'org_created_desc' },
  ])

  // ── activities ──────────────────────────────────────────────────────────────
  await db.collection('activities').createIndexes([
    { key: { organization: 1 }, name: 'org_scope' },
    { key: { organization: 1, createdAt: -1 }, name: 'org_created_desc' },
  ])

  // ── users ───────────────────────────────────────────────────────────────────
  await db.collection('users').createIndexes([
    { key: { email: 1 }, name: 'email_unique', unique: true },
    { key: { organization: 1 }, name: 'org_scope', sparse: true },
    { key: { role: 1 }, name: 'role', sparse: true },
  ])

  // ── clients ─────────────────────────────────────────────────────────────────
  await db.collection('clients').createIndexes([
    { key: { slug: 1 }, name: 'slug_unique', unique: true },
    { key: { contactEmail: 1 }, name: 'email_unique', unique: true },
    { key: { status: 1 }, name: 'status' },
  ])

  // ── job_automation_configs ───────────────────────────────────────────────────
  await db.collection('job_automation_configs').createIndexes([
    { key: { jobId: 1, organizationId: 1 }, name: 'job_org_unique', unique: true },
    // Critical: folder ID → job lookup for incoming Drive webhooks
    { key: { googleDriveResumeFolderId: 1, enabled: 1 }, name: 'folder_enabled_lookup' },
  ])

  // ── resume_processing_records ────────────────────────────────────────────────
  await db.collection('resume_processing_records').createIndexes([
    // Idempotency: same file in same org/job must not be processed twice
    {
      key: { organizationId: 1, sourceFileId: 1 },
      name: 'org_sourceFile_unique',
      unique: true,
    },
    { key: { organizationId: 1, jobId: 1, status: 1 }, name: 'org_job_status' },
    { key: { organizationId: 1, createdAt: -1 }, name: 'org_created_desc' },
  ])

  // ── drive_watch_channels ─────────────────────────────────────────────────────
  await db.collection('drive_watch_channels').createIndexes([
    { key: { channelId: 1 }, name: 'channelId_unique', unique: true },
    { key: { organizationId: 1 }, name: 'org_scope' },
    { key: { status: 1, expiration: 1 }, name: 'status_expiry' },
  ])

  console.log('[ensureIndexes] ✅ All MongoDB indexes created/verified.')
}
