import { inngest } from '../client'
import { renewExpiredChannels } from '@/lib/google-drive-sync'

/**
 * Inngest function: renewGoogleDriveWatchChannels
 * Triggered by cron schedule or event 'google/drive.renew.channels'.
 *
 * Scans active watch channels and renews those expiring within 24 hours.
 */
export const renewGoogleDriveWatchChannelsFunction = inngest.createFunction(
  {
    id: 'renew-google-drive-watch-channels',
    retries: 2,
    triggers: [
      { event: 'google/drive.renew.channels' },
      { cron: '0 */6 * * *' }, // Run every 6 hours automatically
    ],
  },
  async ({ step }: any) => {
    const result = await step.run('renew-stale-channels', async () => {
      return renewExpiredChannels()
    })

    return result
  }
)
