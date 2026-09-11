import { runPollingCycle } from '../lib/automation-poller'

async function main() {
  console.log('Testing automation polling cycle...')
  const result = await runPollingCycle()
  console.log('Polling cycle result:', result)
}

main().catch(console.error)
