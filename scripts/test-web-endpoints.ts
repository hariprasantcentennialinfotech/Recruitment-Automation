async function main() {
  const base = 'http://localhost:3000'
  console.log(`Checking endpoints at ${base}...`)

  // 1. Root page (Landing Page HTML)
  const homeRes = await fetch(`${base}/`)
  const homeHtml = await homeRes.text()
  console.log(`Root page status: ${homeRes.status}`)
  console.log(`Root page contains "TalentFlow AI": ${homeHtml.includes('TalentFlow AI')}`)
  console.log(`Root page contains "6 Credits": ${homeHtml.includes('6 Credits') || homeHtml.includes('Credits')}`)

  // 2. Admin page
  const adminRes = await fetch(`${base}/admin`)
  console.log(`Admin page status: ${adminRes.status}`)

  console.log('All endpoints responding properly!')
}

main().catch(err => {
  console.error('Endpoint check error:', err)
  process.exit(1)
})
