export {}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || ''
  const testModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.7-flash']
  for (const m of testModels) {
    const res1 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
    })
    console.log(`v1beta ${m}: ${res1.status} ${res1.statusText}`)
    if (!res1.ok) {
      console.log(await res1.text())
    }
  }
}

main().catch(console.error)
