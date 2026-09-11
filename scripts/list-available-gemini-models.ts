export {}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || ''
  console.log('API Key exists:', !!apiKey)
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
  const data = await res.json()
  if (data.models) {
    console.log('Supported models for generateContent:')
    for (const m of data.models) {
      if (m.supportedGenerationMethods?.includes('generateContent')) {
        console.log(`- ${m.name.replace('models/', '')}`)
      }
    }
  } else {
    console.log('Response error:', data)
  }
}

main().catch(console.error)
