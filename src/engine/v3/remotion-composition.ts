/**
 * Remotion Composition (V2 — actual @remotion/renderer)
 *
 * Renders the DocumentaryComposition via Remotion's server-side renderer.
 * Produces a real MP4 with different visual composition types per beat:
 *   - Chart (animated data visualization)
 *   - Timeline (events move through time)
 *   - Document (typewriter + highlight)
 *   - Photo (Ken Burns on still images)
 *   - Video (actual moving footage)
 *   - Typography (staggered word reveal for hooks/endings)
 *
 * FFmpeg is kept ONLY for: audio mixing + final mux + normalization.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, mkdir, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import type { EditDecision, StoryBeat, AssetManifest, ArchetypeConfig } from './types'

const exec = promisify(execFile)

export interface RemotionRenderResult {
  videoPath: string
  frameCount: number
  fps: number
  width: number
  height: number
}

/**
 * Render the documentary via Remotion's @remotion/renderer.
 *
 * Pipeline:
 *   1. Bundle the Remotion entry point (src/video/index.ts)
 *   2. Select the composition with inputProps (EDL + beats + assets)
 *   3. Render to MP4 with H.264 + AAC
 *
 * If Remotion fails for any reason, throws (NO fallback to FFmpeg slideshow).
 */
export async function renderComposition(opts: {
  videoProjectId: string
  edl: EditDecision[]
  beats: StoryBeat[]
  assets: AssetManifest[]
  archetype: ArchetypeConfig
  isShort: boolean
  channelName: string
}): Promise<RemotionRenderResult> {
  const { videoProjectId, edl, beats, assets, isShort, channelName } = opts

  const width = isShort ? 1080 : 1920
  const height = isShort ? 1920 : 1080
  const fps = 30

  // Calculate total duration in frames
  const totalDurationSec = edl.length > 0 ? edl[edl.length - 1].end : 5
  const durationInFrames = Math.max(30, Math.round(totalDurationSec * fps))

  console.log(`[remotion] Bundling composition for ${edl.length} beats, ${totalDurationSec.toFixed(1)}s (${durationInFrames} frames)`)

  // Write the input props to a temp file (Remotion reads them via staticFile or inputProps)
  const propsPath = path.join(process.cwd(), 'data', 'remotion-props', `${videoProjectId}.json`)
  if (!existsSync(path.dirname(propsPath))) await mkdir(path.dirname(propsPath), { recursive: true })

  // Convert asset paths to be accessible by Remotion (Chrome blocks file:// URLs)
  // We use Remotion's staticFile mechanism by copying assets to public/ folder
  // OR serve via a temporary HTTP server
  const publicAssetsDir = path.join(process.cwd(), 'public', 'remotion-assets', videoProjectId)
  if (!existsSync(publicAssetsDir)) await mkdir(publicAssetsDir, { recursive: true })

  const assetUrlMap: Record<string, string> = {}
  for (const asset of assets) {
    if (!asset.localPath || !existsSync(asset.localPath)) continue
    const ext = path.extname(asset.localPath)
    const destName = `${asset.id}${ext}`
    const destPath = path.join(publicAssetsDir, destName)
    if (!existsSync(destPath)) {
      await writeFile(destPath, await readFile(asset.localPath))
    }
    // Remotion staticFile URL: /remotion-assets/{projectId}/{assetId}.{ext}
    assetUrlMap[asset.id] = `/remotion-assets/${videoProjectId}/${destName}`
  }

  const props = {
    edl,
    beats: beats.map(b => ({
      ...b,
      narration: String(b.narration || ''),
    })),
    assets: assets.map(a => ({
      ...a,
      // Use staticFile-compatible URL instead of file://
      localPath: assetUrlMap[a.id] || undefined,
    })),
    channelName,
    totalScenes: edl.length,
  }
  await writeFile(propsPath, JSON.stringify(props))

  // Use @remotion/renderer to bundle + render
  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')

  // Bundle the Remotion entry point
  const entryPoint = path.join(process.cwd(), 'src', 'video', 'index.ts')
  if (!existsSync(entryPoint)) {
    throw new Error(`Remotion entry point not found: ${entryPoint}`)
  }

  console.log('[remotion] Bundling entry point...')
  const serveUrl = await bundle({
    entryPoint,
    // Use the installed webpack
    webpackOverride: (config) => config,
  })

  console.log('[remotion] Selecting composition...')
  const inputProps = {
    edl: props.edl,
    beats: props.beats,
    assets: props.assets,
    channelName: props.channelName,
    totalScenes: props.totalScenes,
  }

  const composition = await selectComposition({
    serveUrl,
    id: 'documentary',
    inputProps,
  })

  // Override duration + dimensions based on the actual EDL
  composition.durationInFrames = durationInFrames
  composition.fps = fps
  composition.width = width
  composition.height = height

  const outputPath = path.join(process.cwd(), 'data', 'videos', `${videoProjectId}_remotion.mp4`)
  if (!existsSync(path.dirname(outputPath))) await mkdir(path.dirname(outputPath), { recursive: true })

  console.log(`[remotion] Rendering ${durationInFrames} frames at ${width}x${height} ${fps}fps...`)
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      if (Math.floor(progress * 100) % 10 === 0) {
        console.log(`[remotion] Render progress: ${Math.floor(progress * 100)}%`)
      }
    },
    // Use the locally-downloaded Chrome Headless Shell
    puppeteerInstance: undefined,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
  })

  console.log(`[remotion] Render complete: ${outputPath}`)

  // Verify the output
  const stats = await stat(outputPath)
  if (stats.size < 1000) {
    throw new Error(`Remotion render produced an empty file (${stats.size} bytes)`)
  }

  return {
    videoPath: outputPath,
    frameCount: durationInFrames,
    fps,
    width,
    height,
  }
}

/**
 * Encode the Remotion output + narration audio into the final MP4.
 * (Remotion produces video-only; we mux the audio separately.)
 */
export async function encodeFramesToVideo(opts: {
  videoPath: string  // already rendered by Remotion
  audioPath: string
  outputPath: string
}): Promise<void> {
  const { videoPath, audioPath, outputPath } = opts

  // Mux video + audio
  await exec('ffmpeg', [
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-map', '0:v:0', '-map', '1:a:0',
    '-shortest',
    '-movflags', '+faststart',
    outputPath, '-y',
  ])
}
