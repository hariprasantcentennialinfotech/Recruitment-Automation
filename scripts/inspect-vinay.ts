import { downloadDriveFile } from '../lib/google-drive-sync'
import { extractDocxText } from '../lib/google-drive-ingestion'

async function inspectDocx() {
  const fileId = '1Pfp0MbYO3AM0lsWEJCi74RaRoJ0yugbm' // Vinay SeniorUXUIDesigner updated.docx
  const buf = await downloadDriveFile(fileId, 'krct')
  const text = await extractDocxText(buf)
  console.log('=== FIRST 1000 CHARACTERS OF VINAY DOCX ===')
  console.log(text.slice(0, 1000))
  console.log('=== FIRST 15 LINES ===')
  console.log(text.split(/\r?\n/).slice(0, 15))
}

inspectDocx().catch(console.error)
