/**
 * Z.ai Request Scheduler (Phase: spec section 10)
 *
 * Centralized scheduler for ALL Z.ai API calls. Enforces:
 *   - Per-endpoint concurrency limits (1 for LLM, 1 for TTS, 1 for image, 1 for video)
 *   - Minimum spacing between calls (per-endpoint + global)
 *   - Error classification (via ZaiErrorClassifier)
 *   - Retry-after / reset-time awareness
 *   - Jitter to avoid thundering herd
 *   - Content-addressed cache for identical successful requests (spec section 8)
 *
 * Modules MUST use this scheduler instead of calling ZAI.* directly.
 */

import ZAI from 'z-ai-web-dev-sdk'
import { createHash } from 'crypto'
import { writeFile, readFile, mkdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { classifyZaiError, logClassifiedError, type ClassifiedZaiError } from './zai-error-classifier'

// ─── Configuration ────────────────────────────────────────────

const ENDPOINT_CONFIG = {
  llm:    { concurrency: 1, minSpacingMs: 800,  maxRetries: 5 },
  tts:    { concurrency: 1, minSpacingMs: 1500, maxRetries: 5 },
  image:  { concurrency: 1, minSpacingMs: 2000, maxRetries: 4 },
  video:  { concurrency: 1, minSpacingMs: 3000, maxRetries: 3 },
  search: { concurrency: 1, minSpacingMs: 1000, maxRetries: 3 },
} as const

type Endpoint = keyof typeof ENDPOINT_CONFIG

// ─── Content-addressed cache (Phase: spec section 8) ─────────

const CACHE_DIR = path.join(process.cwd(), 'data', 'zai-cache')

interface CacheEntry {
  promptHash: string
  model: string
  endpoint: string
  result: any
  createdAt: string
  usage?: any
}

function computeCacheKey(endpoint: Endpoint, payload: any, model?: string): string {
  const hash = createHash('sha256')
  hash.update(JSON.stringify({ endpoint, payload, model }))
  return hash.digest('hex').slice(0, 32)
}

async function getCached(key: string): Promise<any | null> {
  try {
    const cachePath = path.join(CACHE_DIR, `${key}.json`)
    if (!existsSync(cachePath)) return null
    const raw = await readFile(cachePath, 'utf-8')
    const entry: CacheEntry = JSON.parse(raw)
    return entry.result
  } catch {
    return null
  }
}

async function setCached(key: string, endpoint: Endpoint, result: any, model?: string): Promise<void> {
  try {
    if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true })
    const entry: CacheEntry = {
      promptHash: key,
      model: model || 'unknown',
      endpoint,
      result,
      createdAt: new Date().toISOString(),
    }
    await writeFile(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(entry))
  } catch (e: any) {
    console.warn('[scheduler] cache write failed:', e.message)
  }
}

// ─── Per-endpoint state ──────────────────────────────────────

interface EndpointState {
  lastCallTime: number
  blockedUntil: number  // timestamp (ms) — don't call before this
  blockReason: string | null
  activeCalls: number
  totalCalls: number
  successfulCalls: number
  cachedHits: number
  retriedCalls: number
  failedCalls: number
  lastError: ClassifiedZaiError | null
}

const endpointStates: Record<Endpoint, EndpointState> = {
  llm:    { lastCallTime: 0, blockedUntil: 0, blockReason: null, activeCalls: 0, totalCalls: 0, successfulCalls: 0, cachedHits: 0, retriedCalls: 0, failedCalls: 0, lastError: null },
  tts:    { lastCallTime: 0, blockedUntil: 0, blockReason: null, activeCalls: 0, totalCalls: 0, successfulCalls: 0, cachedHits: 0, retriedCalls: 0, failedCalls: 0, lastError: null },
  image:  { lastCallTime: 0, blockedUntil: 0, blockReason: null, activeCalls: 0, totalCalls: 0, successfulCalls: 0, cachedHits: 0, retriedCalls: 0, failedCalls: 0, lastError: null },
  video:  { lastCallTime: 0, blockedUntil: 0, blockReason: null, activeCalls: 0, totalCalls: 0, successfulCalls: 0, cachedHits: 0, retriedCalls: 0, failedCalls: 0, lastError: null },
  search: { lastCallTime: 0, blockedUntil: 0, blockReason: null, activeCalls: 0, totalCalls: 0, successfulCalls: 0, cachedHits: 0, retriedCalls: 0, failedCalls: 0, lastError: null },
}

