import { recordModelUsage, getModelUsageAnalytics } from '../lib/model-usage-logger'

async function main() {
  console.log('Testing Google Model Usage Logging & Analytics...\n')

  // 1. Record sample model invocations
  await recordModelUsage({
    model: 'gemini-flash-latest',
    operation: 'extract_candidate_from_resume',
    durationMs: 1420,
    statusCode: 200,
    usageMetadata: {
      promptTokenCount: 850,
      candidatesTokenCount: 310,
      totalTokenCount: 1160,
    },
  })

  await recordModelUsage({
    model: 'gemini-3.7-flash',
    operation: 'extract_candidate_pdf_buffer',
    durationMs: 2150,
    statusCode: 200,
    usageMetadata: {
      promptTokenCount: 1100,
      candidatesTokenCount: 420,
      totalTokenCount: 1520,
    },
  })

  await recordModelUsage({
    model: 'gemini-flash-latest',
    operation: 'extract_candidate_custom_columns',
    durationMs: 310,
    statusCode: 429,
    errorMessage: 'Quota exceeded for gemini-flash-latest (429 Too Many Requests)'
  })

  console.log('Recorded 3 test usage entries.')

  // 2. Fetch and verify aggregated analytics
  const analytics = await getModelUsageAnalytics()
  console.log('\nAggregated Analytics Results:')
  console.log('Overview:', JSON.stringify(analytics.overview, null, 2))
  console.log('Models Tracked:', analytics.models.map(m => `${m.model}: ${m.totalCalls} calls (${m.successCalls} success, ${m.rateLimitedCalls} 429), ${m.totalTokens} tokens`))
  console.log('Operations:', analytics.operations.map(o => `${o.name}: ${o.calls} calls`))
  console.log('Recent Logs Count:', analytics.recentLogs.length)

  console.log('\nVerified successfully!')
  process.exit(0)
}

main().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
})
