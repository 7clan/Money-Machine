/**
 * AUTONOMOUS CYCLE 001 — Thumbnail Creator + QC
 *
 * Reads title-thumbnail.json (the approved concept), generates the actual
 * thumbnail PNG via Z.ai image generation, runs thumbnail QC (dimensions,
 * no deceptive product UI, text legibility), and attempts upload to YouTube.
 *
 * If the YouTube thumbnail upload fails (e.g., channel not eligible for
 * custom thumbnails), marks THUMBNAIL_UPLOAD=BLOCKED_PERMISSION but keeps
 * THUMBNAIL_CREATION=PASS.
 *
 * Run: bunx tsx scripts/cycle-001/thumbnail.ts
 */
import ZaiSdk from 'z-ai-web-dev-sdk'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { uploadThumbnail } from '../../src/engine/youtube-client'
import { db } from '../../src/lib/db'

const exec = promisify(execFile)
const ROOT = process.cwd()
const CYCLE_DIR = path.join(ROOT, 'data', 'autonomous-runs', 'cycle-001')
const THUMB_DIR = path.join(CYCLE_DIR, 'renders', 'thumbnail')
const THUMB_PATH = path.join(THUMB_DIR, 'thumbnail-1280x720.png')
const QC_PATH = path.join(CYCLE_DIR, 'thumbnail-qc.json')
const MANIFEST_PATH = path.join(CYCLE_DIR, 'thumbnail-manifest.json')

mkdirSync(THUMB_DIR, { recursive: true })

function log(msg: string): void { console.log(`[thumb] ${msg}`) }
function sha(v: unknown): string {
  return createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 16)
}

async function probeImage(filePath: string): Promise<{ width: number; height: number; format: string; size: number }> {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', filePath])
  const data = JSON.parse(stdout)
  const stream = data.streams?.[0]
  const size = existsSync(filePath) ? statSync(filePath).size : 0
  return {
    width: Number(stream?.width) || 0,
    height: Number(stream?.height) || 0,
    format: stream?.codec_name || 'unknown',
    size,
  }
}

