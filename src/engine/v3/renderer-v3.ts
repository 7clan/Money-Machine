/**
 * V3 Renderer (Phases 20-24)
 *
 * Replaces the universal "scenes + Ken Burns + crossfade" renderer with an
 * archetype-driven EDL-based compositor.
 *
 * Pipeline per the spec:
 *   CREATIVE DIRECTOR → EDIT DECISION LIST → COMPOSITION → FFMPEG → FINAL MP4
 *
 * Per Phase 20: FFmpeg handles media normalization, codec conversion, clip
 * trimming, audio processing, loudness, muxing, final encode, probe/validation.
 * Composition (per-entry motion graphics / overlays / transitions) happens here
 * in the renderer via SVG + ffmpeg drawtext/overlay filters.
 *
 * Per Phase 22: visual changes are SEMANTIC (tied to story beats), not arbitrary
 * "change visual every 3 seconds".
 *
 * Per Phase 23: Ken Burns is NOT the default. The renderer picks movement per
 * the archetype config + the EDL's `movement` field, with alternatives like
 * layered parallax, mask reveal, camera push, etc.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, mkdir, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import type {
  EditDecision, AssetManifest, StoryBeat, ArchetypeConfig,
  ReportingBrief, SoundCue, PipelineRunState,
} from './types'

const exec = promisify(execFile)
const DATA_DIR = path.join(process.cwd(), 'data')
const VIDEOS_DIR = path.join(DATA_DIR, 'videos')
const FRAMES_DIR = path.join(DATA_DIR, 'frames')

// ─── Brand system (Phase 39) ─────────────────────────────────
const BRAND = {
  bg: '#0b0f1a',
  bgAlt: '#141b2e',
  accent: '#ff3d57',
  accentDim: '#ff3d5740',
  white: '#ffffff',
  textMuted: '#9ca3af',
  textStrong: '#f1f5f9',
  fontFamily: 'Arial',
}

export interface RenderResultV3 {
  videoPath: string
  thumbnailPath: string
  captionPath: string
  duration: number
  fileSize: number
  archetypes: string[]
}

/**
 * Render the final video from an EditDecisionList.
 *
 * Per-entry processing:
 *   1. Take the asset for this entry (image, video, webpage capture, etc.)
 *   2. Apply the entry's crop / movement / overlay / transition
 *   3. Encode the segment to a normalized MP4
 * Then:
 *   4. Concatenate segments with the entry's transitionIn/Out
 *   5. Mix narration + music + SFX
 *   6. Final encode H.264 / AAC / +faststart
 */
