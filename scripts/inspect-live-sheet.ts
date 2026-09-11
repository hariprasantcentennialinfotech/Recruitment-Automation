import { getDriveAccessToken } from '../lib/google-auth-token'

async function main() {
  const organization = 'krct'
  const spreadsheetId = '1yJHIsZAqdXCQQYCH7ogPun4KMRDkY6iYHt4jfhfb4p8'
  const token = await getDriveAccessToken(organization)
  if (!token) {
    console.error('No drive access token')
    return
  }

  const range = encodeURIComponent('Sheet1!A1:Z10')
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const data = await res.json()
  console.log('Values:')
  if (data.values) {
    data.values.forEach((row: any, i: number) => {
      console.log(`Row ${i + 1}:`, JSON.stringify(row))
    })
  } else {
    console.log(data)
  }
}

main().catch(console.error)
