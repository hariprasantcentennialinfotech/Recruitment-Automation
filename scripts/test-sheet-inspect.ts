import { getSheetColumns } from '../lib/google-drive-hierarchy'

async function main() {
  const spreadsheetId = '1GWMq9ALvTahZ_hElHFgw7jScUTmRqBT6ZKNGEEOwvbU'
  const organizationId = 'krct'
  
  console.log('Testing getSheetColumns for spreadsheet:', spreadsheetId)
  const result = await getSheetColumns(spreadsheetId, null, organizationId, 'Applicant Record')
  console.log('Result:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
