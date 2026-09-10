import { inngest } from './client'
import { syncGoogleDriveChangesFunction } from './functions/sync-drive'
import { processGoogleDriveResumeFunction } from './functions/process-resume'
import { renewGoogleDriveWatchChannelsFunction } from './functions/renew-channels'
import { pollActiveFoldersFunction } from './functions/poll-active-folders'

export { inngest }

export const inngestFunctions = [
  syncGoogleDriveChangesFunction,
  processGoogleDriveResumeFunction,
  renewGoogleDriveWatchChannelsFunction,
  pollActiveFoldersFunction,
]

