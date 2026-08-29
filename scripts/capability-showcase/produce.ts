/**
 * AUTONOMOUS CYCLE 001 — Production Worker
 *
 * Reads script.json + visual-shots.json from env paths, generates:
 *   - TTS narration per script segment (z-ai SDK, voice=jam, format=wav → mp3)
 *   - One Z.ai image per GENERATED_IMAGE shot (cached, content-addressed)
 *   - Chunked Remotion render (3-segment chunks, ffmpeg concat)
 * Writes renders/production-manifest.json with the final video path + hashes.
 *
 * Run: bunx tsx scripts/capability-showcase-001/produce.ts
 */
import ZaiSdk from 'z-ai-web-dev-sdk'
import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from 'fs'
import path from 'path'

const exec = promisify(execFile)
const ROOT = process.cwd()
const SCRIPT_PATH = process.env.CAPABILITY_SHOWCASE_SCRIPT_PATH!
const SHOTS_PATH = process.env.CAPABILITY_SHOWCASE_SHOTS_PATH!
const OUT_DIR = process.env.CAPABILITY_SHOWCASE_OUT_DIR!
const AUDIO_DIR = path.join(OUT_DIR, 'audio')
const IMAGES_DIR = path.join(OUT_DIR, 'images')
const CHUNKS_DIR = path.join(OUT_DIR, 'chunks')
const PUBLIC_DIR = path.join(ROOT, 'public', 'capability-showcase-001')
const FINAL_VIDEO = path.join(OUT_DIR, 'final.mp4')
const MANIFEST_PATH = path.join(OUT_DIR, 'production-manifest.json')
const FPS = 30
const WIDTH = 1920
const HEIGHT = 1080

for (const d of [OUT_DIR, AUDIO_DIR, IMAGES_DIR, CHUNKS_DIR, PUBLIC_DIR]) mkdirSync(d, { recursive: true })

const script = JSON.parse(readFileSync(SCRIPT_PATH, 'utf8'))
const shots = JSON.parse(readFileSync(SHOTS_PATH, 'utf8'))

function sha(v: unknown): string {
  return createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 16)
}
function log(msg: string): void {
  console.log(`[produce] ${msg}`)
}
async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
    return parseFloat(stdout.trim()) || 0
  } catch { return 0 }
}

// ============================================================
// TTS — one narration file per script segment
// ============================================================
async function generateTts(zai: any): Promise<Record<string, { mp3Path: string; durationSec: number; words: number }>> {
  log(`TTS: generating ${script.segments.length} narration files`)
  const manifest: Record<string, { mp3Path: string; durationSec: number; words: number }> = {}
  for (const seg of script.segments) {
    const words = seg.narration.split(/\s+/).length
    const mp3Path = path.join(AUDIO_DIR, `${seg.id}.mp3`)
    const cacheKey = sha(`tts:${seg.id}:${seg.narration}`)
    const cacheMarker = path.join(AUDIO_DIR, `${seg.id}.hash`)
    if (existsSync(mp3Path) && existsSync(cacheMarker) && readFileSync(cacheMarker, 'utf8').trim() === cacheKey) {
      const dur = await probeDuration(mp3Path)
      manifest[seg.id] = { mp3Path, durationSec: dur, words }
      log(`TTS: ${seg.id} cached (dur=${dur.toFixed(2)}s)`)
      continue
    }
    log(`TTS: ${seg.id} generating (${words} words)`)
    const res = await zai.audio.tts.create({
      model: 'glm-1-tts',
      input: seg.narration,
      voice: 'jam',
      response_format: 'wav',
    })
    // SDK returns a fetch Response object — read arrayBuffer
    const buf = Buffer.from(await (res as any).arrayBuffer())
    const wavPath = path.join(AUDIO_DIR, `${seg.id}.wav`)
    writeFileSync(wavPath, buf)
    // WAV → MP3 via ffmpeg
    await exec('ffmpeg', ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '128k', mp3Path])
    const dur = await probeDuration(mp3Path)
    writeFileSync(cacheMarker, cacheKey)
    manifest[seg.id] = { mp3Path, durationSec: dur, words }
    log(`TTS: ${seg.id} done (dur=${dur.toFixed(2)}s)`)
  }
  return manifest
}

// ============================================================
// IMAGE GENERATION — one Z.ai image per GENERATED_IMAGE shot
// ============================================================
async function generateImages(zai: any): Promise<Record<string, string>> {
  const genShots = shots.filter((s: any) => s.type === 'GENERATED_IMAGE' || s.type === 'STOCK_BROLL' || s.type === 'MOTION_GRAPHIC')
  log(`IMG: generating ${genShots.length} images (of ${shots.length} shots)`)
  const manifest: Record<string, string> = {}
  for (const shot of genShots) {
    const prompt = `${shot.purpose}. ${shot.animation}. Cinematic, high detail, 16:9, no text overlay.`
    const cacheKey = sha(`img:${prompt}`)
    const imgPath = path.join(IMAGES_DIR, `${shot.id}-${cacheKey}.png`)
    if (existsSync(imgPath)) {
      manifest[shot.id] = imgPath
      log(`IMG: ${shot.id} cached`)
      continue
    }
    log(`IMG: ${shot.id} generating (${prompt.slice(0, 80)}...)`)
    try {
      const res = await zai.images.generations.create({
        model: 'glm-4v-flash-image',
        prompt,
        size: '1344x768',
      })
      const b64 = (res as any)?.data?.[0]?.base64
      if (!b64) throw new Error('no image base64 returned')
      writeFileSync(imgPath, Buffer.from(b64, 'base64'))
      manifest[shot.id] = imgPath
      log(`IMG: ${shot.id} done`)
    } catch (e) {
      log(`IMG: ${shot.id} FAILED (${e instanceof Error ? e.message : String(e)}) — will use gradient fallback`)
      manifest[shot.id] = '__FALLBACK__'
    }
  }
  return manifest
}