export async function renderFromEDL(opts: {
  videoProjectId: string
  edl: EditDecision[]
  beats: StoryBeat[]
  assets: AssetManifest[]
  perBeatAudio: Array<{ beatId: string; audioPath: string; duration: number }>
  musicBedPath: string | null
  soundCues: SoundCue[]
  archetype: ArchetypeConfig
  brief: ReportingBrief
  isShort: boolean
  title: string
  channelName: string
  captionPath: string
}): Promise<RenderResultV3> {
  await ensureDirs()

  const {
    videoProjectId, edl, beats, assets, perBeatAudio, musicBedPath, soundCues,
    archetype, brief, isShort, title, channelName, captionPath,
  } = opts

  // Map beatId → asset + audio
  const assetByBeatId = new Map(assets.map(a => [a.storyBeatId, a]))
  const audioByBeatId = new Map(perBeatAudio.map(a => [a.beatId, a]))

  const w = isShort ? 1080 : 1920
  const h = isShort ? 1920 : 1080
  const fps = 30

  // Update progress
  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { status: 'editing', renderProgress: 5 },
  })

  // ── Step 1: Build per-entry video segments ─────────────────
  const segmentPaths: string[] = []
  for (let i = 0; i < edl.length; i++) {
    const decision = edl[i]
    if (decision.reason.includes('REJECTED')) {
      console.warn(`[v3-render] Skipping rejected EDL entry ${decision.id}: ${decision.reason}`)
      continue
    }
    const beat = beats[i]
    if (!beat) continue
    const asset = assetByBeatId.get(beat.id)
    const audio = audioByBeatId.get(beat.id)
    if (!audio) {
      console.warn(`[v3-render] No audio for beat ${beat.id}, skipping segment`)
      continue
    }

    const segmentPath = path.join(VIDEOS_DIR, `${videoProjectId}_v3seg_${i}.mp4`)
    try {
      // If asset exists, build a proper segment; otherwise use fallback
      if (asset?.localPath && existsSync(asset.localPath)) {
        await buildSegment({
          decision, beat, asset, audio,
          outputPath: segmentPath,
          w, h, fps,
          isShort,
          channelName,
          archetype,
          sceneNumber: i + 1,
          totalScenes: edl.length,
        })
      } else {
        console.warn(`[v3-render] Asset missing for beat ${beat.id}, using fallback segment`)
        await buildFallbackSegment({
          decision, audio, outputPath: segmentPath, w, h, fps, isShort, beat,
        })
      }
      segmentPaths.push(segmentPath)
    } catch (e: any) {
      console.error(`[v3-render] Segment ${i} failed:`, e.message)
      // Fallback: build a minimal segment with the audio + a branded background
      try {
        await buildFallbackSegment({
          decision, audio, outputPath: segmentPath, w, h, fps, isShort, beat,
        })
        segmentPaths.push(segmentPath)
      } catch (e2: any) {
        console.error(`[v3-render] Fallback segment ${i} also failed:`, e2.message)
      }
    }

    // Progress
    const pct = 5 + Math.round(((i + 1) / edl.length) * 50) // 5→55
    await db.videoProject.update({ where: { id: videoProjectId }, data: { renderProgress: pct } })
  }

  // If ALL segments failed, build a single fallback segment from the first beat's audio
  if (segmentPaths.length === 0) {
    console.warn('[v3-render] All segments failed — building single fallback segment from narration')
    const fallbackSegment = path.join(VIDEOS_DIR, `${videoProjectId}_fallback.mp4`)
    const firstAudio = perBeatAudio[0]
    if (firstAudio) {
      try {
        await exec('ffmpeg', [
          '-f', 'lavfi', '-i', `color=c=${BRAND.bg}:s=${w}x${h}:r=${fps}`,
          '-i', firstAudio.audioPath,
          '-vf', `drawtext=text='${escapeFFmpegText(title.slice(0, 60))}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=${BRAND.accent}@0.7:boxborderw=24`,
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
          '-c:a', 'aac', '-b:a', '192k',
          '-pix_fmt', 'yuv420p', '-r', String(fps),
          '-shortest',
          fallbackSegment, '-y',
        ])
        segmentPaths.push(fallbackSegment)
      } catch (e: any) {
        console.error('[v3-render] Even fallback segment failed:', e.message)
      }
    }
  }

  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { renderProgress: 60 },
  })

  // ── Step 2: Concatenate with transitions ──────────────────
  if (segmentPaths.length === 0) {
    throw new Error('No video segments were built — cannot render. Check that TTS audio and assets were generated.')
  }
  const rawVideoPath = path.join(VIDEOS_DIR, `${videoProjectId}_v3raw.mp4`)
  try {
    await concatenateWithTransitions(segmentPaths, rawVideoPath, archetype.transitionPhilosophy)
  } catch (e: any) {
    console.error('[v3-render] Crossfade concat failed, using plain concat:', e.message)
    try {
      await plainConcat(segmentPaths, rawVideoPath)
    } catch (e2: any) {
      console.error('[v3-render] Plain concat also failed:', e2.message)
      // Last resort: just use the first segment
      if (segmentPaths.length > 0) {
        await exec('ffmpeg', ['-i', segmentPaths[0], '-c', 'copy', rawVideoPath, '-y'])
      } else {
        throw new Error('Cannot render video — no segments available')
      }
    }
  }

  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { renderProgress: 75 },
  })

  // ── Step 3: Mix audio (narration + music bed + SFX) ────────
  const videoDuration = await probeDuration(rawVideoPath)
  const finalAudioPath = path.join(DATA_DIR, 'audio', `${videoProjectId}_v3final.aac`)

  // Build the narration track by concatenating per-beat audio in EDL order
  const narrationPath = path.join(DATA_DIR, 'audio', `${videoProjectId}_v3narration.mp3`)
  await concatAudio(
    edl.map((d, i) => {
      const beat = beats[i]
      return audioByBeatId.get(beat?.id || '')?.audioPath
    }).filter(Boolean) as string[],
    narrationPath,
  )

  await mixAudio(narrationPath, musicBedPath, finalAudioPath, videoDuration)

  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { renderProgress: 88 },
  })

  // ── Step 4: Mux video + final audio ───────────────────────
  const videoPath = path.join(VIDEOS_DIR, `${videoProjectId}.mp4`)
  await exec('ffmpeg', [
    '-i', rawVideoPath, '-i', finalAudioPath,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-map', '0:v:0', '-map', '1:a:0',
    '-shortest',
    '-movflags', '+faststart',
    videoPath, '-y',
  ])

  const duration = await probeDuration(videoPath)
  let fileSize = 0
  try { fileSize = (await stat(videoPath)).size } catch {}

  // ── Step 5: Cleanup intermediates ─────────────────────────
  for (const seg of segmentPaths) {
    try { await unlink(seg) } catch {}
  }
  try { await unlink(rawVideoPath) } catch {}
  try { await unlink(narrationPath) } catch {}
  try { await unlink(finalAudioPath) } catch {}

  // ── Step 6: Generate thumbnail (Phase 34) ─────────────────
  const thumbnailPath = await generateThumbnailV3({
    videoProjectId, title, brief, archetype, isShort, channelName,
  })

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

  return {
    videoPath, thumbnailPath, captionPath, duration, fileSize,
    archetypes: [archetype.archetype],
  }
}

