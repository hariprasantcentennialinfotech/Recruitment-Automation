/**
 * Next.js Instrumentation Hook
 * Runs once when the Next.js server boots up.
 * Starts the continuous server-side interval poller for active Google Drive folders.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAutomationPoller } = await import('@/lib/automation-poller')
    startAutomationPoller()
  }
}