// ============================================================
// Copy assets to public/ for Remotion staticFile
// ============================================================
function stageAssetsForRemotion(imgManifest: Record<string, string>): Record<string, string> {
  const staged: Record<string, string> = {}
  for (const [shotId, srcPath] of Object.entries(imgManifest)) {
    if (srcPath === '__FALLBACK__') { staged[shotId] = ''; continue }
    const ext = path.extname(srcPath)
    const dst = path.join(PUBLIC_DIR, `${shotId}${ext}`)
    if (srcPath !== dst) copyFileSync(srcPath, dst)
    staged[shotId] = `capability-showcase-001/${shotId}${ext}`
  }
  return staged
}

// ============================================================
// Build shot timeline aligned to actual TTS durations
// ============================================================
function buildAlignedTimeline(ttsManifest: Record<string, { mp3Path: string; durationSec: number; words: number }>) {
  // For each segment, get its real TTS duration
  const segmentsWithDuration = script.segments.map((seg: any) => ({
    ...seg,
    audioDuration: ttsManifest[seg.id]?.durationSec ?? 3,
  }))
  // Cumulative start times
  let t = 0
  const segmentsWithStart = segmentsWithDuration.map((s: any) => {
    const start = t
    const end = t + s.audioDuration
    t = end
    return { ...s, start, end, duration: s.audioDuration }
  })
  // Map each shot to its segment's window — preserve original shot ordering within the segment
  const shotsWithTime = shots.map((shot: any, i: number) => {
    const seg = segmentsWithStart.find((s: any) => s.id === shot.segmentId)
    if (!seg) return { ...shot, start: i * 3, end: i * 3 + 3, duration: 3 }
    // Distribute shots within the segment evenly
    const segShots = shots.filter((s: any) => s.segmentId === shot.segmentId)
    const idx = segShots.findIndex((s: any) => s.id === shot.id)
    const perShot = seg.duration / segShots.length
    const start = seg.start + idx * perShot
    return { ...shot, start, end: start + perShot, duration: perShot, segmentStart: seg.start, segmentEnd: seg.end }
  })
  const totalDuration = t
  return { segmentsWithStart, shotsWithTime, totalDuration }
}