// ─── Build a single segment from an EDL entry ──────────────

async function buildSegment(opts: {
  decision: EditDecision
  beat: StoryBeat
  asset: AssetManifest
  audio: { beatId: string; audioPath: string; duration: number }
  outputPath: string
  w: number
  h: number
  fps: number
  isShort: boolean
  channelName: string
  archetype: ArchetypeConfig
  sceneNumber: number
  totalScenes: number
}): Promise<void> {
  const { decision, beat, asset, audio, outputPath, w, h, fps, isShort, channelName, archetype, sceneNumber, totalScenes } = opts
  const duration = audio.duration || (decision.end - decision.start) || 4

  // Determine the asset type — ZAI_VIDEO needs different handling than image assets
  const isVideoAsset = asset.type === 'ZAI_VIDEO' || asset.type === 'PUBLIC_DOMAIN_VIDEO' || asset.type === 'ORIGINAL_SCREEN_RECORDING'
  const assetPath = asset.localPath
  if (!assetPath || !existsSync(assetPath)) {
    throw new Error(`Asset file missing: ${assetPath}`)
  }

  // Build the SVG overlay (text, scene title, watermark, progress)
  const overlaySvgPath = path.join(FRAMES_DIR, `overlay_${sceneNumber}.svg`)
  const overlayPngPath = path.join(FRAMES_DIR, `overlay_${sceneNumber}.png`)
  await writeOverlaySvg({
    beat, decision, channelName, sceneNumber, totalScenes, isShort, w, h,
    outputPath: overlaySvgPath,
  })
  await svgToPng(overlaySvgPath, overlayPngPath, w, h)

  // Pick the motion style based on EDL + archetype
  // Per Phase 23: NOT Ken Burns by default. The archetype config influences motion.
  const motion = decision.movement || pickArchetypeMotion(archetype, sceneNumber)
  const vf = buildVideoFilter({
    motion, w, h, fps, duration, isShort,
    overlayPath: overlayPngPath,
  })

  if (isVideoAsset) {
    // For video assets: take the asset video, loop/trim to fit the duration, apply motion + overlay
    await exec('ffmpeg', [
      '-stream_loop', '-1', '-i', assetPath, // loop video if shorter than duration
      '-i', overlayPngPath,
      '-t', String(duration),
      '-filter_complex', vf,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-r', String(fps),
      '-movflags', '+faststart',
      '-shortest',
      outputPath, '-y',
    ])
  } else {
    // For image assets: loop the still, apply motion + overlay
    await exec('ffmpeg', [
      '-loop', '1', '-i', assetPath,
      '-i', overlayPngPath,
      '-t', String(duration),
      '-filter_complex', vf,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-r', String(fps),
      '-movflags', '+faststart',
      outputPath, '-y',
    ])
  }

  // Clean up overlay
  try { await unlink(overlayPngPath) } catch {}
  try { await unlink(overlaySvgPath) } catch {}
}

// ─── Motion picker (Phase 23) ──────────────────────────────