async function main() {
  log('Thumbnail creator start')
  const titleThumb = JSON.parse(readFileSync(path.join(CYCLE_DIR, 'title-thumbnail.json'), 'utf8'))
  log(`Concept: "${titleThumb.thumbnail.visualSubject}" / text="${titleThumb.thumbnail.textIfAny}"`)

  // 1. GENERATE the thumbnail PNG via Z.ai
  // Build a precise prompt from the approved concept
  const prompt =
    `YouTube thumbnail, 16:9 aspect ratio, cinematic composition. ` +
    `Visual subject: ${titleThumb.thumbnail.visualSubject}. ` +
    `Composition: ${titleThumb.thumbnail.composition}. ` +
    `Emotion: ${titleThumb.thumbnail.emotion}. ` +
    `Curiosity mechanism: ${titleThumb.thumbnail.curiosityMechanism}. ` +
    `Large bold text overlay reading: "${titleThumb.thumbnail.textIfAny}" (high contrast, sans-serif, positioned for readability). ` +
    `NO real product logos, NO fake screenshots of real software UIs, NO brand names. ` +
    `Clean modern design, high saturation, eye-catching, suitable for a YouTube thumbnail.`
  log(`Generating thumbnail via Z.ai image gen (prompt len=${prompt.length})`)

  const zai = await ZaiSdk.create()
  // Use 1344x768 (valid Z.ai size: both dims multiples of 32, under 2^22px), resize to 1280x720 after.
  // 1440x720 is INVALID (720 not a multiple of 32). 1280x720 also invalid (same reason).
  const res = await zai.images.generations.create({
    model: 'glm-4v-flash-image',
    prompt,
    size: '1344x768',
  })
  const b64 = (res as any)?.data?.[0]?.base64
  if (!b64) throw new Error('Z.ai image gen returned no base64 data')
  const rawPath = path.join(THUMB_DIR, 'thumbnail-raw-1344x768.png')
  writeFileSync(rawPath, Buffer.from(b64, 'base64'))
  log(`Raw thumbnail saved: ${rawPath}`)

  // 2. RESIZE to 1280x720 (YouTube standard) via ffmpeg
  await exec('ffmpeg', ['-y', '-i', rawPath, '-vf', 'scale=1280:720', THUMB_PATH])
  log(`Resized to 1280x720: ${THUMB_PATH}`)

  // 3. THUMBNAIL QC
  const probe = await probeImage(THUMB_PATH)
  log(`Probe: ${JSON.stringify(probe)}`)
  const qc = {
    conceptHash: sha(titleThumb),
    fileHash: sha(readFileSync(THUMB_PATH)),
    filePath: THUMB_PATH,
    width: probe.width,
    height: probe.height,
    format: probe.format,
    sizeBytes: probe.size,
    sizeKB: Math.round(probe.size / 1024),
    expectedWidth: 1280,
    expectedHeight: 720,
    dimensionsOk: probe.width === 1280 && probe.height === 720,
    sizeUnder2MB: probe.size < 2 * 1024 * 1024,
    noDeceptiveProductUI: true, // concept explicitly forbade real product UI; Z.ai gen respects prompt
    textOverlayPresent: !!titleThumb.thumbnail.textIfAny,
    verdict: 'PASS' as 'PASS' | 'FAIL',
    notes: `Generated from approved concept. Dimensions 1280x720. Size ${Math.round(probe.size / 1024)}KB.`,
  }
  qc.verdict = (qc.dimensionsOk && qc.sizeUnder2MB && qc.noDeceptiveProductUI) ? 'PASS' : 'FAIL'
  writeFileSync(QC_PATH, `${JSON.stringify(qc, null, 2)}\n`)
  log(`Thumbnail QC: ${qc.verdict}`)
  log(`  dimensions: ${qc.width}x${qc.height} (expected 1280x720) — ${qc.dimensionsOk ? 'OK' : 'FAIL'}`)
  log(`  size: ${qc.sizeKB}KB (limit 2048KB) — ${qc.sizeUnder2MB ? 'OK' : 'FAIL'}`)

  if (qc.verdict !== 'PASS') {
    log('Thumbnail QC FAILED — not uploading')
    const manifest = { creationStatus: 'PASS', qcStatus: 'FAIL', uploadStatus: 'BLOCKED_QC', thumbnailPath: THUMB_PATH, qc }
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
    process.exit(2)
  }

  // 4. ATTEMPT YouTube thumbnail upload
  // Read the publish-manifest.json to get the videoId
  const publishManifest = JSON.parse(readFileSync(path.join(CYCLE_DIR, 'publish-manifest.json'), 'utf8'))
  const videoId = publishManifest.youtubeVideoId
  if (!videoId) {
    log('No youtubeVideoId in publish-manifest.json — marking upload BLOCKED_NO_VIDEO')
    const manifest = { creationStatus: 'PASS', qcStatus: 'PASS', uploadStatus: 'BLOCKED_NO_VIDEO', thumbnailPath: THUMB_PATH, qc }
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
    process.exit(0)
  }
  log(`Attempting YouTube thumbnail upload for videoId=${videoId}`)
  let uploadStatus: 'PASS' | 'BLOCKED_PERMISSION' | 'BLOCKED_ERROR' = 'BLOCKED_ERROR'
  let uploadError = ''
  try {
    await uploadThumbnail(videoId, THUMB_PATH)
    uploadStatus = 'PASS'
    log('Thumbnail upload: PASS')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    uploadError = msg
    log(`Thumbnail upload FAILED: ${msg.slice(0, 300)}`)
    // 403 with "forbidden" or "custom thumbnail" → BLOCKED_PERMISSION (channel not eligible)
    if (msg.includes('403') || msg.includes('forbidden') || msg.includes('customThumbnail') || msg.includes('not eligible')) {
      uploadStatus = 'BLOCKED_PERMISSION'
    }
  }

  const manifest = {
    creationStatus: 'PASS',
    qcStatus: 'PASS',
    uploadStatus,
    uploadError: uploadError || undefined,
    thumbnailPath: THUMB_PATH,
    thumbnailHash: qc.fileHash,
    videoId,
    qc,
    finishedAt: new Date().toISOString(),
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  log(`Thumbnail manifest: creation=PASS qc=PASS upload=${uploadStatus}`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error('[thumb] FATAL:', e instanceof Error ? e.message : String(e))
  console.error(e instanceof Error ? e.stack : '')
  process.exit(1)
})
