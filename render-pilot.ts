/**
 * D-PILOT — render the 50s GLOW HOUR animated pilot.
 *
 * Renders the 'animated-pilot' Remotion composition (1500 frames @ 30fps,
 * 1920x1080, no audio — visual proof only) in TWO chunks because 50s exceeds
 * the ~43s single-render crash ceiling observed on this box:
 *
 *   chunk 1: frames 0–749   (0s–25s)
 *   chunk 2: frames 750–1499 (25s–50s)
 *
 * Chunks are concatenated with ffmpeg (-c copy) into
 * data/videos/test-d-pilot-animated.mp4, then probed. All motion is a pure
 * function of the absolute frame number, so the chunk boundary at f750 is
 * perfectly continuous.
 *
 * Run: bun run render-pilot.ts
 */
import { mkdir, stat, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const exec = promisify(execFile)

const OUT_DIR = path.join(process.cwd(), 'data', 'videos')
const CHUNK_DIR = path.join(OUT_DIR, 'pilot-chunks')
const OUT_PATH = path.join(OUT_DIR, 'test-d-pilot-animated.mp4')

const CHUNKS: Array<{ name: string; range: [number, number] }> = [
  { name: 'pilot-chunk-1', range: [0, 749] }, // 0s–25s
  { name: 'pilot-chunk-2', range: [750, 1499] }, // 25s–50s
]

async function probe(filePath: string): Promise<{
  format?: { duration?: string; size?: string }
  streams?: unknown
}> {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate',
    '-of', 'json', filePath,
  ])
  return JSON.parse(stdout)
}

async function main() {
  console.log('=== D-PILOT RENDER (GLOW HOUR 50s animated pilot) ===')
  console.log('Composition: animated-pilot | 1500 frames @ 30fps | 1920x1080 | 2 chunks × 25s')

  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')

  console.log('[render] Bundling Remotion project...')
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), 'src', 'video', 'index.ts'),
    webpackOverride: (config: any) => config,
  })

  console.log('[render] Selecting composition...')
  const composition = await selectComposition({
    serveUrl,
    id: 'animated-pilot',
    inputProps: {},
  })

  if (composition.durationInFrames !== 1500) {
    throw new Error(`Expected 1500 frames, got ${composition.durationInFrames}`)
  }
  if (composition.fps !== 30 || composition.width !== 1920 || composition.height !== 1080) {
    throw new Error(
      `Unexpected config: ${composition.width}x${composition.height} @ ${composition.fps}fps`
    )
  }

  if (!existsSync(CHUNK_DIR)) {
    await mkdir(CHUNK_DIR, { recursive: true })
  }

  /* --------------------------- render chunks ---------------------------- */

  for (const chunk of CHUNKS) {
    const chunkPath = path.join(CHUNK_DIR, `${chunk.name}.mp4`)

    // resume support: skip chunks already rendered
    if (existsSync(chunkPath)) {
      const existingSize = (await stat(chunkPath)).size
      if (existingSize > 500_000) {
        console.log(`[${chunk.name}] Already rendered (${(existingSize / 1024 / 1024).toFixed(2)} MB) — skipping`)
        continue
      }
    }

    const frames = chunk.range[1] - chunk.range[0] + 1
    console.log(`[${chunk.name}] Rendering frames ${chunk.range[0]}–${chunk.range[1]} (${frames} frames)...`)
    const started = Date.now()
    let lastProgress = 0
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: chunkPath,
      frameRange: chunk.range,
      inputProps: {},
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 100)
        if (pct >= lastProgress + 10) {
          console.log(
            `[${chunk.name}] ${pct}% (${Math.round((Date.now() - started) / 1000)}s elapsed)`
          )
          lastProgress = pct
        }
      },
      chromiumOptions: { enableMultiProcessOnLinux: true },
    })

    const size = (await stat(chunkPath)).size
    console.log(
      `[${chunk.name}] ✓ done: ${(size / 1024 / 1024).toFixed(2)} MB in ${Math.round((Date.now() - started) / 1000)}s`
    )
  }

  /* ----------------------------- concat --------------------------------- */

  console.log('\n[concat] Joining 2 chunks → test-d-pilot-animated.mp4')
  const listPath = path.join(CHUNK_DIR, 'concat-list.txt')
  await writeFile(
    listPath,
    CHUNKS.map((c) => `file '${path.join(CHUNK_DIR, `${c.name}.mp4`)}'`).join('\n') + '\n'
  )

  try {
    await exec('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      '-y',
      OUT_PATH,
    ])
  } catch (e) {
    // fallback: stream-copy can occasionally produce timing metadata issues — re-encode
    console.log(`[concat] -c copy failed (${(e as Error).message.slice(0, 120)}), re-encoding...`)
    await exec('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-y',
      OUT_PATH,
    ])
  }

  /* ------------------------------ verify -------------------------------- */

  const info = await probe(OUT_PATH)
  const dur = parseFloat(info.format?.duration || '0')
  const size = (await stat(OUT_PATH)).size
  console.log('\n=== RENDER COMPLETE ===')
  console.log(`Path: ${OUT_PATH}`)
  console.log(`Duration: ${dur.toFixed(2)}s (expected 50.00s)`)
  console.log(`Size: ${(size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Streams: ${JSON.stringify(info.streams)}`)

  if (dur < 49.5 || dur > 51) {
    throw new Error(`Unexpected final duration: ${dur}s (expected ~50s)`)
  }
  console.log('\n✓ 50s pilot rendered successfully.')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