// ============================================================
// Chunked Remotion render
// ============================================================
async function renderChunked(shotsWithTime: any[], segmentsWithStart: any[], imgStaged: Record<string, string>, ttsManifest: Record<string, { mp3Path: string; durationSec: number }>, totalDuration: number): Promise<{ videoPath: string; durationSec: number }> {
  // Chunk by 3 segments (or fewer for the last chunk)
  const SEG_PER_CHUNK = 3
  const chunks: { index: number; segments: any[]; shots: any[]; audioFiles: string[] }[] = []
  for (let i = 0; i < segmentsWithStart.length; i += SEG_PER_CHUNK) {
    const segs = segmentsWithStart.slice(i, i + SEG_PER_CHUNK)
    const segIds = new Set(segs.map((s: any) => s.id))
    const segShots = shotsWithTime.filter((s: any) => segIds.has(s.segmentId))
    const audioFiles = segs.map((s: any) => ttsManifest[s.id].mp3Path)
    chunks.push({ index: chunks.length, segments: segs, shots: segShots, audioFiles })
  }
  log(`RENDER: ${chunks.length} chunks (max ${SEG_PER_CHUNK} segments each)`)
  // Copy audio to public for staticFile
  const audioPublic: Record<string, string> = {}
  for (const seg of segmentsWithStart) {
    const src = ttsManifest[seg.id].mp3Path
    const dst = path.join(PUBLIC_DIR, `audio-${seg.id}.mp3`)
    copyFileSync(src, dst)
    audioPublic[seg.id] = `capability-showcase-001/audio-${seg.id}.mp3`
  }
  // Render each chunk
  const chunkPaths: string[] = []
  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')
  log('RENDER: bundling Remotion composition...')
  const bundlePath = await bundle({
    entryPoint: path.join(ROOT, 'src', 'video', 'Root.tsx'),
    // Override webpack to avoid turbopack issues
  })
  log(`RENDER: bundle ready at ${bundlePath}`)
  const inputProps = {
    shots: shotsWithTime,
    segments: segmentsWithStart,
    images: imgStaged,
    audio: audioPublic,
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
  }
  for (const chunk of chunks) {
    const chunkStart = chunk.segments[0].start
    const chunkEnd = chunk.segments[chunk.segments.length - 1].end
    const chunkDuration = chunkEnd - chunkStart
    const durationInFrames = Math.max(30, Math.round(chunkDuration * FPS))
    const chunkPath = path.join(CHUNKS_DIR, `chunk-${chunk.index}.mp4`)
    if (existsSync(chunkPath) && statSync(chunkPath).size > 50_000) {
      log(`RENDER: chunk ${chunk.index} cached`)
      chunkPaths.push(chunkPath)
      continue
    }
    log(`RENDER: chunk ${chunk.index} (frames=${durationInFrames}, dur=${chunkDuration.toFixed(2)}s)`)
    // Local shots: shift to chunk-local time
    const localShots = chunk.shots.map((s: any) => ({ ...s, start: s.start - chunkStart, end: s.end - chunkStart }))
    const localSegments = chunk.segments.map((s: any) => ({ ...s, start: s.start - chunkStart, end: s.end - chunkStart }))
    const localInputProps = { ...inputProps, shots: localShots, segments: localSegments, chunkStart, chunkEnd }
    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: 'cycle-001',
      inputProps: localInputProps,
    })
    // CRITICAL FIX: override the composition's durationInFrames to match this chunk's
    // actual duration. The registered Composition in Root.tsx has a hardcoded default
    // (300 frames = 10s) — without this override every chunk renders only 10s
    // regardless of its real duration, truncating the final video.
    composition.durationInFrames = durationInFrames
    composition.fps = FPS
    composition.width = WIDTH
    composition.height = HEIGHT
    log(`RENDER: chunk ${chunk.index} overridden durationInFrames=${durationInFrames} (was ${composition.durationInFrames === durationInFrames ? 'same' : 'default'})`)
    await renderMedia({
      composition,
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: chunkPath,
      inputProps: localInputProps,
      onProgress: ({ progress }) => {
        if (Math.random() < 0.05) log(`RENDER: chunk ${chunk.index} progress=${(progress * 100).toFixed(0)}%`)
      },
    })
    chunkPaths.push(chunkPath)
    log(`RENDER: chunk ${chunk.index} done`)
  }
  // Concat via ffmpeg
  log('RENDER: concatenating chunks')
  const concatList = path.join(CHUNKS_DIR, 'concat.txt')
  writeFileSync(concatList, chunkPaths.map((p) => `file '${path.basename(p)}'`).join('\n') + '\n')
  await exec('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', FINAL_VIDEO])
  const finalDur = await probeDuration(FINAL_VIDEO)
  log(`RENDER: final video ready at ${FINAL_VIDEO} (${finalDur.toFixed(2)}s)`)
  return { videoPath: FINAL_VIDEO, durationSec: finalDur }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  log(`Production worker start — ${script.segments.length} segments, ${shots.length} shots`)
  const zai = await ZaiSdk.create()
  // 1. TTS per segment
  const ttsManifest = await generateTts(zai)
  // 2. Images per GENERATED_IMAGE shot
  const imgManifest = await generateImages(zai)
  // 3. Stage assets to public/
  const imgStaged = stageAssetsForRemotion(imgManifest)
  // 4. Build aligned timeline
  const { segmentsWithStart, shotsWithTime, totalDuration } = buildAlignedTimeline(ttsManifest)
  log(`Timeline: ${segmentsWithStart.length} segments, ${shotsWithTime.length} shots, total=${totalDuration.toFixed(2)}s`)
  // 5. Chunked render
  const { videoPath, durationSec } = await renderChunked(shotsWithTime, segmentsWithStart, imgStaged, ttsManifest, totalDuration)
  // 6. Build manifests
  const assetManifest = {
    assets: Object.entries(imgStaged).filter(([, p]) => p).map(([shotId, publicPath]) => {
      const shot = shots.find((s: any) => s.id === shotId)
      return {
        id: `asset-${shotId}`,
        type: 'generated-image',
        localPath: path.join(PUBLIC_DIR, path.basename(publicPath)),
        beatId: shotId,
        reasonForUse: shot?.purpose ?? '',
        provenance: 'generated' as const,
      }
    }),
  }
  const audioManifest = {
    assets: Object.entries(ttsManifest).map(([segId, m]) => ({
      id: `audio-${segId}`,
      type: 'tts',
      localPath: m.mp3Path,
      beatId: segId,
      durationSec: m.durationSec,
      words: m.words,
      provenance: 'generated' as const,
    })),
  }
  const compositionHash = sha({ script, shots, assetManifest, audioManifest })
  const manifest = {
    videoPath,
    durationSec,
    compositionHash,
    assetManifest,
    audioManifest,
    timeline: { segments: segmentsWithStart, shots: shotsWithTime, totalDuration },
    finishedAt: new Date().toISOString(),
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  log(`Production manifest written to ${MANIFEST_PATH}`)
}

main().catch((e) => {
  console.error('[produce] FATAL:', e instanceof Error ? e.message : String(e))
  console.error(e instanceof Error ? e.stack : '')
  process.exit(1)
})
