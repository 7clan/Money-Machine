/**
 * Chunked Remotion Render — renders the full documentary in 4-beat chunks
 * with checkpointing per chunk (spec section 7).
 *
 * If the process stops after chunk 3, it resumes with chunk 4 — never
 * re-rendering chunks 1-3.
 */

import { readFile, writeFile, mkdir, stat, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const exec = promisify(execFile)

const DATA_DIR = path.join(process.cwd(), 'data')
const CHUNKS_DIR = path.join(DATA_DIR, 'videos', 'chunks')
const CHECKPOINT_PATH = path.join(DATA_DIR, 'pipeline-state', 'render-chunks.json')

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
    return parseFloat(stdout.trim()) || 0
  } catch { return 0 }
}

interface ChunkState {
  projectId: string
  totalChunks: number
  chunks: Array<{
    index: number
    beats: number[]  // beat indices
    status: 'PENDING' | 'RENDERING' | 'COMPLETE' | 'FAILED'
    videoPath?: string
    durationSec?: number
    error?: string
  }>
}

async function loadChunkState(): Promise<ChunkState | null> {
  if (!existsSync(CHECKPOINT_PATH)) return null
  try { return JSON.parse(await readFile(CHECKPOINT_PATH, 'utf-8')) } catch { return null }
}

async function saveChunkState(state: ChunkState): Promise<void> {
  if (!existsSync(path.dirname(CHECKPOINT_PATH))) await mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true })
  await writeFile(CHECKPOINT_PATH, JSON.stringify(state, null, 2))
}

async function renderChunk(
  projectId: string,
  chunkIndex: number,
  beatIndices: number[],
  edl: any[],
  beats: any[],
  assets: any[],
): Promise<{ videoPath: string; durationSec: number }> {
  if (!existsSync(CHUNKS_DIR)) await mkdir(CHUNKS_DIR, { recursive: true })

  // Slice the EDL + beats for this chunk, re-timing to start at 0
  const chunkEdl: any[] = []
  const chunkBeats: any[] = []
  const chunkAssets: any[] = []
  let cursor = 0

  for (const beatIdx of beatIndices) {
    const origEdl = edl[beatIdx]
    const origBeat = beats[beatIdx]
    const origAsset = assets.find((a: any) => a.storyBeatId === origBeat.id)
    const dur = origEdl.end - origEdl.start

    chunkEdl.push({
      ...origEdl,
      start: cursor,
      end: cursor + dur,
      id: `chunk_${chunkIndex}_edl_${beatIdx}`,
    })
    chunkBeats.push(origBeat)
    if (origAsset) chunkAssets.push(origAsset)
    cursor += dur
  }

  const chunkDurationSec = cursor
  const chunkVideoPath = path.join(CHUNKS_DIR, `${projectId}_chunk_${chunkIndex}.mp4`)

  console.log(`[chunk ${chunkIndex}] Rendering ${chunkBeats.length} beats, ${chunkDurationSec.toFixed(1)}s`)

  // Use Remotion to render this chunk
  const { renderComposition, encodeFramesToVideo } = await import('./src/engine/v3/remotion-composition')

  // For chunks, we need to concatenate the per-beat audio first
  const chunkAudioPath = path.join(CHUNKS_DIR, `${projectId}_chunk_${chunkIndex}_audio.mp3`)
  if (!existsSync(chunkAudioPath)) {
    const cp = JSON.parse(await readFile(path.join(DATA_DIR, 'pipeline-state', `${projectId}.json`), 'utf-8'))
    const beatAudios = beatIndices.map(i => cp.perBeatAudio[i].audioPath).filter((p: string) => existsSync(p))
    const listPath = chunkAudioPath + '.txt'
    await writeFile(listPath, beatAudios.map((p: string) => `file '${p}'`).join('\n'))
    await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', chunkAudioPath, '-y'])
    try { await unlink(listPath) } catch {}
  }

  // Normalize the chunk audio
  const chunkFinalAudioPath = path.join(CHUNKS_DIR, `${projectId}_chunk_${chunkIndex}_final.aac`)
  if (!existsSync(chunkFinalAudioPath)) {
    await exec('ffmpeg', [
      '-i', chunkAudioPath,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
      chunkFinalAudioPath, '-y',
    ])
  }

  // Render via Remotion
  const renderResult = await renderComposition({
    videoProjectId: `${projectId}_chunk_${chunkIndex}`,
    edl: chunkEdl,
    beats: chunkBeats,
    assets: chunkAssets,
    archetype: { archetype: 'DOCUMENTARY', transitionPhilosophy: 'crossfade' } as any,
    isShort: false,
    channelName: '', // no watermark
  })

  // Mux video + audio
  await encodeFramesToVideo({
    videoPath: renderResult.videoPath,
    audioPath: chunkFinalAudioPath,
    outputPath: chunkVideoPath,
  })

  // Verify
  const dur = await probeDuration(chunkVideoPath)
  const size = (await stat(chunkVideoPath)).size
  if (dur < 1 || size < 10000) {
    throw new Error(`Chunk ${chunkIndex} render invalid: ${dur}s, ${size}b`)
  }

  console.log(`[chunk ${chunkIndex}] ✓ Complete: ${dur.toFixed(1)}s, ${(size / 1024 / 1024).toFixed(1)}MB`)
  return { videoPath: chunkVideoPath, durationSec: dur }
}

