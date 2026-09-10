/**
 * instrumentation.ts — Next.js Instrumentation Hook
 * Runs once on server startup to ensure MongoDB indexes exist.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { ensureIndexes } = await import('./scripts/ensure-indexes')
      await ensureIndexes()
    } catch (err) {
      // Non-fatal: log but don't crash the server
      console.warn('[instrumentation] Could not ensure MongoDB indexes:', err)
    }
  }
}
