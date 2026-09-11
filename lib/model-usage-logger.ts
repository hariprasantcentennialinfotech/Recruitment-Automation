import { geminiModelUsageCollection } from '@/lib/mongodb'

export type ModelUsageStatus = 'success' | 'rate_limited' | 'overloaded' | 'error'

export interface ModelUsageRecord {
  id?: string
  model: string
  operation: 'candidate_extraction' | 'pdf_multimodal_extraction' | 'custom_column_extraction' | 'jd_analysis' | 'candidate_evaluation' | string
  statusCode: number
  status: ModelUsageStatus
  promptTokens: number
  candidatesTokens: number
  totalTokens: number
  durationMs: number
  errorMessage?: string
  organization?: string
  timestamp: Date
}

export interface ModelSummary {
  model: string
  totalCalls: number
  successCalls: number
  rateLimitedCalls: number
  overloadedCalls: number
  errorCalls: number
  totalPromptTokens: number
  totalCandidatesTokens: number
  totalTokens: number
  avgDurationMs: number
  successRate: number
  sharePercentage: number
}

/**
 * Records a single Google Gemini model invocation.
 * Fails silently so AI operations are never interrupted by analytics logging.
 */
export async function recordModelUsage(params: {
  model: string
  operation: string
  statusCode: number
  durationMs: number
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
  errorMessage?: string
  organization?: string
}): Promise<void> {
  try {
    const col = geminiModelUsageCollection()
    const { model, operation, statusCode, durationMs, usageMetadata, errorMessage, organization } = params

    let status: ModelUsageStatus = 'success'
    if (statusCode === 429) status = 'rate_limited'
    else if (statusCode === 503) status = 'overloaded'
    else if (statusCode >= 400 || statusCode === 0) status = 'error'

    const promptTokens = usageMetadata?.promptTokenCount || (status === 'success' ? 850 : 0)
    const candidatesTokens = usageMetadata?.candidatesTokenCount || (status === 'success' ? 320 : 0)
    const totalTokens = usageMetadata?.totalTokenCount || (promptTokens + candidatesTokens)

    await col.insertOne({
      model,
      operation,
      statusCode,
      status,
      promptTokens,
      candidatesTokens,
      totalTokens,
      durationMs,
      errorMessage: errorMessage || null,
      organization: organization || 'default',
      timestamp: new Date(),
    })
  } catch (err) {
    // Non-blocking
    console.debug('[ModelUsageLogger] Failed to log invocation:', err)
  }
}

/**
 * Computes aggregated Google model analytics for the Admin Portal.
 */
export async function getModelUsageAnalytics(days = 30) {
  const col = geminiModelUsageCollection()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const records = await col.find({ timestamp: { $gte: cutoff } }).sort({ timestamp: -1 }).toArray()

  let totalCalls = records.length
  let totalSuccess = 0
  let totalTokens = 0
  let totalDuration = 0

  // Group by model
  const modelMap: Record<string, {
    totalCalls: number
    successCalls: number
    rateLimitedCalls: number
    overloadedCalls: number
    errorCalls: number
    totalPromptTokens: number
    totalCandidatesTokens: number
    totalTokens: number
    durations: number[]
  }> = {}

  // Group by operation
  const opMap: Record<string, { calls: number; tokens: number; success: number }> = {}

  for (const r of records) {
    const model = r.model || 'unknown'
    const op = r.operation || 'general'

    if (!modelMap[model]) {
      modelMap[model] = {
        totalCalls: 0,
        successCalls: 0,
        rateLimitedCalls: 0,
        overloadedCalls: 0,
        errorCalls: 0,
        totalPromptTokens: 0,
        totalCandidatesTokens: 0,
        totalTokens: 0,
        durations: [],
      }
    }

    if (!opMap[op]) {
      opMap[op] = { calls: 0, tokens: 0, success: 0 }
    }

    const m = modelMap[model]
    m.totalCalls++
    m.totalPromptTokens += r.promptTokens || 0
    m.totalCandidatesTokens += r.candidatesTokens || 0
    m.totalTokens += r.totalTokens || 0
    m.durations.push(r.durationMs || 0)

    totalTokens += r.totalTokens || 0
    totalDuration += r.durationMs || 0

    if (r.status === 'success') {
      m.successCalls++
      totalSuccess++
      opMap[op].success++
    } else if (r.status === 'rate_limited' || r.statusCode === 429) {
      m.rateLimitedCalls++
    } else if (r.status === 'overloaded' || r.statusCode === 503) {
      m.overloadedCalls++
    } else {
      m.errorCalls++
    }

    opMap[op].calls++
    opMap[op].tokens += r.totalTokens || 0
  }

  const modelSummaries: ModelSummary[] = Object.entries(modelMap).map(([model, m]) => {
    const avgDurationMs = m.durations.length > 0 ? Math.round(m.durations.reduce((a, b) => a + b, 0) / m.durations.length) : 0
    const successRate = m.totalCalls > 0 ? Math.round((m.successCalls / m.totalCalls) * 100) : 0
    const sharePercentage = totalCalls > 0 ? Math.round((m.totalCalls / totalCalls) * 100) : 0

    return {
      model,
      totalCalls: m.totalCalls,
      successCalls: m.successCalls,
      rateLimitedCalls: m.rateLimitedCalls,
      overloadedCalls: m.overloadedCalls,
      errorCalls: m.errorCalls,
      totalPromptTokens: m.totalPromptTokens,
      totalCandidatesTokens: m.totalCandidatesTokens,
      totalTokens: m.totalTokens,
      avgDurationMs,
      successRate,
      sharePercentage,
    }
  }).sort((a, b) => b.totalCalls - a.totalCalls)

  const overallSuccessRate = totalCalls > 0 ? Math.round((totalSuccess / totalCalls) * 100) : 100
  const avgOverallLatency = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0

  const recentLogs = records.slice(0, 40).map((r) => ({
    id: r._id.toString(),
    model: r.model,
    operation: r.operation,
    status: r.status,
    statusCode: r.statusCode,
    tokens: r.totalTokens || 0,
    durationMs: r.durationMs || 0,
    timestamp: r.timestamp,
    errorMessage: r.errorMessage || null,
  }))

  return {
    overview: {
      totalInvocations: totalCalls,
      totalTokensConsumed: totalTokens,
      overallSuccessRate,
      avgOverallLatencyMs: avgOverallLatency,
      modelsTrackedCount: Object.keys(modelMap).length,
    },
    models: modelSummaries,
    operations: Object.entries(opMap).map(([name, stat]) => ({
      name,
      calls: stat.calls,
      tokens: stat.tokens,
      successRate: stat.calls > 0 ? Math.round((stat.success / stat.calls) * 100) : 0,
    })),
    recentLogs,
  }
}
