/**
 * D-ANIM-PROOF — render the 12s GLOW HOUR animation proof.
 *
 * Renders the 'animation-proof' Remotion composition (360 frames @ 30fps,
 * 1920x1080) in ONE chunk (12s is far below the ~43s crash ceiling) to
 * data/videos/test-d-animation-proof.mp4, then probes the result.
 *
 * Run: bun run render-animation-proof.ts
 */
import { mkdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const exec = promisify(execFile)

const OUT_PATH = path.join(process.cwd(), 'data', 'videos', 'test-d-animation-proof.mp4')

async function probe(filePath: string): Promise<string> {
  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate',
      '-of', 'json', filePath,
    ])
    return stdout
  } catch (e) {
    return `probe failed: ${(e as Error).message}`
  }
}

async function main() {
  console.log('=== D-ANIM-PROOF RENDER (GLOW HOUR animation proof) ===')
  console.log('Composition: animation-proof | 360 frames @ 30fps | 1920x1080 | single chunk')

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
    id: 'animation-proof',
    inputProps: { backgroundPath: 'test-d/scene-01.png' },
  })

  if (composition.durationInFrames !== 360) {
    throw new Error(`Expected 360 frames, got ${composition.durationInFrames}`)
  }

  if (!existsSync(path.dirname(OUT_PATH))) {
    await mkdir(path.dirname(OUT_PATH), { recursive: true })
  }

  console.log('[render] Rendering 360 frames (single chunk)...')
  const started = Date.now()
  let lastProgress = 0
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: OUT_PATH,
    inputProps: { backgroundPath: 'test-d/scene-01.png' },
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100)
      if (pct >= lastProgress + 10) {
        console.log(`[render] ${pct}% (${Math.round((Date.now() - started) / 1000)}s elapsed)`)
        lastProgress = pct
      }
    },
    chromiumOptions: { enableMultiProcessOnLinux: true },
  })

  const size = (await stat(OUT_PATH)).size
  const info = JSON.parse(await probe(OUT_PATH))
  const dur = parseFloat(info.format?.duration || '0')
  console.log('\n=== RENDER COMPLETE ===')
  console.log(`Path: ${OUT_PATH}`)
  console.log(`Duration: ${dur.toFixed(2)}s (expected 12.00s)`)
  console.log(`Size: ${(size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`Streams: ${JSON.stringify(info.streams)}`)
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