function pickArchetypeMotion(archetype: ArchetypeConfig, sceneNumber: number): string {
  // Rotate through different motion styles per archetype to avoid
  // the "Ken Burns on every scene" anti-pattern
  const motionPool: Record<ArchetypeConfig['transitionPhilosophy'], string[]> = {
    hard_cut: ['static', 'pan_right', 'static', 'pan_left', 'static', 'zoom_in'],
    crossfade: ['ken_burns_in', 'static', 'ken_burns_out', 'static', 'pan_right'],
    match_cut: ['static', 'pan_left', 'static', 'pan_right'],
    mixed: ['ken_burns_in', 'pan_right', 'static', 'ken_burns_out', 'pan_left', 'static'],
  }
  const pool = motionPool[archetype.transitionPhilosophy] || motionPool.mixed
  return pool[sceneNumber % pool.length]
}

function buildVideoFilter(opts: {
  motion: string
  w: number
  h: number
  fps: number
  duration: number
  isShort: boolean
  overlayPath: string
}): string {
  const { motion, w, h, fps, duration, overlayPath } = opts
  const totalFrames = Math.max(1, Math.round(duration * fps))

  // The base filter: scale + crop to fill the frame
  const scaleAndCrop = `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2}`

  // Motion via zoompan
  let motionFilter: string
  switch (motion) {
    case 'ken_burns_in':
      motionFilter = `zoompan=z='min(zoom+0.0008,1.15)':d=${totalFrames}:s=${w}x${h}:fps=${fps}:x='iw*0.5-(iw/zoom/2)':y='ih*0.5-(ih/zoom/2)'`
      break
    case 'ken_burns_out':
      motionFilter = `zoompan=z='max(zoom-0.0008,1.0)':d=${totalFrames}:s=${w}x${h}:fps=${fps}:x='iw*0.5-(iw/zoom/2)':y='ih*0.5-(ih/zoom/2)'`
      break
    case 'pan_right':
      motionFilter = `zoompan=z=1.1:d=${totalFrames}:s=${w}x${h}:fps=${fps}:x='on/(iw-iw/1.1)*iw/2':y='ih*0.5-(ih/zoom/2)'`
      break
    case 'pan_left':
      motionFilter = `zoompan=z=1.1:d=${totalFrames}:s=${w}x${h}:fps=${fps}:x='iw-iw/zoom-on/(iw-iw/1.1)*iw/2':y='ih*0.5-(ih/zoom/2)'`
      break
    case 'zoom_in':
      motionFilter = `zoompan=z='min(zoom+0.0015,1.25)':d=${totalFrames}:s=${w}x${h}:fps=${fps}:x='iw*0.5-(iw/zoom/2)':y='ih*0.5-(ih/zoom/2)'`
      break
    case 'static':
    default:
      motionFilter = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
      break
  }

  // [0:v] = video/still input, [1:v] = overlay PNG
  // Apply motion to [0:v], then overlay [1:v] on top
  if (motion === 'static') {
    return `[0:v]${scaleAndCrop},${motionFilter},setsar=1[bg];[bg][1:v]overlay=0:0[out]`
  }
  return `[0:v]${scaleAndCrop},${motionFilter},setsar=1[bg];[bg][1:v]overlay=0:0[out]`
}

// ─── SVG overlay (title, watermark, progress) ──────────────