// ─── Scheduler core ──────────────────────────────────────────

let _zai: ZAI | null = null

async function getZAI(): Promise<ZAI> {
  if (!_zai) _zai = await ZAI.create()
  return _zai
}

/**
 * Wait until it's safe to make a call to this endpoint
 * (respects concurrency + min spacing + block-until-reset).
 */
async function waitForSlot(endpoint: Endpoint): Promise<void> {
  const cfg = ENDPOINT_CONFIG[endpoint]
  const st = endpointStates[endpoint]

  // Wait for a free concurrency slot
  while (st.activeCalls >= cfg.concurrency) {
    await sleep(50)
  }

  // Wait for block-until-reset (usage window exhausted)
  const now = Date.now()
  if (st.blockedUntil > now) {
    const waitMs = st.blockedUntil - now
    console.warn(`[scheduler:${endpoint}] Blocked until ${new Date(st.blockedUntil).toISOString()} (${(waitMs / 1000).toFixed(0)}s). Reason: ${st.blockReason}`)
    await sleep(waitMs)
    st.blockedUntil = 0
    st.blockReason = null
  }

  // Enforce minimum spacing between calls
  const elapsed = Date.now() - st.lastCallTime
  if (elapsed < cfg.minSpacingMs) {
    const wait = cfg.minSpacingMs - elapsed + Math.random() * 200 // jitter
    await sleep(wait)
  }

  st.activeCalls++
  st.lastCallTime = Date.now()
}

function releaseSlot(endpoint: Endpoint): void {
  endpointStates[endpoint].activeCalls = Math.max(0, endpointStates[endpoint].activeCalls - 1)
}

/**
 * Run a Z.ai API call through the scheduler with error classification + retry.
 * Returns the result, or throws a ClassifiedZaiError if non-retryable.
 */
async function runScheduled<T>(
  endpoint: Endpoint,
  payload: any,
  fn: (zai: ZAI) => Promise<T>,
  options: { cacheable?: boolean; model?: string } = {},
): Promise<T> {
  const { cacheable = false, model } = options
  const cfg = ENDPOINT_CONFIG[endpoint]
  const st = endpointStates[endpoint]

  // Check cache first (if cacheable)
  if (cacheable) {
    const cacheKey = computeCacheKey(endpoint, payload, model)
    const cached = await getCached(cacheKey)
    if (cached !== null) {
      st.cachedHits++
      return cached as T
    }
  }

  let lastError: ClassifiedZaiError | null = null

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    await waitForSlot(endpoint)
    st.totalCalls++

    try {
      const zai = await getZAI()
      const result = await fn(zai)

      // Success
      st.successfulCalls++
      releaseSlot(endpoint)

      // Cache if applicable
      if (cacheable) {
        const cacheKey = computeCacheKey(endpoint, payload, model)
        await setCached(cacheKey, endpoint, result, model)
      }

      return result
    } catch (e: any) {
      releaseSlot(endpoint)
      const classified = classifyZaiError(e, { endpoint, model, attempt })
      st.lastError = classified
      logClassifiedError(classified)

      if (!classified.retryable || attempt === cfg.maxRetries) {
        st.failedCalls++
        // If BLOCKED_UNTIL_RESET, set the endpoint's blockedUntil
        if (classified.state === 'BLOCKED_UNTIL_RESET' && classified.resetAt) {
          st.blockedUntil = classified.resetAt.getTime()
          st.blockReason = `usage window exhausted (code ${classified.businessCode})`
        }
        // For INSUFFICIENT_BALANCE / MODEL_NOT_INCLUDED — block all endpoints
        if (classified.state === 'INSUFFICIENT_BALANCE' || classified.state === 'MODEL_NOT_INCLUDED') {
          for (const ep of Object.keys(endpointStates) as Endpoint[]) {
            endpointStates[ep].blockedUntil = Date.now() + 3600 * 1000
            endpointStates[ep].blockReason = `${classified.state}: ${classified.message}`
          }
        }
        const err = new Error(`Z.ai ${endpoint} failed (state=${classified.state}, code=${classified.businessCode || 'none'}): ${classified.message}`)
        ;(err as any).classified = classified
        throw err
      }

      // Retryable — wait and retry
      st.retriedCalls++
      const waitMs = classified.retryAfterMs || (2000 * Math.pow(2, attempt))
      console.warn(`[scheduler:${endpoint}] Retrying in ${waitMs}ms (attempt ${attempt + 1}/${cfg.maxRetries})`)
      await sleep(waitMs)
      lastError = classified
    }
  }

  st.failedCalls++
  throw new Error(`Z.ai ${endpoint} exhausted retries: ${lastError?.message || 'unknown'}`)
}

