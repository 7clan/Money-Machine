import { readFile, writeFile, mkdir, stat, copyFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const exec = promisify(execFile)
const DATA_DIR = path.join(process.cwd(), 'data')
const CHUNKS_DIR = path.join(DATA_DIR, 'videos', 'chunks-test-b')
const CHECKPOINT_PATH = path.join(DATA_DIR, 'pipeline-state', 'render-chunks-test-b.json')
const FPS = 30
const WIDTH = 1280
const HEIGHT = 720

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

async function main() {
  const shots = JSON.parse(await readFile('data/pipeline-state/test-b-shots.json', 'utf-8'))
  const script = JSON.parse(await readFile('data/pipeline-state/test-b-script.json', 'utf-8'))
  
  // Get TTS durations
  const ttsDurations: Record<string, number> = {}
  for (const seg of script) {
    ttsDurations[seg.id] = await probeDuration(`data/audio/test-b/${seg.id}.wav`)
  }
  
  // Concatenate all TTS into one narration track
  const narrationPath = path.join(DATA_DIR, 'audio', 'test-b', 'full-narration.wav')
  if (!existsSync(narrationPath)) {
    const listPath = narrationPath + '.txt'
    await writeFile(listPath, script.map((s: any) => `file '${s.id}.wav'`).join('\n'))
    await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', narrationPath, '-y'])
    try { await unlink(listPath) } catch {}
  }
  
  // Normalize narration
  const finalAudioPath = path.join(DATA_DIR, 'audio', 'test-b', 'final-narration.aac')
  if (!existsSync(finalAudioPath)) {
    await exec('ffmpeg', ['-i', narrationPath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', finalAudioPath, '-y'])
  }

  const totalDur = shots[shots.length - 1].end
  const durationInFrames = Math.max(30, Math.round(totalDur * FPS))

  console.log(`=== TEST B TUTORIAL RENDER ===`)
  console.log(`Shots: ${shots.length}`)
  console.log(`Duration: ${totalDur.toFixed(1)}s (${durationInFrames} frames)`)
  console.log(`Resolution: ${WIDTH}x${HEIGHT} @ ${FPS}fps`)
  console.log()

  // Render via Remotion
  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')

  console.log('[render] Bundling...')
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), 'src', 'video', 'index.ts'),
    webpackOverride: (config: any) => config,
  })

  const inputProps = {
    shots,
    segments: script,
    channelName: '',
    totalScenes: shots.length,
  }

  console.log('[render] Selecting composition...')
  const composition = await selectComposition({ serveUrl, id: 'tutorial', inputProps })
  composition.durationInFrames = durationInFrames
  composition.fps = FPS
  composition.width = WIDTH
  composition.height = HEIGHT

  const outputPath = path.join(DATA_DIR, 'videos', 'devtools-tutorial-review-720p.mp4')
  if (!existsSync(path.dirname(outputPath))) await mkdir(path.dirname(outputPath), { recursive: true })

  console.log(`[render] Rendering ${durationInFrames} frames...`)
  let lastProgress = 0
  await renderMedia({
    composition, serveUrl, codec: 'h264', outputLocation: outputPath, inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100)
      if (pct >= lastProgress + 20) {
        console.log(`[render] ${pct}%`)
        lastProgress = pct
      }
    },
    chromiumOptions: { enableMultiProcessOnLinux: true },
  })

  // Mux video + audio
  const muxedPath = outputPath.replace('.mp4', '_muxed.mp4')
  await exec('ffmpeg', [
    '-i', outputPath, '-i', finalAudioPath,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-movflags', '+faststart',
    muxedPath, '-y',
  ])
  await copyFile(muxedPath, outputPath)
  try { await unlink(muxedPath) } catch {}

  const dur = await probeDuration(outputPath)
  const size = (await stat(outputPath)).size
  console.log(`\n=== TEST B TUTORIAL COMPLETE ===`)
  console.log(`Path: ${outputPath}`)
  console.log(`Duration: ${dur.toFixed(1)}s`)
  console.log(`Size: ${(size/1024/1024).toFixed(1)}MB`)

  // QC
  console.log(`\n=== QC ===`)
  const { stdout: loudOut } = await exec('ffmpeg', ['-hide_banner', '-i', outputPath, '-af', 'volumedetect', '-vn', '-f', 'null', '/dev/null'])
  const volMatch = loudOut.match(/mean_volume:\s*(-?\d+\.?\d*)/)
  console.log(`Volume: ${volMatch?.[1] || '?'} dB`)
  console.log(`Duration: ${dur.toFixed(1)}s`)
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e.message); process.exit(1) })
