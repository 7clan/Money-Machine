/**
 * Z.ai Video Generation Provider (Phase 17)
 *
 * Wraps the official z-ai-web-dev-sdk video.generations API.
 *
 * Supports:
 *   - text-to-video (prompt only)
 *   - image-to-video (prompt + reference image)
 *   - asynchronous job polling (PROCESSING → SUCCESS/FAIL)
 *   - download to local storage
 *   - verification via ffprobe
 *   - cost logging
 *
 * Returned temporary URLs MUST be downloaded immediately (they expire).
 */

import ZAI from 'z-ai-web-dev-sdk'
import { writeFile, mkdir, stat, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { randomUUID } from 'crypto'

const exec = promisify(execFile)

const DATA_DIR = path.join(process.cwd(), 'data')
const VIDEOS_DIR = path.join(DATA_DIR, 'videos')
const GENERATED_VIDEO_DIR = path.join(DATA_DIR, 'generated-video')

// Estimated cost in USD per second of generated video (Z.ai pricing tier 1)
// Used for cost logging only — actual billing is server-side.
const ESTIMATED_COST_PER_SECOND = 0.10

let zaiInstance: ZAI | null = null

async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export interface VideoGenerationRequest {
  /** The prompt describing the desired motion / scene */
  prompt: string
  /** Optional reference image URL (or local path → will be uploaded) for image-to-video */
  imageUrl?: string
  /** 'speed' for fast generation, 'quality' for higher quality */
  quality?: 'speed' | 'quality'
  /** Whether to generate audio with the video */
  withAudio?: boolean
  /** Output resolution spec, e.g. '1280x720' */
  size?: string
  /** Frames per second */
  fps?: number
  /** Target duration in seconds */
  duration?: number
}

export interface VideoGenerationResult {
  taskId: string
  localPath: string
  duration: number
  width: number
  height: number
  codec: string
  estimatedCost: number
  generationTimeMs: number
}

/**
 * Submit a video generation job and poll until complete.
 * Downloads the resulting video to local storage.
 *
 * @param request Generation parameters
 * @param maxWaitMs Maximum time to wait for completion (default 5 minutes)
 */
export async function generateVideo(
  request: VideoGenerationRequest,
  maxWaitMs: number = 5 * 60 * 1000,
): Promise<VideoGenerationResult> {
  if (!existsSync(GENERATED_VIDEO_DIR)) {
    await mkdir(GENERATED_VIDEO_DIR, { recursive: true })
  }

  const zai = await getZAI()
  const startTime = Date.now()

  console.log(`[zai-video] Submitting generation: prompt="${request.prompt.slice(0, 80)}..." duration=${request.duration}s`)

  // Step 1: Submit the generation job
  const submitResponse = await zai.video.generations.create({
    prompt: request.prompt,
    image_url: request.imageUrl,
    quality: request.quality || 'speed',
    with_audio: request.withAudio ?? false,
    size: request.size,
    fps: request.fps,
    duration: request.duration,
  })

  const taskId = submitResponse.id
  if (!taskId) {
    throw new Error(`Video generation returned no task ID: ${JSON.stringify(submitResponse)}`)
  }

  console.log(`[zai-video] Task ${taskId} submitted. Status: ${submitResponse.task_status}`)

  // Step 2: Poll for completion
  const result = await pollForCompletion(zai, taskId, maxWaitMs, startTime)

  // Step 3: Find the video URL in the result (the SDK returns it in various shapes)
  const videoUrl =
    result.video_result?.[0]?.url ||
    result.video_url ||
    result.url ||
    result.video
  if (!videoUrl) {
    throw new Error(`Video generation succeeded but no URL in response: ${JSON.stringify(result)}`)
  }

  // Step 4: Download the video to local storage
  const localPath = path.join(GENERATED_VIDEO_DIR, `${taskId}.mp4`)
  await downloadVideo(videoUrl, localPath)

  // Step 5: Verify with ffprobe
  const probe = await probeVideo(localPath)

  const generationTimeMs = Date.now() - startTime
  const estimatedCost = (request.duration || probe.duration) * ESTIMATED_COST_PER_SECOND

  console.log(`[zai-video] Task ${taskId} complete: ${probe.duration}s ${probe.width}x${probe.height} ${probe.codec}, cost ~$${estimatedCost.toFixed(2)}`)

  return {
    taskId,
    localPath,
    duration: probe.duration,
    width: probe.width,
    height: probe.height,
    codec: probe.codec,
    estimatedCost,
    generationTimeMs,
  }
}

async function pollForCompletion(
  zai: ZAI,
  taskId: string,
  maxWaitMs: number,
  startTime: number,
): Promise<any> {
  const pollIntervalMs = 5000 // 5 seconds between polls
  while (Date.now() - startTime < maxWaitMs) {
    await sleep(pollIntervalMs)
    try {
      const result = await zai.async.result.query(taskId)
      if (result.task_status === 'SUCCESS') {
        return result
      }
      if (result.task_status === 'FAIL') {
        throw new Error(`Video generation task ${taskId} failed: ${JSON.stringify(result)}`)
      }
      // Still PROCESSING — keep polling
      console.log(`[zai-video] Task ${taskId} still processing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`)
    } catch (e: any) {
      // Network errors are retriable — keep polling until maxWaitMs
      if (e.message?.includes('failed')) {
        throw e
      }
      console.warn(`[zai-video] Poll error for task ${taskId} (will retry):`, e.message)
    }
  }
  throw new Error(`Video generation task ${taskId} timed out after ${maxWaitMs}ms`)
}

async function downloadVideo(url: string, localPath: string): Promise<void> {
  // Use fetch (Node 18+) for download
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download video from ${url}: HTTP ${res.status}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  await writeFile(localPath, buffer)

  // Sanity check
  const stats = await stat(localPath)
  if (stats.size < 1024) {
    await unlink(localPath).catch(() => {})
    throw new Error(`Downloaded video is suspiciously small (${stats.size} bytes) — likely an error page`)
  }
}

async function probeVideo(localPath: string): Promise<{ duration: number; width: number; height: number; codec: string }> {
  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height,duration',
      '-of', 'json',
      localPath,
    ])
    const data = JSON.parse(stdout)
    const stream = data.streams?.[0] || {}
    return {
      duration: parseFloat(stream.duration || '0') || 0,
      width: parseInt(stream.width || '0', 10),
      height: parseInt(stream.height || '0', 10),
      codec: stream.codec_name || 'unknown',
    }
  } catch (e) {
    console.warn('[zai-video] ffprobe failed:', e)
    return { duration: 0, width: 0, height: 0, codec: 'unknown' }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Submit multiple video generation jobs in parallel (limited concurrency).
 * Returns results in the same order as the input requests.
 */
export async function generateVideosParallel(
  requests: VideoGenerationRequest[],
  concurrency: number = 2,
): Promise<Array<VideoGenerationResult | Error>> {
  const results: Array<VideoGenerationResult | Error> = new Array(requests.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const i = nextIndex++
      if (i >= requests.length) return
      try {
        results[i] = await generateVideo(requests[i])
      } catch (e: any) {
        console.error(`[zai-video] Parallel job ${i} failed:`, e.message)
        results[i] = e
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, requests.length) }, () => worker())
  await Promise.all(workers)
  return results
}