// ─── Public API: scheduled Z.ai calls ────────────────────────

export interface LLMOptions {
  thinking?: boolean
  model?: string
  cacheable?: boolean  // set true for deterministic prompts (brief, beats, titles, etc.)
}

export async function llm(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  opts: LLMOptions = {},
): Promise<string> {
  const payload = {
    messages,
    thinking: opts.thinking ? { type: 'enabled' as const } : { type: 'disabled' as const },
    model: opts.model,
  }
  const result = await runScheduled(
    'llm',
    payload,
    async (zai) => zai.chat.completions.create(payload),
    { cacheable: opts.cacheable, model: opts.model || 'glm-4-plus' },
  )
  // Normalize response shape
  if (typeof result === 'string') return result
  if (result?.choices?.[0]?.message?.content) return result.choices[0].message.content
  if (result?.content) return result.content
  return JSON.stringify(result)
}

export interface TTSOptions {
  voice?: string
  speed?: number
  cacheable?: boolean
}

/**
 * TTS — uses voice 'jam' (English gentleman) by default.
 * The Z.ai SDK returns a Response object — we call arrayBuffer() on it.
 * Max 1024 chars per request — we chunk longer text.
 */
export async function tts(text: string, opts: TTSOptions = {}): Promise<Buffer> {
  const voice = opts.voice || 'jam' // English gentleman voice
  const speed = opts.speed ?? 1.0
  const chunks = chunkText(text, 1000) // max 1024 per spec, leave margin

  if (chunks.length === 1) {
    return ttsChunk(chunks[0], voice, speed, opts.cacheable)
  }

  // Multiple chunks — generate each and concatenate via ffmpeg
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const exec = promisify(execFile)
  const { writeFile, mkdir, unlink } = await import('fs/promises')
  const { existsSync } = await import('fs')
  const path = await import('path')

  const tmpDir = path.join(process.cwd(), 'data', 'audio', 'tts-chunks')
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true })

  const chunkPaths: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(tmpDir, `chunk_${Date.now()}_${i}.mp3`)
    const buf = await ttsChunk(chunks[i], voice, speed, opts.cacheable)
    await writeFile(chunkPath, buf)
    chunkPaths.push(chunkPath)
  }

  // Concat
  const outPath = path.join(tmpDir, `concat_${Date.now()}.mp3`)
  const listPath = outPath + '.txt'
  await writeFile(listPath, chunkPaths.map(p => `file '${p}'`).join('\n'))
  await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath, '-y'])
  const result = await readFile(outPath)
  // Cleanup
  for (const p of chunkPaths) { try { await unlink(p) } catch {} }
  try { await unlink(listPath) } catch {}
  try { await unlink(outPath) } catch {}

  return result
}

