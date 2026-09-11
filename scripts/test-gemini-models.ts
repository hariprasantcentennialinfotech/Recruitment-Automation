async function testModels() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY
  console.log('Testing models with key:', apiKey ? apiKey.slice(0, 8) + '...' : 'NONE')

  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
  ]

  for (const m of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] }),
      })
      console.log(`Model ${m}: status ${res.status}`)
      if (res.ok) {
        const data = await res.json()
        console.log(`Model ${m} worked!`, data.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 30))
      } else {
        const err = await res.text()
        console.log(`Model ${m} error:`, err.slice(0, 100))
      }
    } catch (e: any) {
      console.log(`Model ${m} fetch err:`, e.message)
    }
  }
}

testModels().catch(console.error)
