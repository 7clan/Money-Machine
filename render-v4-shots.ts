/**
 * Render Final Master V4 — Shot-based architecture
 *
 * Key change: renders VisualShots (46 shots) instead of one visual per beat (18).
 * This produces much higher information density and visual variety.
 *
 * Uses the same chunked + checkpointed architecture.
 */

import { readFile, writeFile, mkdir, stat, unlink, copyFile } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const exec = promisify(execFile)
const DATA_DIR = path.join(process.cwd(), 'data')
const CHUNKS_DIR = path.join(DATA_DIR, 'videos', 'chunks-1080p')
const CHECKPOINT_PATH = path.join(DATA_DIR, 'pipeline-state', 'render-chunks-1080p.json')
const PROJECT_ID = 'cmt4yh4nf000bmajq976v6csn'
const FPS = 30
const WIDTH = 1920
const HEIGHT = 1080

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
    return parseFloat(stdout.trim()) || 0
  } catch { return 0 }
}

async function verifyVideo(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height', '-of', 'json', filePath])
    const data = JSON.parse(stdout)
    const video = data.streams?.find((s: any) => s.codec_type === 'video')
    return video?.codec_name === 'h264' && video?.width > 0
  } catch { return false }
}

async function loadCheckpoint(): Promise<any> {
  if (!existsSync(CHECKPOINT_PATH)) return null
  try { return JSON.parse(await readFile(CHECKPOINT_PATH, 'utf-8')) } catch { return null }
}

async function saveCheckpoint(state: any): Promise<void> {
  if (!existsSync(path.dirname(CHECKPOINT_PATH))) await mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true })
  await writeFile(CHECKPOINT_PATH, JSON.stringify(state, null, 2))
}

