/**
 * Video Renderer
 * 
 * Produces videos using FFmpeg from script scenes, narration audio, and visuals.
 * Handles: audio generation (TTS), image generation, video assembly, caption creation.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, mkdir, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { tts, generateImage } from './zai-provider'
import { db } from '@/lib/db'

const exec = promisify(execFile)
const DATA_DIR = path.join(process.cwd(), 'data')
const VIDEOS_DIR = path.join(DATA_DIR, 'videos')
const AUDIO_DIR = path.join(DATA_DIR, 'audio')
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails')

/** Escape text for FFmpeg drawtext filter (colons, apostrophes, backslashes) */
function escapeFFmpegText(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "\\\\'")
    .replace(/:/g, '\\\\:')
    .replace(/%/g, '\\\\%')
    .slice(0, 60) // Limit length
}

export interface RenderResult {
  videoPath: string
  thumbnailPath: string
  captionPath: string
  duration: number
  fileSize: number
}

/** Ensure data directories exist */
async function ensureDirs() {
  for (const dir of [VIDEOS_DIR, AUDIO_DIR, THUMBNAILS_DIR]) {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  }
}

/** Generate narration audio for a script using TTS */
async function generateNarration(scriptId: string, scenes: Array<{ narrationText: string; order: number }>): Promise<string> {
  await ensureDirs()
  const audioSegments: string[] = []

  for (const scene of scenes) {
    if (!scene.narrationText?.trim()) continue

    const segmentPath = path.join(AUDIO_DIR, `${scriptId}_scene_${scene.order}.mp3`)
    
    try {
      const audioBuffer = await tts(scene.narrationText, 'alloy', 1.0)
      await writeFile(segmentPath, audioBuffer)
      audioSegments.push(segmentPath)

      // Create voice track record
      await db.voiceTrack.create({
        data: {
          scriptId,
          language: 'en',
          speed: 1.0,
          status: 'completed',
        },
      })
    } catch (e) {
      console.error(`TTS failed for scene ${scene.order}:`, e)
      // Create silent audio segment as fallback
      await exec('ffmpeg', [
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
        '-t', '3', '-q:a', '9', segmentPath
      ])
      audioSegments.push(segmentPath)
    }
  }

  // Concatenate audio segments
  const concatListPath = path.join(AUDIO_DIR, `${scriptId}_concat.txt`)
  const concatContent = audioSegments.map(p => `file '${p}'`).join('\n')
  await writeFile(concatListPath, concatContent)

  const combinedPath = path.join(AUDIO_DIR, `${scriptId}_narration.mp3`)
  await exec('ffmpeg', [
    '-f', 'concat', '-safe', '0', '-i', concatListPath,
    '-c', 'copy', combinedPath, '-y'
  ])

  // Get audio duration
  const { stdout } = await exec('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', combinedPath
  ])
  const duration = parseFloat(stdout.trim())

  // Cleanup temp files
  for (const seg of audioSegments) {
    try { await unlink(seg) } catch {}
  }
  try { await unlink(concatListPath) } catch {}

  return combinedPath
}

/** Generate thumbnail image */
async function generateThumbnail(videoProjectId: string, title: string, niche: string): Promise<string> {
  await ensureDirs()
  const thumbnailPath = path.join(THUMBNAILS_DIR, `${videoProjectId}.png`)

  try {
    const imageBuffer = await generateImage(
      `YouTube thumbnail for video "${title}". Professional, clean, eye-catching design with bold readable text. Topic: ${niche}. High contrast, vibrant colors, 16:9 aspect ratio suitable for YouTube.`,
      '1344x768'
    )
    await writeFile(thumbnailPath, imageBuffer)
  } catch (e) {
    console.error('Thumbnail generation failed, creating fallback:', e)
    // Create a simple colored rectangle as fallback thumbnail
    await exec('ffmpeg', [
      '-f', 'lavfi', '-i', 'color=c=#1a1a2e:s=1344x768:d=0.04',
      '-vf', `drawtext=text='${escapeFFmpegText(title)}':fontsize=48:fontcolor=white:x=60:y=340`,
      '-frames:v', '1', thumbnailPath, '-y'
    ])
  }

  return thumbnailPath
}