async function ttsChunk(text: string, voice: string, speed: number, cacheable?: boolean): Promise<Buffer> {
  // Z.ai TTS does NOT support response_format='mp3' (code 1214 "unsupported").
  // Supported formats: 'wav', 'pcm'. Default (no format) returns PCM.
  // We request WAV and convert to MP3 via ffmpeg so the rest of the pipeline
  // can assume MP3 files everywhere.
  const payload = {
    input: text,
    voice,
    speed,
    response_format: 'wav' as const,
    stream: false,
  }
  const wavBuffer = await runScheduled(
    'tts',
    payload,
    async (zai) => {
      const res = await zai.audio.tts.create(payload)
      // The SDK returns a Response object — call arrayBuffer()
      if (res instanceof Response) {
        const ab = await res.arrayBuffer()
        return Buffer.from(new Uint8Array(ab))
      }
      if (Buffer.isBuffer(res)) return res
      if (res instanceof ArrayBuffer) return Buffer.from(new Uint8Array(res))
      if (res?.data) return Buffer.from(res.data, 'base64')
      throw new Error(`TTS returned unexpected shape: ${typeof res}`)
    },
    { cacheable, model: 'tts' },
  )

  // Convert WAV → MP3 via ffmpeg (the rest of the pipeline expects MP3)
  try {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const { writeFile, readFile, unlink, mkdir } = await import('fs/promises')
    const { existsSync } = await import('fs')
    const path = await import('path')
    const exec = promisify(execFile)
    const tmpDir = path.join(process.cwd(), 'data', 'audio', 'tts-tmp')
    if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true })
    const wavPath = path.join(tmpDir, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`)
    const mp3Path = wavPath.replace('.wav', '.mp3')
    await writeFile(wavPath, wavBuffer)
    await exec('ffmpeg', ['-i', wavPath, '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', '24000', '-y', mp3Path])
    const mp3Buffer = await readFile(mp3Path)
    try { await unlink(wavPath) } catch {}
    try { await unlink(mp3Path) } catch {}
    return mp3Buffer
  } catch (e: any) {
    console.warn('[tts] WAV→MP3 conversion failed, returning WAV:', e.message.slice(0, 80))
    return wavBuffer
  }
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  // Split on sentence boundaries first
  const sentences = text.match(/[^.!?]+[.!?]+|\S+/g) || [text]
  let current = ''
  for (const s of sentences) {
    if ((current + s).length > maxLen) {
      if (current) chunks.push(current.trim())
      current = s
    } else {
      current += s
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

export interface ImageOptions {
  size?: '1024x1024' | '1344x768' | '1440x720'
  cacheable?: boolean
}

export async function generateImage(prompt: string, opts: ImageOptions = {}): Promise<Buffer> {
  const payload = {
    prompt,
    size: opts.size || '1344x768',
  }
  const result = await runScheduled(
    'image',
    payload,
    async (zai) => {
      const res = await zai.images.generations.create(payload)
      if (res?.data?.[0]?.base64) {
        return Buffer.from(res.data[0].base64, 'base64')
      }
      throw new Error('Image generation returned no data')
    },
    { cacheable: opts.cacheable, model: 'image-gen' },
  )
  return result
}

export async function webSearch(query: string, num: number = 10): Promise<Array<any>> {
  const payload = { query, num }
  const result = await runScheduled(
    'search',
    payload,
    async (zai) => zai.functions.invoke('web_search', payload),
    { cacheable: true, model: 'web_search' },
  )
  return result as any[]
}

export async function readPage(url: string): Promise<{ title: string; html: string; publishedTime?: string }> {
  const payload = { url }
  const result = await runScheduled(
    'search',
    payload,
    async (zai) => zai.functions.invoke('page_reader', payload),
    { cacheable: true, model: 'page_reader' },
  )
  return (result as any)?.data || (result as any)
}

export interface VideoGenOptions {
  quality?: 'speed' | 'quality'
  withAudio?: boolean
  size?: string
  fps?: number
  duration?: number
  imageUrl?: string
  maxWaitMs?: number
}

export async function generateVideo(prompt: string, opts: VideoGenOptions = {}): Promise<{ taskId: string; localPath: string; duration: number; width: number; height: number; codec: string; estimatedCost: number }> {
  // Video gen is async — submit + poll
  const payload = {
    prompt,
    image_url: opts.imageUrl,
    quality: opts.quality || 'speed',
    with_audio: opts.withAudio ?? false,
    size: opts.size,
    fps: opts.fps,
    duration: opts.duration,
  }
  const submitResult = await runScheduled(
    'video',
    payload,
    async (zai) => zai.video.generations.create(payload),
    { cacheable: false, model: 'video-gen' },
  )
  const taskId = (submitResult as any).id
  if (!taskId) throw new Error(`Video generation returned no task ID: ${JSON.stringify(submitResult)}`)

  // Poll for completion
  const maxWaitMs = opts.maxWaitMs || 5 * 60 * 1000
  const startTime = Date.now()
  while (Date.now() - startTime < maxWaitMs) {
    await sleep(5000)
    const pollResult = await runScheduled(
      'video',
      { taskId },
      async (zai) => zai.async.result.query(taskId),
      { cacheable: false, model: 'video-poll' },
    )
    const status = (pollResult as any).task_status
    if (status === 'SUCCESS') {
      const videoUrl = (pollResult as any).video_result?.[0]?.url ||
        (pollResult as any).video_url || (pollResult as any).url || (pollResult as any).video
      if (!videoUrl) throw new Error(`Video task ${taskId} succeeded but no URL: ${JSON.stringify(pollResult)}`)

      // Download
      const dlRes = await fetch(videoUrl)
      if (!dlRes.ok) throw new Error(`Download failed: HTTP ${dlRes.status}`)
      const buffer = Buffer.from(await dlRes.arrayBuffer())

      // Save
      const { writeFile, mkdir } = await import('fs/promises')
      const { existsSync } = await import('fs')
      const path = await import('path')
      const dir = path.join(process.cwd(), 'data', 'generated-video')
      if (!existsSync(dir)) await mkdir(dir, { recursive: true })
      const localPath = path.join(dir, `${taskId}.mp4`)
      await writeFile(localPath, buffer)

      // Probe
      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const exec = promisify(execFile)
      let duration = 0, width = 0, height = 0, codec = 'unknown'
      try {
        const { stdout } = await exec('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,duration', '-of', 'json', localPath])
        const d = JSON.parse(stdout).streams?.[0] || {}
        duration = parseFloat(d.duration || '0') || 0
        width = parseInt(d.width || '0', 10)
        height = parseInt(d.height || '0', 10)
        codec = d.codec_name || 'unknown'
      } catch {}

      return {
        taskId,
        localPath,
        duration,
        width, height, codec,
        estimatedCost: (opts.duration || duration) * 0.10,
      }
    }
    if (status === 'FAIL') throw new Error(`Video task ${taskId} failed: ${JSON.stringify(pollResult)}`)
    // Still PROCESSING
    console.log(`[scheduler:video] Task ${taskId} still processing (${((Date.now() - startTime) / 1000).toFixed(0)}s)`)
  }
  throw new Error(`Video task ${taskId} timed out after ${maxWaitMs}ms`)
}

// ─── Vision (for quality critic) ─────────────────────────────

export async function vision(imageBase64: string, prompt: string): Promise<string> {
  const payload = {
    messages: [{
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: prompt },
        { type: 'image_url' as const, image_url: { url: `data:image/png;base64,${imageBase64}` } },
      ],
    }],
    thinking: { type: 'disabled' as const },
  }
  const result = await runScheduled(
    'llm',
    payload,
    async (zai) => zai.chat.completions.createVision(payload),
    { cacheable: false, model: 'vision' },
  )
  return (result as any)?.choices?.[0]?.message?.content || JSON.stringify(result)
}

// ─── Scheduler stats (for reporting) ────────────────────────

export function getSchedulerStats() {
  const stats: any = {}
  for (const [ep, st] of Object.entries(endpointStates)) {
    stats[ep] = {
      totalCalls: st.totalCalls,
      successfulCalls: st.successfulCalls,
      cachedHits: st.cachedHits,
      retriedCalls: st.retriedCalls,
      failedCalls: st.failedCalls,
      blockedUntil: st.blockedUntil > Date.now() ? new Date(st.blockedUntil).toISOString() : null,
      blockReason: st.blockReason,
      lastError: st.lastError ? {
        state: st.lastError.state,
        businessCode: st.lastError.businessCode,
        message: st.lastError.message.slice(0, 100),
      } : null,
    }
  }
  return stats
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