async function renderChunk(
  chunkIndex: number,
  beatIndices: number[],
  cp: any,
  shots: any[],
  realAssets: any[],
): Promise<{ videoPath: string; durationSec: number; frameCount: number; renderMs: number }> {
  if (!existsSync(CHUNKS_DIR)) await mkdir(CHUNKS_DIR, { recursive: true })

  // Get the shots for this chunk's beats
  const chunkBeatIds = beatIndices.map(i => cp.beats[i].id)
  const chunkShotsRaw = shots.filter((s: any) => chunkBeatIds.includes(s.beatId))
  // Offset shot times to be LOCAL to this chunk (start at 0)
  const chunkStartTime = chunkShotsRaw.length > 0 ? chunkShotsRaw[0].start : 0
  const chunkShots = chunkShotsRaw.map((s: any) => ({
    ...s,
    start: s.start - chunkStartTime,
    end: s.end - chunkStartTime,
  }))
  const chunkBeats = beatIndices.map(i => cp.beats[i])
  const chunkAudio = beatIndices.map(i => cp.perBeatAudio[i])

  // Calculate total duration
  const totalDur = chunkAudio.reduce((s: number, a: any) => s + a.duration, 0)
  const durationInFrames = Math.max(30, Math.round(totalDur * FPS))

  // Copy real assets to public for Remotion staticFile
  const publicDir = path.join(process.cwd(), 'public', 'remotion-assets', `${PROJECT_ID}_1080p_chunk${chunkIndex}`)
  if (!existsSync(publicDir)) await mkdir(publicDir, { recursive: true })

  // Map beat IDs to real asset paths
  const realAssetMap = new Map<string, string>()
  for (const beatId of chunkBeatIds) {
    const realAsset = realAssets.find((a: any) => a.beatId === beatId && a.localPath && existsSync(a.localPath))
    if (realAsset) {
      const ext = path.extname(realAsset.localPath)
      const destName = `${beatId}${ext}`
      const destPath = path.join(publicDir, destName)
      if (!existsSync(destPath)) {
        await writeFile(destPath, await readFile(realAsset.localPath))
      }
      realAssetMap.set(beatId, `/remotion-assets/${PROJECT_ID}_1080p_chunk${chunkIndex}/${destName}`)
    }
  }

  // Update shot asset IDs with Remotion-accessible URLs
  const shotsWithAssets = chunkShots.map((s: any) => ({
    ...s,
    assetId: s.type === 'REAL_PHOTO' ? realAssetMap.get(s.beatId) : undefined,
  }))

  // Concatenate audio
  const chunkAudioPath = path.join(CHUNKS_DIR, `${PROJECT_ID}_1080p_chunk${chunkIndex}_audio.mp3`)
  if (!existsSync(chunkAudioPath)) {
    const listPath = chunkAudioPath + '.txt'
    await writeFile(listPath, chunkAudio.map((a: any) => `file '${a.audioPath}'`).join('\n'))
    await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', chunkAudioPath, '-y'])
    try { await unlink(listPath) } catch {}
  }

  // Normalize audio
  const chunkFinalAudioPath = path.join(CHUNKS_DIR, `${PROJECT_ID}_1080p_chunk${chunkIndex}_final.aac`)
  if (!existsSync(chunkFinalAudioPath)) {
    await exec('ffmpeg', ['-i', chunkAudioPath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', chunkFinalAudioPath, '-y'])
  }

  const inputProps = {
    shots: shotsWithAssets,
    beats: chunkBeats.map((b: any) => ({ ...b, narration: String(b.narration || '') })),
    channelName: '',
    totalScenes: shotsWithAssets.length,
  }

  // Bundle Remotion
  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')

  console.log(`  [chunk ${chunkIndex}] Bundling...`)
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), 'src', 'video', 'index.ts'),
    webpackOverride: (config: any) => config,
  })

  const composition = await selectComposition({ serveUrl, id: 'documentary', inputProps })
  composition.durationInFrames = durationInFrames
  composition.fps = FPS
  composition.width = WIDTH
  composition.height = HEIGHT

  const outputPath = path.join(CHUNKS_DIR, `${PROJECT_ID}_1080p_chunk${chunkIndex}.mp4`)
  console.log(`  [chunk ${chunkIndex}] Rendering ${durationInFrames} frames, ${chunkShots.length} shots...`)

  const renderStart = Date.now()
  let lastProgressReport = 0
  await renderMedia({
    composition, serveUrl, codec: 'h264', outputLocation: outputPath, inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100)
      if (pct >= lastProgressReport + 20) {
        console.log(`  [chunk ${chunkIndex}] ${pct}%`)
        lastProgressReport = pct
      }
    },
    chromiumOptions: { enableMultiProcessOnLinux: true },
  })
  const renderMs = Date.now() - renderStart

  // Mux video + audio
  const muxedPath = outputPath.replace('.mp4', '_muxed.mp4')
  await exec('ffmpeg', [
    '-i', outputPath, '-i', chunkFinalAudioPath,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-movflags', '+faststart',
    muxedPath, '-y',
  ])
  await copyFile(muxedPath, outputPath)
  try { await unlink(muxedPath) } catch {}

  const verified = await verifyVideo(outputPath)
  if (!verified) throw new Error(`Chunk ${chunkIndex} verification failed`)

  const dur = await probeDuration(outputPath)
  const size = (await stat(outputPath)).size
  console.log(`  [chunk ${chunkIndex}] ✓ Complete: ${dur.toFixed(1)}s, ${(size/1024/1024).toFixed(1)}MB, ${(durationInFrames/(renderMs/1000)).toFixed(1)} fps`)

  return { videoPath: outputPath, durationSec: dur, frameCount: durationInFrames, renderMs }
}

