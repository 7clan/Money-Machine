/**
 * Z.AI Provider - Single AI provider for all autonomous agent operations.
 * Uses z-ai-web-dev-sdk exclusively. No external AI APIs.
 *
 * All API calls have retry-with-exponential-backoff to handle 429 rate limits.
 */

import ZAI from 'z-ai-web-dev-sdk'

let _zai: ZAI | null = null

export async function getZAI(): Promise<ZAI> {
  if (!_zai) {
    _zai = await ZAI.create()
  }
  return _zai
}

/**
 * Retry wrapper for Z.ai API calls. Handles 429 (rate limit) and 5xx (server error)
 * with exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s, 64s.
 * Also adds a minimum delay between ALL Z.ai API calls to avoid burst rate limits.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries: number = 6,
): Promise<T> {
  // Minimum delay between ALL Z.ai API calls (300ms) to avoid burst rate limits
  await enforceRateLimit()

  let lastError: any
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      lastError = e
      const msg = e.message || String(e)
      // Retry on 429 (rate limit) and 5xx (server errors)
      const isRetryable = msg.includes('429') ||
        msg.includes('Too many requests') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('500') ||
        msg.includes('Service Unavailable') ||
        msg.includes('Gateway Timeout') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('socket hang up')
      if (!isRetryable || attempt === maxRetries) {
        throw e
      }
      const backoffMs = Math.min(2000 * Math.pow(2, attempt), 64000)
      console.warn(`[zai-retry] ${context} attempt ${attempt + 1}/${maxRetries + 1} failed: ${msg.slice(0, 100)}. Retrying in ${backoffMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }
  }
  throw lastError
}

// ─── Simple token-bucket rate limiter ────────────────────────────
let lastApiCallTime = 0
const MIN_API_CALL_INTERVAL_MS = 300 // 300ms between calls = ~3 calls/sec max

async function enforceRateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastApiCallTime
  if (elapsed < MIN_API_CALL_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_API_CALL_INTERVAL_MS - elapsed))
  }
  lastApiCallTime = Date.now()
}

/** LLM chat completion - the brain of the agent */
export async function llm(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  opts?: { thinking?: boolean; model?: string }
): Promise<string> {
  const zai = await getZAI()
  const res = await withRetry(
    () => zai.chat.completions.create({
      messages,
      model: opts?.model,
      thinking: opts?.thinking ? { type: 'enabled' } : { type: 'disabled' },
    }),
    'llm',
  )
  // Handle streaming or non-streaming response
  if (typeof res === 'string') return res
  if (res?.choices?.[0]?.message?.content) return res.choices[0].message.content
  if (res?.content) return res.content
  return JSON.stringify(res)
}

/** Web search - for research */
export async function webSearch(query: string, num: number = 10): Promise<Array<{
  url: string; name: string; snippet: string; host_name: string; rank: number; date: string
}>> {
  const zai = await getZAI()
  return withRetry(
    () => zai.functions.invoke('web_search', { query, num }),
    `webSearch("${query.slice(0, 40)}")`,
  )
}

/** Read a web page */
export async function readPage(url: string): Promise<{
  title: string; html: string; publishedTime?: string
}> {
  const zai = await getZAI()
  const res = await withRetry(
    () => zai.functions.invoke('page_reader', { url }),
    `readPage("${url.slice(0, 40)}")`,
  )
  return res.data
}

/** Text-to-speech - for narration */
export async function tts(
  text: string,
  voice?: string,
  speed?: number
): Promise<Buffer> {
  const zai = await getZAI()
  const res = await withRetry(
    () => zai.audio.tts.create({
      input: text,
      voice: voice || 'alloy',
      speed: speed || 1.0,
      response_format: 'mp3',
    }),
    `tts("${text.slice(0, 40)}")`,
  )
  // Response may be a buffer, arraybuffer, or base64
  if (Buffer.isBuffer(res)) return res
  if (res instanceof ArrayBuffer) return Buffer.from(res)
  if (typeof res === 'string') return Buffer.from(res, 'base64')
  if (res?.data) return Buffer.from(res.data, 'base64')
  return Buffer.from(JSON.stringify(res))
}

/** Image generation - for thumbnails and visuals */
export async function generateImage(
  prompt: string,
  size?: '1024x1024' | '1344x768' | '1440x720'
): Promise<Buffer> {
  const zai = await getZAI()
  const res = await zai.images.generations.create({
    prompt,
    size: size || '1344x768',
  })
  if (res?.data?.[0]?.base64) {
    return Buffer.from(res.data[0].base64, 'base64')
  }
  throw new Error('Image generation returned no data')
}

/** Image search - for finding reference/stock images */
export async function searchImages(
  query: string,
  count: number = 5
): Promise<Array<{ original_url: string; caption?: string }>> {
  const zai = await getZAI()
  const res = await zai.images.search.create({ query, count, rank: true })
  return res.results
}

/** Vision model - for analyzing images/thumbnails */
export async function vision(
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>
  }>,
  model?: string
): Promise<string> {
  const zai = await getZAI()
  const res = await zai.chat.completions.createVision({
    messages: messages as any,
    model: model || 'glm-4v-flash',
  })
  if (typeof res === 'string') return res
  if (res?.choices?.[0]?.message?.content) return res.choices[0].message.content
  return JSON.stringify(res)
}