/** Generate SRT captions from narration text and timing */
async function generateCaptions(
  scenes: Array<{ narrationText: string; duration: number; order: number }>,
  captionPath: string
): Promise<void> {
  let srt = ''
  let index = 1
  let startTime = 0

  for (const scene of scenes) {
    if (!scene.narrationText?.trim()) continue

    const endTime = startTime + (scene.duration || 5)
    const startH = Math.floor(startTime / 3600)
    const startM = Math.floor((startTime % 3600) / 60)
    const startS = Math.floor(startTime % 60)
    const startMs = Math.floor((startTime % 1) * 1000)

    const endH = Math.floor(endTime / 3600)
    const endM = Math.floor((endTime % 3600) / 60)
    const endS = Math.floor(endTime % 60)
    const endMs = Math.floor((endTime % 1) * 1000)

    const formatTime = (h: number, m: number, s: number, ms: number) =>
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`

    // Split long narration into subtitle chunks (max ~40 chars per line)
    const words = scene.narrationText.split(' ')
    let line = ''
    let lineStart = startTime
    const wordsPerSecond = 2.5 // average reading speed

    for (let i = 0; i < words.length; i++) {
      line += (line ? ' ' : '') + words[i]
      if (line.length > 40 || i === words.length - 1) {
        const lineDuration = line.split(' ').length / wordsPerSecond
        const lineEnd = Math.min(lineStart + lineDuration, endTime)
        
        srt += `${index}\n`
        srt += `${formatTime(Math.floor(lineStart/3600), Math.floor((lineStart%3600)/60), Math.floor(lineStart%60), Math.floor((lineStart%1)*1000))} --> ${formatTime(Math.floor(lineEnd/3600), Math.floor((lineEnd%3600)/60), Math.floor(lineEnd%60), Math.floor((lineEnd%1)*1000))}\n`
        srt += `${line}\n\n`
        index++
        lineStart = lineEnd
        line = ''
      }
    }

    startTime = endTime
  }

  await writeFile(captionPath, srt)
}

/** Render complete video from a video project */
export async function renderVideo(videoProjectId: string): Promise<RenderResult> {
  await ensureDirs()

  const project = await db.videoProject.findUnique({
    where: { id: videoProjectId },
    include: {
      videoIdea: {
        include: {
          scripts: { include: { scenes: { orderBy: { order: 'asc' } } } },
        },
      },
    },
  })

  if (!project) throw new Error(`VideoProject ${videoProjectId} not found`)
  if (!project.videoIdea.scripts.length) throw new Error('No script found for this video')

  const script = project.videoIdea.scripts[0]
  // Normalize scenes: cast to a stricter shape expected by narration/captions helpers
  const scenes = script.scenes.map((s) => ({
    narrationText: s.narrationText ?? '',
    duration: s.duration ?? 0,
    order: s.order,
    visualType: s.visualType,
    visualNotes: s.visualNotes ?? '',
    transitionType: s.transitionType ?? 'cut',
    title: s.title,
    description: s.description ?? '',
  }))

  // Update project status
  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { status: 'editing', renderProgress: 10 },
  })

  // Step 1: Generate narration
  const narrationPath = await generateNarration(script.id, scenes)

  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { renderProgress: 40 },
  })

  // Step 2: Generate thumbnail
  const niche = await db.agentState.findUnique({ where: { key: 'selected_niche' } })
  const nicheName = niche ? JSON.parse(niche.value).nicheName : 'Technology'
  const thumbnailPath = await generateThumbnail(videoProjectId, project.title, nicheName)

  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { renderProgress: 60 },
  })

  // Step 3: Generate captions
  const captionPath = path.join(VIDEOS_DIR, `${videoProjectId}.srt`)
  await generateCaptions(scenes, captionPath)

  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { renderProgress: 70 },
  })

  // Step 4: Assemble video with FFmpeg
  const videoPath = path.join(VIDEOS_DIR, `${videoProjectId}.mp4`)
  
  // Create video with narration audio and text overlays
  const isShort = project.videoIdea.type === 'short'
  const videoWidth = isShort ? 1080 : 1920
  const videoHeight = isShort ? 1920 : 1080
  const bgColor = '#1a1a2e'
  const textColor = 'white'
  const accentColor = '#e94560'

  try {
    // Create a video from the audio with visual elements
    // For each scene, create a segment with background + text overlay
    const segments: string[] = []
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const sceneAudio = path.join(AUDIO_DIR, `${script.id}_scene_${scene.order}.mp3`)
      const segmentPath = path.join(VIDEOS_DIR, `${videoProjectId}_seg_${i}.mp4`)
      
      // Get scene audio duration (fallback to scene.duration)
      let sceneDuration = scene.duration || 5
      try {
        const { stdout: durOut } = await exec('ffprobe', [
          '-v', 'error', '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1', narrationPath
        ])
        sceneDuration = parseFloat(durOut.trim()) || sceneDuration
      } catch {}

      const title = scene.title
      const desc = (scene.description || '').slice(0, 80)
      
      // Create segment with colored background and text
      await exec('ffmpeg', [
        '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${videoWidth}x${videoHeight}:d=${sceneDuration}:r=30`,
        '-vf', `drawtext=text='${escapeFFmpegText(title)}':fontsize=${isShort ? 36 : 48}:fontcolor=${accentColor}:x=60:y=h*0.3${desc ? `,drawtext=text='${escapeFFmpegText(desc)}':fontsize=${isShort ? 20 : 28}:fontcolor=${textColor}:x=60:y=h*0.5` : ''}`,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-pix_fmt', 'yuv420p', '-r', '30',
        '-t', String(sceneDuration),
        segmentPath, '-y'
      ])
      
      segments.push(segmentPath)
    }

    // Concatenate video segments
    if (segments.length > 1) {
      const concatFile = path.join(VIDEOS_DIR, `${videoProjectId}_concat.txt`)
      await writeFile(concatFile, segments.map(p => `file '${p}'`).join('\n'))
      await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', concatFile, '-c', 'copy', `${videoPath}.tmp.mp4`, '-y'])
      
      // Add narration audio to the concatenated video
      await exec('ffmpeg', [
        '-i', `${videoPath}.tmp.mp4`, '-i', narrationPath,
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest', videoPath, '-y'
      ])
      
      try { await unlink(`${videoPath}.tmp.mp4`) } catch {}
      try { await unlink(concatFile) } catch {}
    } else if (segments.length === 1) {
      await exec('ffmpeg', [
        '-i', segments[0], '-i', narrationPath,
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest', videoPath, '-y'
      ])
    } else {
      // Fallback: just audio with static image
      await exec('ffmpeg', [
        '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${videoWidth}x${videoHeight}:r=30`,
        '-i', narrationPath,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '192k',
        '-pix_fmt', 'yuv420p', '-shortest', videoPath, '-y'
      ])
    }

    // Cleanup segments
    for (const seg of segments) {
      try { await unlink(seg) } catch {}
    }

  } catch (e) {
    console.error('Video assembly failed, creating fallback:', e)
    // Absolute fallback: static image + audio
    await exec('ffmpeg', [
      '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${videoWidth}x${videoHeight}:r=30`,
      '-i', narrationPath,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-c:a', 'aac', '-b:a', '128k',
      '-pix_fmt', 'yuv420p', '-shortest', videoPath, '-y'
    ])
  }

  // Get video info
  let duration = 0
  let fileSize = 0
  try {
    const { stdout: durOut } = await exec('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', videoPath
    ])
    duration = parseFloat(durOut.trim())

    const fileStat = await stat(videoPath)
    fileSize = fileStat.size
  } catch {}

  // Update project
  await db.videoProject.update({
    where: { id: videoProjectId },
    data: {
      videoFilePath: videoPath,
      thumbnailPath,
      captionPath,
      duration,
      fileSize,
      renderProgress: 100,
      status: 'review',
    },
  })

  return { videoPath, thumbnailPath, captionPath, duration, fileSize }
}