async function assembleChunks(projectId: string, chunkPaths: string[], outputPath: string): Promise<void> {
  console.log(`\n[assemble] Concatenating ${chunkPaths.length} chunks...`)
  const listPath = outputPath + '.txt'
  await writeFile(listPath, chunkPaths.map(p => `file '${p}'`).join('\n'))
  await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath, '-y'])
  try { await unlink(listPath) } catch {}
}

async function main() {
  const projectId = 'cmt4yh4nf000bmajq976v6csn'
  const cpPath = path.join(DATA_DIR, 'pipeline-state', `${projectId}.json`)
  const cp = JSON.parse(await readFile(cpPath, 'utf-8'))

  // Load real assets manifest + merge with existing assets
  const realManifestPath = path.join(DATA_DIR, 'pipeline-state', 'real-assets-manifest.json')
  let realAssets: any[] = []
  if (existsSync(realManifestPath)) {
    const manifest = JSON.parse(await readFile(realManifestPath, 'utf-8'))
    realAssets = manifest.assets || []
  }

  // Build the final asset list: prefer real assets, fall back to existing Z.ai assets
  const beats = cp.beats
  const finalAssets: any[] = []
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i]
    const beatId = beat.id
    // Check for real asset
    const realAsset = realAssets.find(a => a.beatId === beatId)
    const existingAsset = cp.assets.find((a: any) => a.storyBeatId === beatId)

    if (realAsset && realAsset.localPath && existsSync(realAsset.localPath)) {
      finalAssets.push({
        id: `real_${beatId}`,
        type: 'PUBLIC_DOMAIN_IMAGE', // or CC — provenance tracked in manifest
        storyBeatId: beatId,
        localPath: realAsset.localPath,
        sourceUrl: realAsset.sourceUrl || 'Wikimedia Commons',
        creator: realAsset.artist || 'Unknown',
        license: realAsset.license || 'See source',
        commercialUse: true,
        attributionRequired: realAsset.license !== 'Public domain',
        retrievalDate: realAsset.acquisitionDate || new Date().toISOString(),
        metadata: {},
      })
    } else if (existingAsset && existingAsset.localPath && existsSync(existingAsset.localPath)) {
      finalAssets.push(existingAsset)
    } else {
      // No asset — will use Remotion component (chart/timeline/document/typography)
      finalAssets.push({
        id: `placeholder_${beatId}`,
        type: 'ORIGINAL_GRAPHIC',
        storyBeatId: beatId,
        localPath: '',
        creator: 'Remotion component',
        license: 'Original',
        commercialUse: true,
        attributionRequired: false,
        retrievalDate: new Date().toISOString(),
        metadata: {},
      })
    }
  }

  // Build chunks: 4 beats per chunk
  const CHUNK_SIZE = 4
  const totalChunks = Math.ceil(beats.length / CHUNK_SIZE)

  // Load or init chunk state
  let chunkState = await loadChunkState()
  if (!chunkState || chunkState.projectId !== projectId || chunkState.totalChunks !== totalChunks) {
    chunkState = {
      projectId,
      totalChunks,
      chunks: Array.from({ length: totalChunks }, (_, i) => ({
        index: i,
        beats: Array.from({ length: Math.min(CHUNK_SIZE, beats.length - i * CHUNK_SIZE) }, (_, j) => i * CHUNK_SIZE + j),
        status: 'PENDING' as const,
      })),
    }
    await saveChunkState(chunkState)
  }

  console.log(`=== CHUNKED RENDER ===`)
  console.log(`Project: ${projectId}`)
  console.log(`Beats: ${beats.length}`)
  console.log(`Chunks: ${totalChunks} (${CHUNK_SIZE} beats each)`)
  console.log(`Real assets: ${finalAssets.filter(a => a.sourceUrl?.includes('wikimedia')).length}`)
  console.log(`Existing assets: ${finalAssets.filter(a => a.creator !== 'Remotion component' && !a.sourceUrl?.includes('wikimedia')).length}`)
  console.log(`Remotion components: ${finalAssets.filter(a => a.creator === 'Remotion component').length}`)
  console.log()

  // Render each pending chunk
  for (const chunk of chunkState.chunks) {
    if (chunk.status === 'COMPLETE') {
      console.log(`[chunk ${chunk.index}] ✓ Already complete — skipping`)
      continue
    }

    chunk.status = 'RENDERING'
    await saveChunkState(chunkState)

    try {
      const result = await renderChunk(projectId, chunk.index, chunk.beats, cp.edl, beats, finalAssets)
      chunk.status = 'COMPLETE'
      chunk.videoPath = result.videoPath
      chunk.durationSec = result.durationSec
      await saveChunkState(chunkState)
    } catch (e: any) {
      console.error(`[chunk ${chunk.index}] FAILED: ${e.message}`)
      chunk.status = 'FAILED'
      chunk.error = e.message.slice(0, 200)
      await saveChunkState(chunkState)
      // Continue to next chunk — don't abort the whole render
    }
  }

  // Check if all chunks are complete
  const completeChunks = chunkState.chunks.filter(c => c.status === 'COMPLETE')
  if (completeChunks.length < totalChunks) {
    console.error(`\n=== RENDER INCOMPLETE ===`)
    console.error(`Complete: ${completeChunks.length}/${totalChunks}`)
    for (const c of chunkState.chunks) {
      console.error(`  Chunk ${c.index}: ${c.status}${c.error ? ' — ' + c.error : ''}`)
    }
    process.exit(1)
  }

  // Assemble all chunks into the final video
  const finalVideoPath = path.join(DATA_DIR, 'videos', 'nokia-documentary-final.mp4')
  const chunkPaths = chunkState.chunks.map(c => c.videoPath!).filter(Boolean)
  await assembleChunks(projectId, chunkPaths, finalVideoPath)

  const finalDur = await probeDuration(finalVideoPath)
  const finalSize = (await stat(finalVideoPath)).size
  console.log(`\n=== FINAL DOCUMENTARY ===`)
  console.log(`Path: ${finalVideoPath}`)
  console.log(`Duration: ${finalDur.toFixed(1)}s`)
  console.log(`Size: ${(finalSize / 1024 / 1024).toFixed(1)}MB`)

  // Run QC
  console.log(`\n=== QUALITY GATE ===`)
  const { runQualityGate } = await import('./src/engine/v3/quality-gate')
  const qg = await runQualityGate({
    videoPath: finalVideoPath,
    thumbnailPath: path.join(DATA_DIR, 'thumbnails', `${projectId}.png`),
    durationSec: finalDur,
  })
  console.log(`QC: ${qg.passed ? 'PASS' : 'FAIL'}`)
  console.log(`LUFS: ${qg.audioLUFS}`)
  console.log(`Black frames: ${qg.blackFrameCount}`)
  console.log(`Freeze: ${qg.freezeCount}`)
  console.log(`Silence: ${qg.silenceCount}`)
  console.log(`Visual variety: ${qg.visualVarietyScore}%`)
  console.log(`Contact sheet: ${qg.contactSheetPath}`)
  console.log('Checks:')
  for (const c of qg.checks) console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}: ${c.details.slice(0, 80)}`)

  // Compute SlopScore
  console.log(`\n=== SLOP SCORE ===`)
  const { computeSlopScore } = await import('./src/engine/v3/quality-critic')
  const slop = computeSlopScore(cp.edl, beats, finalAssets, { archetype: 'DOCUMENTARY' } as any)
  console.log(`SlopScore: ${slop.total} (threshold ${slop.threshold}, passed: ${slop.passed})`)
  if (slop.penalties.length > 0) {
    console.log('Penalties:')
    for (const p of slop.penalties) console.log(`  ${p.rule}: +${p.points} (${p.occurrences}x) — ${p.examples?.[0] || ''}`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e.message); process.exit(1) })