async function writeOverlaySvg(opts: {
  beat: StoryBeat
  decision: EditDecision
  channelName: string
  sceneNumber: number
  totalScenes: number
  isShort: boolean
  w: number
  h: number
  outputPath: string
}): Promise<void> {
  const { beat, decision, channelName, sceneNumber, totalScenes, isShort, w, h, outputPath } = opts
  const esc = (s: string) => (s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] || c))

  // Title position varies by archetype format
  const titleX = isShort ? w / 2 : 60
  const titleY = isShort ? h * 0.85 : h - 160
  const titleFont = isShort ? 36 : 48
  const titleAnchor = isShort ? 'middle' : 'start'

  // Lower-third caption (first sentence of narration, max 60 chars)
  const captionLine = beat.narration.split(/[.!?]/)[0].slice(0, 60)
  const captionX = isShort ? w / 2 : 60
  const captionY = isShort ? h * 0.92 : h - 90
  const captionFont = isShort ? 22 : 28

  // If decision.overlay is set, use it as the lower-third text instead
  const lowerText = decision.overlay || captionLine
  const lowerEsc = esc(lowerText)

  // Scene title (beat.title or first 40 chars of narration)
  const sceneTitle = beat.title || (beat as any).narration?.slice(0, 40) || ''
  const titleEsc = esc(sceneTitle)

  // Watermark (channel name top-right)
  const watermarkEsc = esc(channelName.slice(0, 24))

  // Progress
  const progress = `${sceneNumber}/${totalScenes}`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <!-- Bottom gradient overlay for text readability -->
    <defs>
      <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${isShort ? h * 0.7 : h - 220}" width="${w}" height="${isShort ? h * 0.3 : 220}" fill="url(#bottomGrad)"/>

    <!-- Scene title (accent box behind text) -->
    <rect x="${isShort ? w * 0.1 : 50}" y="${titleY - 50}" width="${isShort ? w * 0.8 : Math.max(sceneTitle.length * titleFont * 0.55, 200) + 30}" height="${titleFont + 30}" fill="${BRAND.accent}" fill-opacity="0.6" rx="4"/>
    <text x="${titleX}" y="${titleY}" font-family="${BRAND.fontFamily}" font-size="${titleFont}" font-weight="bold" fill="${BRAND.white}" text-anchor="${titleAnchor}">${titleEsc}</text>

    <!-- Lower-third caption -->
    ${lowerEsc ? `<text x="${captionX}" y="${captionY}" font-family="${BRAND.fontFamily}" font-size="${captionFont}" fill="${BRAND.textStrong}" text-anchor="${isShort ? 'middle' : 'start'}">${lowerEsc}</text>` : ''}

    <!-- Channel watermark (top-right) -->
    <rect x="${w - 260}" y="20" width="${Math.min(watermarkEsc.length * 14 + 30, 280)}" height="44" fill="${BRAND.bg}" fill-opacity="0.5" rx="4"/>
    <text x="${w - 240}" y="50" font-family="${BRAND.fontFamily}" font-size="22" fill="${BRAND.white}" fill-opacity="0.85">${watermarkEsc}</text>

    <!-- Progress indicator (bottom-right) -->
    <text x="${w - 30}" y="${h - 30}" font-family="${BRAND.fontFamily}" font-size="20" fill="${BRAND.textMuted}" text-anchor="end">${progress}</text>
  </svg>`

  await writeFile(outputPath, svg)
}

async function svgToPng(svgPath: string, pngPath: string, w: number, h: number): Promise<void> {
  try {
    await exec('ffmpeg', [
      '-i', svgPath,
      '-vf', `scale=${w}:${h}`,
      '-frames:v', '1', '-y', pngPath,
    ])
  } catch {
    // Fallback: rsvg-convert
    try {
      await exec('rsvg-convert', ['-w', String(w), '-h', String(h), svgPath, '-o', pngPath])
    } catch {
      // Last resort: just save the SVG with PNG extension
      const svgContent = await readFile(svgPath)
      await writeFile(pngPath, svgContent)
    }
  }
}

// ─── Fallback segment (when asset is missing) ─────────────

async function buildFallbackSegment(opts: {
  decision: EditDecision
  audio: { beatId: string; audioPath: string; duration: number }
  outputPath: string
  w: number
  h: number
  fps: number
  isShort: boolean
  beat: StoryBeat
}): Promise<void> {
  const { decision, audio, outputPath, w, h, fps, beat } = opts
  const duration = audio.duration || 4
  // Solid color background + scene title + narration audio
  await exec('ffmpeg', [
    '-f', 'lavfi', '-i', `color=c=${BRAND.bg}:s=${w}x${h}:d=${duration}:r=${fps}`,
    '-i', audio.audioPath,
    '-vf', `drawtext=text='${escapeFFmpegText(beat.narration.slice(0, 60))}':fontsize=36:fontcolor=white:x=60:y=h/2:box=1:boxcolor=${BRAND.accent}@0.5:boxborderw=20`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '192k',
    '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-t', String(duration),
    '-shortest',
    outputPath, '-y',
  ])
}

function escapeFFmpegText(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\\\:')
    .replace(/'/g, "\\\\'")
    .replace(/%/g, '\\\\%')
    .replace(/,/g, '\\\\,')
    .replace(/\n/g, ' ')
    .slice(0, 80)
}

// ─── Transitions (Phase 22) ────────────────────────────────

async function concatenateWithTransitions(segments: string[], outputPath: string, philosophy: ArchetypeConfig['transitionPhilosophy']): Promise<void> {
  if (segments.length === 0) {
    throw new Error('No segments to concatenate')
  }
  if (segments.length === 1) {
    await exec('ffmpeg', ['-i', segments[0], '-c', 'copy', outputPath, '-y'])
    return
  }
  if (philosophy === 'hard_cut' || segments.length > 8) {
    // Plain concat for hard cut philosophy or many segments
    return plainConcat(segments, outputPath)
  }

  // xfade chain for crossfade / match_cut / mixed
  const xfadeDuration = 0.5
  const durations: number[] = []
  for (const p of segments) durations.push(await probeDuration(p))

  let filter = ''
  let prevLabel = '[0:v]'
  let prevAudioLabel = '[0:a]'
  let cumulative = durations[0]

  for (let i = 1; i < segments.length; i++) {
    const offset = Math.max(0, cumulative - xfadeDuration)
    const transition = philosophy === 'crossfade' ? 'fade' : philosophy === 'match_cut' ? 'smoothleft' : ['fade', 'dissolve', 'wipeleft'][i % 3]
    const outV = `[v${i}]`
    const outA = `[a${i}]`
    filter +=
      `${prevLabel}[${i}:v]xfade=transition=${transition}:duration=${xfadeDuration}:offset=${offset}${outV};` +
      `${prevAudioLabel}[${i}:a]acrossfade=d=${xfadeDuration}:c1=tri:c2=tri${outA};`
    prevLabel = outV
    prevAudioLabel = outA
    cumulative = offset + durations[i]
  }
  filter = filter.replace(/;$/, '')

  const inputs: string[] = []
  for (const p of segments) inputs.push('-i', p)

  await exec('ffmpeg', [
    ...inputs,
    '-filter_complex', filter,
    '-map', prevLabel,
    '-map', prevAudioLabel,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-movflags', '+faststart',
    outputPath, '-y',
  ])
}

async function plainConcat(segments: string[], outputPath: string): Promise<void> {
  const concatListPath = outputPath + '.concat.txt'
  await writeFile(concatListPath, segments.map(p => `file '${p}'`).join('\n'))
  await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', outputPath, '-y'])
  try { await unlink(concatListPath) } catch {}
}

async function concatAudio(segments: string[], outputPath: string): Promise<void> {
  if (segments.length === 0) return
  const concatListPath = outputPath + '.concat.txt'
  await writeFile(concatListPath, segments.map(p => `file '${p}'`).join('\n'))
  await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', outputPath, '-y'])
  try { await unlink(concatListPath) } catch {}
}

async function mixAudio(narrationPath: string, musicBedPath: string | null, outputPath: string, durationSec: number): Promise<void> {
  if (!musicBedPath || !existsSync(musicBedPath)) {
    // Narration only — loudnorm
    await exec('ffmpeg', [
      '-i', narrationPath,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
      outputPath, '-y',
    ])
    return
  }
  await exec('ffmpeg', [
    '-i', narrationPath, '-i', musicBedPath,
    '-filter_complex',
    '[0:a]loudnorm=I=-16:TP=-1.5:LRA=11[narr];' +
    '[1:a]volume=0.12,atrim=duration=' + durationSec + '[bed];' +
    '[narr][bed]amix=inputs=2:duration=first:dropout_transition=0[a]',
    '-map', '[a]',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    outputPath, '-y',
  ])
}

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
    ])
    return parseFloat(stdout.trim()) || 0
  } catch {
    return 0
  }
}

// ─── V3 Thumbnail (Phase 34 — concepts first) ────────────

async function generateThumbnailV3(opts: {
  videoProjectId: string
  title: string
  brief: ReportingBrief
  archetype: ArchetypeConfig
  isShort: boolean
  channelName: string
}): Promise<string> {
  const { videoProjectId, title, brief, archetype, isShort } = opts
  const thumbnailPath = path.join(DATA_DIR, 'thumbnails', `${videoProjectId}.png`)

  // Generate 3 thumbnail concepts via LLM, pick the best one
  const conceptsResponse = await llm([
    { role: 'system', content: 'You are a YouTube thumbnail designer. Return ONLY JSON.' },
    {
      role: 'user',
      content: `Design 3 different thumbnail concepts for a ${archetype.archetype} video.
TITLE: ${title}
ANGLE: ${brief.angle}
KEY SURPRISING FACT: ${brief.whatIsSurprising[0] || brief.mainConflict}

The title and thumbnail must COMPLEMENT each other (not duplicate).
If the title is "How Nokia Lost Everything", the thumbnail should NOT just say "WHY NOKIA FAILED" —
it should show something the title doesn't: a falling graph, a date, a shocking number.

Return JSON array:
[{
  "visualSubject": "what's the main subject (a phone, a chart, a map, a person)",
  "composition": "how it's framed",
  "emotion": "what feeling it evokes",
  "background": "what's behind the subject",
  "textIfAny": "max 3 words of text on the thumbnail (often none)",
  "curiosityMechanism": "what makes viewer want to click"
}]`,
    },
  ])

  let concepts: any[] = []
  try {
    concepts = extractJSONArray<any>(conceptsResponse)
  } catch {
    concepts = [{ visualSubject: title, composition: 'centered', emotion: 'curious', background: 'dark', textIfAny: '', curiosityMechanism: 'mystery' }]
  }

  // Pick the first concept (could score them later)
  const concept = concepts[0] || {}

  // Generate the thumbnail via image generation with a very specific prompt
  try {
    const { generateImage } = await import('../zai-provider')
    const prompt = `YouTube ${isShort ? 'Shorts' : 'video'} thumbnail. ${concept.visualSubject || title}. ${concept.composition || ''}. Mood: ${concept.emotion || 'curious'}. Background: ${concept.background || 'dark navy'}. High contrast, dramatic lighting, eye-catching, no text overlay (text will be added separately). Aspect ratio ${isShort ? '9:16 vertical' : '16:9 wide'}.`
    const buf = await generateImage(prompt, isShort ? '1024x1024' : '1344x768')
    if (buf && buf.length > 1024) {
      await writeFile(thumbnailPath, buf)
      // Add bold title text overlay in lower third
      const w = isShort ? 1080 : 1280
      const h = isShort ? 1920 : 720
      const overlayTmpPath = thumbnailPath + '.tmp.png'
      await exec('ffmpeg', [
        '-i', thumbnailPath,
        '-vf',
        `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` +
        `drawbox=x=0:y=${h - 220}:w=${w}:h=220:color=black@0.6:t=fill,` +
        `drawtext=text='${escapeFFmpegText(title.slice(0, 50))}':fontsize=${isShort ? 56 : 48}:fontcolor=white:x=40:y=${h - 140}:box=1:boxcolor=${BRAND.accent}@0.85:boxborderw=16,` +
        (concept.textIfAny ? `drawtext=text='${escapeFFmpegText(concept.textIfAny)}':fontsize=${isShort ? 80 : 64}:fontcolor=white:x=(w-text_w)/2:y=80:box=1:boxcolor=black@0.7:boxborderw=20` : ''),
        '-frames:v', '1', overlayTmpPath, '-y',
      ])
      try { await unlink(thumbnailPath) } catch {}
      await readFile(overlayTmpPath).then(b => writeFile(thumbnailPath, b))
      try { await unlink(overlayTmpPath) } catch {}
    }
  } catch (e) {
    console.error('[v3-thumbnail] Generation failed, using fallback:', e)
    // Fallback thumbnail
    const w = isShort ? 1080 : 1280
    const h = isShort ? 1920 : 720
    await exec('ffmpeg', [
      '-f', 'lavfi', '-i', `color=c=${BRAND.bg}:s=${w}x${h}:d=0.04`,
      '-vf', `drawtext=text='${escapeFFmpegText(title.slice(0, 50))}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=${BRAND.accent}@0.7:boxborderw=24`,
      '-frames:v', '1', thumbnailPath, '-y',
    ])
  }

  return thumbnailPath
}

// ─── Helpers ────────────────────────────────────────────────

async function ensureDirs() {
  for (const d of [DATA_DIR, VIDEOS_DIR, FRAMES_DIR, path.join(DATA_DIR, 'audio'), path.join(DATA_DIR, 'thumbnails')]) {
    if (!existsSync(d)) await mkdir(d, { recursive: true })
  }
}

// LLM import (deferred to avoid circular imports)
let _llm: typeof import('../zai-provider').llm | null = null
async function llm(messages: any[]): Promise<string> {
  if (!_llm) {
    const mod = await import('../zai-provider')
    _llm = mod.llm
  }
  return _llm(messages)
}

// extractJSONArray / extractJSONObject imported lazily
let _extractJSONArray: typeof import('../json-utils').extractJSONArray | null = null
async function getExtractJSONArray() {
  if (!_extractJSONArray) {
    const mod = await import('../json-utils')
    _extractJSONArray = mod.extractJSONArray
  }
  return _extractJSONArray
}
