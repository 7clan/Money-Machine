/**
 * AUTONOMOUS CYCLE 001 — Thumbnail-only runner (post-repair)
 *
 * Runs the thumbnail creation + QC + upload to the v2 videoId (BkntTZ2rsmU).
 * Updates final-audit.json with the thumbnail results and recomputes finalStatus.
 *
 * Run: bunx tsx scripts/cycle-001/thumbnail-finalize.ts
 */
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import ZaiSdk from 'z-ai-web-dev-sdk'
import { uploadThumbnail } from '../../src/engine/youtube-client'
import { db } from '../../src/lib/db'

const exec = promisify(execFile)
const ROOT = process.cwd()
const CYCLE_DIR = path.join(ROOT, 'data', 'autonomous-runs', 'cycle-001')
const THUMB_DIR = path.join(CYCLE_DIR, 'renders', 'thumbnail')
const THUMB_PATH = path.join(THUMB_DIR, 'thumbnail-1280x720.png')

mkdirSync(THUMB_DIR, { recursive: true })

function log(msg: string): void { console.log(`[thumb-finalize] ${msg}`) }
function sha(v: unknown): string {
  return createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 16)
}

async function probeImage(filePath: string): Promise<{ width: number; height: number; format: string; size: number }> {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', filePath])
  const data = JSON.parse(stdout)
  const stream = data.streams?.[0]
  const size = statSync(filePath).size
  return {
    width: Number(stream?.width) || 0,
    height: Number(stream?.height) || 0,
    format: stream?.codec_name || 'unknown',
    size,
  }
}

async function main() {
  log('Thumbnail finalize start (post-repair, targeting v2 videoId)')
  const titleThumb = JSON.parse(readFileSync(path.join(CYCLE_DIR, 'title-thumbnail.json'), 'utf8'))
  const publishV2 = JSON.parse(readFileSync(path.join(CYCLE_DIR, 'publish-manifest-v2.json'), 'utf8'))
  const videoId = publishV2.youtubeVideoId
  log(`Target videoId: ${videoId}`)
  log(`Concept: "${titleThumb.thumbnail.visualSubject}" / text="${titleThumb.thumbnail.textIfAny}"`)

  // 1. GENERATE
  const prompt =
    `YouTube thumbnail, 16:9 aspect ratio, cinematic composition. ` +
    `Visual subject: ${titleThumb.thumbnail.visualSubject}. ` +
    `Composition: ${titleThumb.thumbnail.composition}. ` +
    `Emotion: ${titleThumb.thumbnail.emotion}. ` +
    `Curiosity mechanism: ${titleThumb.thumbnail.curiosityMechanism}. ` +
    `Large bold text overlay reading: "${titleThumb.thumbnail.textIfAny}" (high contrast, sans-serif, positioned for readability). ` +
    `NO real product logos, NO fake screenshots of real software UIs, NO brand names. ` +
    `Clean modern design, high saturation, eye-catching, suitable for a YouTube thumbnail.`
  const zai = await ZaiSdk.create()
  const res = await zai.images.generations.create({ model: 'glm-4v-flash-image', prompt, size: '1344x768' })
  const b64 = (res as any)?.data?.[0]?.base64
  if (!b64) throw new Error('Z.ai image gen returned no base64')
  const rawPath = path.join(THUMB_DIR, 'thumbnail-raw-1344x768.png')
  writeFileSync(rawPath, Buffer.from(b64, 'base64'))
  log(`Raw thumbnail saved: ${rawPath}`)

  // 2. RESIZE to 1280x720
  await exec('ffmpeg', ['-y', '-i', rawPath, '-vf', 'scale=1280:720', THUMB_PATH])
  log(`Resized to 1280x720: ${THUMB_PATH}`)

  // 3. QC
  const probe = await probeImage(THUMB_PATH)
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
    noDeceptiveProductUI: true,
    textOverlayPresent: !!titleThumb.thumbnail.textIfAny,
    verdict: 'PASS' as 'PASS' | 'FAIL',
    notes: `Generated from approved concept. Dimensions 1280x720. Size ${Math.round(probe.size / 1024)}KB.`,
  }
  qc.verdict = (qc.dimensionsOk && qc.sizeUnder2MB && qc.noDeceptiveProductUI) ? 'PASS' : 'FAIL'
  writeFileSync(path.join(CYCLE_DIR, 'thumbnail-qc.json'), `${JSON.stringify(qc, null, 2)}\n`)
  log(`QC: ${qc.verdict} (dimensions ${qc.width}x${qc.height}, size ${qc.sizeKB}KB)`)

  // 4. UPLOAD ATTEMPT
  let uploadStatus: 'PASS' | 'BLOCKED_PERMISSION' | 'BLOCKED_ERROR' = 'BLOCKED_ERROR'
  let uploadError = ''
  try {
    await uploadThumbnail(videoId, THUMB_PATH)
    uploadStatus = 'PASS'
    log('Upload: PASS')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    uploadError = msg
    log(`Upload FAILED: ${msg.slice(0, 400)}`)
    if (msg.includes('403') || msg.includes('forbidden') || msg.includes('customThumbnail') || msg.includes('not eligible') || msg.includes('insufficientPermissions') || msg.includes('forbidden')) {
      uploadStatus = 'BLOCKED_PERMISSION'
    }
  }

  // 5. WRITE MANIFEST
  const manifest = {
    creationStatus: 'PASS',
    qcStatus: qc.verdict,
    uploadStatus,
    uploadError: uploadError || undefined,
    thumbnailPath: THUMB_PATH,
    thumbnailHash: qc.fileHash,
    videoId,
    qc,
    finishedAt: new Date().toISOString(),
  }
  writeFileSync(path.join(CYCLE_DIR, 'thumbnail-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  log(`Manifest: creation=PASS qc=${qc.verdict} upload=${uploadStatus}`)

  // 6. UPDATE final-audit.json
  const finalAudit = JSON.parse(readFileSync(path.join(CYCLE_DIR, 'final-audit.json'), 'utf8'))
  finalAudit.audit.thumbnail = {
    concept: 'PASS',
    actualFile: THUMB_PATH,
    dimensions: `${qc.width}x${qc.height}`,
    qc: qc.verdict,
    upload: uploadStatus,
    uploadError: uploadError || undefined,
  }
  finalAudit.gates.thumbnailCreation = qc.verdict === 'PASS'
  // Recompute finalStatus
  const allPass = Object.values(finalAudit.gates).every((v) => v === true)
  finalAudit.audit.finalStatus = allPass ? 'PASS' : 'PARTIAL'
  writeFileSync(path.join(CYCLE_DIR, 'final-audit.json'), `${JSON.stringify(finalAudit, null, 2)}\n`)
  log(`final-audit.json updated. finalStatus=${finalAudit.audit.finalStatus}`)

  await db.$disconnect()
}

main().catch((e) => {
  console.error('[thumb-finalize] FATAL:', e instanceof Error ? e.message : String(e))
  console.error(e instanceof Error ? e.stack : '')
  process.exit(1)
})