async function main() {
  const cp = JSON.parse(await readFile(path.join(DATA_DIR, 'pipeline-state', `${PROJECT_ID}.json`), 'utf-8'))
  const manifest = JSON.parse(await readFile(path.join(DATA_DIR, 'pipeline-state', 'real-assets-manifest.json'), 'utf-8'))
  const replan = JSON.parse(await readFile(path.join(DATA_DIR, 'pipeline-state', 'visual-replan.json'), 'utf-8'))

  // Build the shot timeline
  const { buildShotTimeline, resolveShotAssets } = await import('./src/engine/v3/visual-shots')
  const perBeatDurations = cp.perBeatAudio.map((a: any) => a.duration)
  const shots = buildShotTimeline(replan, cp.beats, perBeatDurations)
  const resolvedShots = resolveShotAssets(shots, manifest.assets)

  console.log(`=== V4 SHOT-BASED RENDER ===`)
  console.log(`Beats: ${cp.beats.length}`)
  console.log(`Shots: ${resolvedShots.length}`)
  console.log(`Resolution: ${WIDTH}x${HEIGHT} @ ${FPS}fps`)
  console.log()

  // Build chunks (3 beats per chunk)
  const CHUNK_SIZE = 3
  const totalChunks = Math.ceil(cp.beats.length / CHUNK_SIZE)

  let chunkState = await loadCheckpoint()
  if (!chunkState) {
    chunkState = { contentId: PROJECT_ID, totalChunks, chunks: [] }
    for (let i = 0; i < totalChunks; i++) {
      chunkState.chunks.push({
        contentId: PROJECT_ID, chunkIndex: i,
        beatIds: Array.from({ length: Math.min(CHUNK_SIZE, cp.beats.length - i * CHUNK_SIZE) }, (_, j) => cp.beats[i * CHUNK_SIZE + j].id),
        status: 'PENDING', verified: false,
      })
    }
    await saveCheckpoint(chunkState)
  }

  // Render each chunk
  for (const chunk of chunkState.chunks) {
    if (chunk.status === 'COMPLETE' && chunk.outputPath && existsSync(chunk.outputPath)) {
      const verified = await verifyVideo(chunk.outputPath)
      if (verified) {
        console.log(`[chunk ${chunk.chunkIndex}] ✓ Already complete — skipping`)
        continue
      }
    }

    chunk.status = 'RENDERING'
    await saveCheckpoint(chunkState)

    const beatIndices = chunk.beatIds.map((id: string) => cp.beats.findIndex((b: any) => b.id === id))
    try {
      const result = await renderChunk(chunk.chunkIndex, beatIndices, cp, resolvedShots, manifest.assets)
      chunk.status = 'COMPLETE'
      chunk.outputPath = result.videoPath
      chunk.frameCount = result.frameCount
      chunk.renderMs = result.renderMs
      chunk.verified = true
      await saveCheckpoint(chunkState)
    } catch (e: any) {
      console.error(`[chunk ${chunk.chunkIndex}] FAILED: ${e.message.slice(0, 200)}`)
      chunk.status = 'FAILED'
      chunk.lastError = e.message.slice(0, 200)
      await saveCheckpoint(chunkState)
    }
  }

  // Check all complete
  const completeChunks = chunkState.chunks.filter((c: any) => c.status === 'COMPLETE' && c.verified)
  if (completeChunks.length < totalChunks) {
    console.error(`\n=== RENDER INCOMPLETE: ${completeChunks.length}/${totalChunks} ===`)
    for (const c of chunkState.chunks) {
      console.error(`  Chunk ${c.chunkIndex}: ${c.status}${c.lastError ? ' — ' + c.lastError : ''}`)
    }
    process.exit(1)
  }

  // Assemble
  console.log(`\n=== ASSEMBLING V4 MASTER ===`)
  const finalPath = path.join(DATA_DIR, 'videos', 'nokia-documentary-nokia-documentary-final-1080p.mp4')
  const chunkPaths = chunkState.chunks.map((c: any) => c.outputPath).filter(Boolean)
  const listPath = finalPath + '.concat.txt'
  await writeFile(listPath, chunkPaths.map((p: string) => `file '${p}'`).join('\n'))
  await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', finalPath, '-y'])
  try { await unlink(listPath) } catch {}

  const finalDur = await probeDuration(finalPath)
  const finalSize = (await stat(finalPath)).size
  console.log(`Master: ${finalDur.toFixed(1)}s, ${(finalSize/1024/1024).toFixed(1)}MB`)
  console.log(`Path: ${finalPath}`)

  // Quick QC
  console.log(`\n=== QC ===`)
  const { stdout: loudOut } = await exec('ffmpeg', ['-hide_banner', '-i', finalPath, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'])
  const lufs = loudOut.match(/Input Integrated:\s*(-?\d+\.?\d*)/)?.[1] || '?'
  console.log(`LUFS: ${lufs}`)
  console.log(`Duration: ${finalDur.toFixed(1)}s`)
  console.log(`Size: ${(finalSize/1024/1024).toFixed(1)}MB`)
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e.message); process.exit(1) })
