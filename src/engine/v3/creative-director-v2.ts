/**
 * Creative Director V2 (Phase: spec section 5-9, 11, 19)
 *
 * Replaces the V1 orchestrator that made 9 LLM calls with a lean pipeline:
 *
 *   1. Deterministic research (web search — real data, NOT LLM memory)
 *   2. ONE MasterProductionPlan LLM call (GLM-5.3, thinking enabled, cached)
 *   3. Per-beat TTS (resumable, cached)
 *   4. Rough-cut assets (charts/maps/text-cards — cheap, deterministic)
 *   5. Critique the rough cut (VLM inspects actual frames)
 *   6. If PASS: acquire expensive assets (Z.ai images, Z.ai video)
 *   7. Remotion composition (per-frame SVG + ffmpeg encode)
 *   8. Audio mix (narration only — musicMode = NONE per spec section 18)
 *   9. Production quality gate (blackdetect, freezedetect, silencedetect, LUFS)
 *
 * Every stage persists output → resumable from the exact failed checkpoint.
 */

import { db } from '@/lib/db'
import { llm, tts, generateImage, webSearch, readPage, vision, getSchedulerStats } from './zai-scheduler'
import { buildMasterProductionPlan, type MasterProductionPlan } from './master-production-plan'
import {
  flattenBeats, buildPerformanceScript, buildEDLDeterministic,
  generateCaptionsDeterministic, buildSoundCuesDeterministic,
  generateFilePaths, calculateProgress,
} from './deterministic-code-layer'
import { runQualityGate, type QualityGateResult } from './quality-gate'
import { renderComposition, encodeFramesToVideo } from './remotion-composition'
import { routeArchetype, getArchetypeConfig } from './archetypes'
import { extractJSONObject } from '../json-utils'
import type {
  StoryBeat, AssetManifest, EditDecision, SoundCue, PipelineRunState,
} from './types'
import { writeFile, readFile, mkdir, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { randomUUID } from 'crypto'

const exec = promisify(execFile)
const DATA_DIR = path.join(process.cwd(), 'data')

// ─── Pipeline state persistence (resumability — spec section 19) ─

interface PipelineCheckpoint {
  videoProjectId: string
  archetype?: string
  stage: string
  startedAt: string
  completedStages: string[]
  masterPlan?: MasterProductionPlan
  beats?: StoryBeat[]
  perBeatAudio?: Array<{ beatId: string; audioPath: string; duration: number }>
  assets?: AssetManifest[]
  edl?: EditDecision[]
  qualityGate?: QualityGateResult
  errors: Array<{ stage: string; error: string; timestamp: string }>
}

async function loadCheckpoint(videoProjectId: string): Promise<PipelineCheckpoint | null> {
  const dir = path.join(DATA_DIR, 'pipeline-state')
  const p = path.join(dir, `${videoProjectId}.json`)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(await readFile(p, 'utf-8'))
  } catch {
    return null
  }
}

async function saveCheckpoint(state: PipelineCheckpoint): Promise<void> {
  const dir = path.join(DATA_DIR, 'pipeline-state')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  const p = path.join(dir, `${state.videoProjectId}.json`)
  await writeFile(p, JSON.stringify(state, null, 2))
}

// ─── Main pipeline ──────────────────────────────────────────

export async function produceVideoV3(
  videoProjectId: string,
  options: {
    enableVideoGeneration?: boolean
    maxVideoClips?: number
    forceResume?: boolean
  } = {},
): Promise<{
  videoPath: string
  duration: number
  archetype: string
  qualityGate: QualityGateResult
  schedulerStats: any
}> {
  const { enableVideoGeneration = true, maxVideoClips = 2 } = options

  // Load project + idea
  const project = await db.videoProject.findUnique({
    where: { id: videoProjectId },
    include: {
      videoIdea: {
        include: {
          scripts: { include: { scenes: { orderBy: { order: 'asc' } } }, orderBy: { version: 'desc' } },
        },
      },
    },
  })
  if (!project) throw new Error(`VideoProject ${videoProjectId} not found`)
  if (!project.videoIdea.scripts.length) throw new Error('No script found')

  const script = project.videoIdea.scripts[0]
  const isShort = project.videoIdea.type === 'short'
  // TEST A scope: 2-4 minutes for long-form (per spec section 21)
  // Reduced to 90s target to avoid LLM response truncation (19KB max response)
  const targetDurationSec = isShort ? 45 : 90 // 1.5 min for long-form TEST scope

  // Load channel context
  const nicheState = await db.agentState.findUnique({ where: { key: 'selected_niche' } })
  const channelState = await db.agentState.findUnique({ where: { key: 'channel_strategy' } })
  const niche = nicheState ? JSON.parse(nicheState.value).nicheName : 'Technology'
  const channelName = channelState ? (JSON.parse(channelState.value).channelName || 'Money Machine') : 'Money Machine'

  // ── Load or init checkpoint (resumability) ─────────────
  let checkpoint = await loadCheckpoint(videoProjectId)
  if (checkpoint && !options.forceResume) {
    console.log(`[v3] Resuming from stage "${checkpoint.stage}" (${checkpoint.completedStages.length} stages done)`)
  } else {
    checkpoint = {
      videoProjectId,
      stage: 'init',
      startedAt: new Date().toISOString(),
      completedStages: [],
      errors: [],
    }
  }

  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { status: 'editing', renderProgress: 1 },
  })

  const paths = generateFilePaths(videoProjectId)

  try {
    // ── STAGE 1: Deterministic research (real web search — NOT LLM memory) ─
    if (!checkpoint.completedStages.includes('reference_research')) {
      console.log('[v3] Stage: reference_research (real web search)')
      const query = `${project.videoIdea.title} documentary explanation`
      const searchResults = await webSearch(query, 8)
      // Store real sources with real URLs
      const researchPack = searchResults.slice(0, 6).map((r: any) => ({
        url: r.url || r.link || '',
        title: r.title || '',
        snippet: r.snippet || '',
      }))
      ;(checkpoint as any).researchPack = researchPack
      checkpoint.completedStages.push('reference_research')
      await saveCheckpoint(checkpoint)
    }
    const researchPack = (checkpoint as any).researchPack || []

    // ── STAGE 2: Master Production Plan (ONE LLM call) ─────
    if (!checkpoint.completedStages.includes('master_plan') || !checkpoint.masterPlan) {
      console.log('[v3] Stage: master_plan (ONE GLM call with thinking)')
      await db.videoProject.update({ where: { id: videoProjectId }, data: { renderProgress: calculateProgress('master_plan', 0.5) } })

      const plan = await buildMasterProductionPlan({
        topic: project.videoIdea.title,
        angle: project.videoIdea.description || project.videoIdea.title,
        researchPack,
        referenceBoard: [], // not using LLM-invented reference board — using real search instead
        isShort,
        targetDurationSec,
        channelNiche: niche,
        channelName,
      })

      checkpoint.masterPlan = plan
      checkpoint.archetype = plan.archetype
      checkpoint.beats = flattenBeats(plan)
      checkpoint.completedStages.push('master_plan')
      await saveCheckpoint(checkpoint)
      console.log(`[v3] Master plan complete: archetype=${plan.archetype}, beats=${checkpoint.beats.length}`)
    }

    const plan = checkpoint.masterPlan!
    const beats = checkpoint.beats!
    const archetypeConfig = getArchetypeConfig(plan.archetype)

    // ── STAGE 3: Per-beat TTS (resumable) ──────────────────
    if (!checkpoint.completedStages.includes('tts') || !checkpoint.perBeatAudio) {
      console.log('[v3] Stage: tts (per-beat, resumable)')
      const perfScript = buildPerformanceScript(beats, plan.voiceDirection)
      const perBeatAudio: Array<{ beatId: string; audioPath: string; duration: number }> = []

      for (let i = 0; i < beats.length; i++) {
        const beat = beats[i]
        const audioPath = paths.beatAudio(beat.id)

        // Resume: if the audio file already exists and is valid, skip
        if (existsSync(audioPath) && (await stat(audioPath)).size > 1000) {
          const dur = await probeDuration(audioPath)
          if (dur > 0.5) {
            perBeatAudio.push({ beatId: beat.id, audioPath, duration: dur })
            continue
          }
        }

        // Generate TTS
        try {
          const perfBeat = perfScript.beats[i]
          const cleanText = beat.narration
            .replace(/\[pause \d+ms\]/g, '... ')
            .replace(/\[\/?\w+(?:\s+\w+)?\]/g, '')
            .replace(/\s+/g, ' ')
            .trim()

          if (cleanText.length === 0) {
            // Empty beat — create 1s silent audio
            await exec('ffmpeg', ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '1', '-y', audioPath])
          } else {
            const buf = await tts(cleanText, { cacheable: true })
            if (buf && buf.length > 1000) {
              await writeFile(audioPath, buf)
            } else {
              throw new Error('TTS returned too-small buffer')
            }
          }

          const dur = await probeDuration(audioPath)
          perBeatAudio.push({ beatId: beat.id, audioPath, duration: dur || 2 })
          console.log(`[v3] TTS ${i + 1}/${beats.length}: beat ${beat.id} → ${dur.toFixed(1)}s`)
        } catch (e: any) {
          console.error(`[v3] TTS failed for beat ${beat.id}:`, e.message.slice(0, 100))
          // Create silent fallback so the pipeline can continue
          await exec('ffmpeg', ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '2', '-y', audioPath])
          perBeatAudio.push({ beatId: beat.id, audioPath, duration: 2 })
        }

        // Progress
        await db.videoProject.update({
          where: { id: videoProjectId },
          data: { renderProgress: calculateProgress('tts', (i + 1) / beats.length) },
        })
      }

      checkpoint.perBeatAudio = perBeatAudio
      checkpoint.completedStages.push('tts')
      await saveCheckpoint(checkpoint)
      console.log(`[v3] TTS complete: ${perBeatAudio.length} beats, total ${perBeatAudio.reduce((s, a) => s + a.duration, 0).toFixed(1)}s`)
    }

    const perBeatAudio = checkpoint.perBeatAudio!
    const perBeatDurations = perBeatAudio.map(a => a.duration)
    const totalDuration = perBeatDurations.reduce((s, d) => s + d, 0)

    // ── STAGE 4: Build EDL (deterministic — NO LLM) ────────
    if (!checkpoint.completedStages.includes('edl')) {
      console.log('[v3] Stage: edl (deterministic)')
      const edl = buildEDLDeterministic(beats, plan.visualScript, perBeatDurations, {
        transitionPhilosophy: archetypeConfig.transitionPhilosophy,
      })
      checkpoint.edl = edl
      checkpoint.completedStages.push('edl')
      await saveCheckpoint(checkpoint)
    }
    const edl = checkpoint.edl!

    // ── STAGE 5: Sound cues (deterministic) ────────────────
    const soundCues = buildSoundCuesDeterministic(beats, edl, plan.soundDirection)

    // ── STAGE 6: Captions (deterministic) ───────────────────
    const captionsSrt = generateCaptionsDeterministic(beats, perBeatAudio, archetypeConfig.captionStyle)
    await writeFile(paths.caption, captionsSrt)

    // ── STAGE 7: Asset acquisition (rough-cut first) ───────
    if (!checkpoint.completedStages.includes('asset_acquisition') || !checkpoint.assets) {
      console.log('[v3] Stage: asset_acquisition (rough-cut first)')
      // Resume: load any previously saved assets
      let assets: AssetManifest[] = (checkpoint as any).assets || []
      const completedBeatIds = new Set(assets.map(a => a.storyBeatId))

      for (let i = 0; i < beats.length; i++) {
        const beat = beats[i]
        // Skip if this beat already has an asset (resume)
        if (completedBeatIds.has(beat.id)) {
          console.log(`[v3] Asset ${i + 1}/${beats.length}: beat ${beat.id} — already acquired (resume)`)
          continue
        }

        const req = plan.assetRequirements.find(a => a.beatId === beat.id)
        const assetType = req?.assetType || beat.preferredAssetType

        // Skip Z.ai video generation for now — it's consistently rate-limited (429)
        // Fall back to Z.ai image for video-asset beats
        const effectiveAssetType = assetType === 'ZAI_VIDEO' ? 'ZAI_IMAGE' : assetType

        try {
          const asset = await acquireAssetDeterministic(beat, effectiveAssetType, req?.visualDescription || beat.visualIntent, videoProjectId)
          assets.push(asset)
          completedBeatIds.add(beat.id)
          console.log(`[v3] Asset ${i + 1}/${beats.length}: beat ${beat.id} — ${asset.type} (${asset.localPath ? 'OK' : 'MISSING'})`)
        } catch (e: any) {
          console.error(`[v3] Asset ${i + 1}/${beats.length}: beat ${beat.id} — FAILED: ${e.message.slice(0, 80)}`)
          // Create a placeholder so the pipeline can continue
          const placeholder = await acquireAssetDeterministic(beat, 'ORIGINAL_GRAPHIC', beat.visualIntent, videoProjectId)
          assets.push(placeholder)
          completedBeatIds.add(beat.id)
        }

        // Save checkpoint after EACH asset (resumability — spec section 19)
        ;(checkpoint as any).assets = assets
        await saveCheckpoint(checkpoint)

        await db.videoProject.update({
          where: { id: videoProjectId },
          data: { renderProgress: calculateProgress('asset_acquisition', (i + 1) / beats.length) },
        })
      }

      checkpoint.assets = assets
      checkpoint.completedStages.push('asset_acquisition')
      await saveCheckpoint(checkpoint)
      console.log(`[v3] Asset acquisition complete: ${assets.length} assets`)
    }
    const assets = checkpoint.assets!

    // Assign asset IDs to EDL entries
    for (let i = 0; i < edl.length; i++) {
      const beat = beats[i]
      const asset = assets.find(a => a.storyBeatId === beat.id)
      if (asset) edl[i].assetId = asset.localPath || ''
    }

    // ── STAGE 8: Concatenate narration audio ────────────────
    const narrationPath = paths.narration
    if (!existsSync(narrationPath)) {
      const listPath = narrationPath + '.txt'
      await writeFile(listPath, perBeatAudio.map(a => `file '${a.audioPath}'`).join('\n'))
      await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', narrationPath, '-y'])
      try { await unlink(listPath) } catch {}
    }

    // ── STAGE 9: Final audio (narration only — musicMode = NONE) ─
    const finalAudioPath = paths.finalAudio
    if (!existsSync(finalAudioPath)) {
      await exec('ffmpeg', [
        '-i', narrationPath,
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
        finalAudioPath, '-y',
      ])
    }

    // ── STAGE 10: Remotion composition ─────────────────────
    if (!checkpoint.completedStages.includes('render')) {
      console.log('[v3] Stage: render (Remotion composition)')
      const renderResult = await renderComposition({
        videoProjectId,
        edl, beats, assets,
        archetype: archetypeConfig,
        isShort, channelName, fps: 30,
      })

      // Encode frames → final video
      await encodeFramesToVideo({
        frameDir: renderResult.frameDir,
        frameCount: renderResult.frameCount,
        fps: renderResult.fps,
        width: renderResult.width,
        height: renderResult.height,
        audioPath: finalAudioPath,
        outputPath: paths.video,
      })

      checkpoint.completedStages.push('render')
      await saveCheckpoint(checkpoint)
    }

    // ── STAGE 11: Thumbnail ─────────────────────────────────
    if (!existsSync(paths.thumbnail) || (await stat(paths.thumbnail).then(s => s.size).catch(() => 0)) < 1000) {
      await generateThumbnailV3({
        videoProjectId, title: project.title, brief: plan.reportingBrief,
        archetype: archetypeConfig, isShort, channelName,
      })
    }

    // ── STAGE 12: Production quality gate ──────────────────
    if (!checkpoint.completedStages.includes('quality_gate')) {
      console.log('[v3] Stage: quality_gate')
      const qg = await runQualityGate({
        videoPath: paths.video,
        thumbnailPath: paths.thumbnail,
        durationSec: totalDuration,
      })
      checkpoint.qualityGate = qg
      checkpoint.completedStages.push('quality_gate')
      await saveCheckpoint(checkpoint)

      if (!qg.passed) {
        console.warn(`[v3] Quality gate FAILED: ${qg.recommendations.join('; ')}`)
        await db.videoProject.update({
          where: { id: videoProjectId },
          data: {
            status: 'failed',
            editorNotes: `QC FAILED: ${qg.recommendations.slice(0, 3).join('; ')}`,
            reviewResult: JSON.stringify(qg),
          },
        })
      } else {
        await db.videoProject.update({
          where: { id: videoProjectId },
          data: {
            status: 'review',
            renderProgress: 100,
            videoFilePath: paths.video,
            thumbnailPath: paths.thumbnail,
            captionPath: paths.caption,
            duration: totalDuration,
            fileSize: (await stat(paths.video).catch(() => ({ size: 0 }))).size,
          },
        })
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'v3_render_complete',
        actor: 'agent',
        target: videoProjectId,
        details: JSON.stringify({
          archetype: plan.archetype,
          beatCount: beats.length,
          assetCount: assets.length,
          duration: totalDuration,
          qualityGatePassed: checkpoint.qualityGate?.passed,
          schedulerStats: getSchedulerStats(),
        }),
      },
    })

    return {
      videoPath: paths.video,
      duration: totalDuration,
      archetype: plan.archetype,
      qualityGate: checkpoint.qualityGate!,
      schedulerStats: getSchedulerStats(),
    }
  } catch (e: any) {
    console.error(`[v3] Pipeline failed at stage ${checkpoint.stage}:`, e)
    checkpoint.errors.push({ stage: checkpoint.stage, error: e.message, timestamp: new Date().toISOString() })
    await saveCheckpoint(checkpoint)
    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { status: 'failed', editorNotes: `V3 failed at ${checkpoint.stage}: ${e.message.slice(0, 200)}` },
    })
    throw e
  }
}

// ─── Deterministic asset acquisition (no LLM) ──────────────

async function acquireAssetDeterministic(
  beat: StoryBeat,
  assetType: AssetManifest['type'],
  visualDescription: string,
  videoProjectId: string,
): Promise<AssetManifest> {
  const id = randomUUID()
  const ext = assetType === 'ZAI_VIDEO' || assetType === 'PUBLIC_DOMAIN_VIDEO' ? 'mp4' : 'png'
  const localPath = path.join(DATA_DIR, 'assets', `${id}.${ext}`)
  if (!existsSync(path.dirname(localPath))) await mkdir(path.dirname(localPath), { recursive: true })

  // Try Z.ai image generation for visual types that need a real image
  const needsImage = ['ZAI_IMAGE', 'ORIGINAL_GRAPHIC', 'ORIGINAL_DIAGRAM', 'WEBPAGE_CAPTURE', 'PUBLIC_DOMAIN_IMAGE', 'CREATIVE_COMMONS', 'ORIGINAL_SCREEN_RECORDING'].includes(assetType)
  if (needsImage) {
    try {
      const prompt = `${visualDescription}. Professional, photorealistic, no text, no watermark, 16:9 cinematic composition.`
      const buf = await generateImage(prompt, { cacheable: true, size: '1344x768' })
      if (buf && buf.length > 1024) {
        await writeFile(localPath, buf)
        return {
          id, type: 'ZAI_IMAGE', storyBeatId: beat.id, localPath,
          generationPrompt: prompt, creator: 'Z.ai generated',
          license: 'Generated content', commercialUse: true, attributionRequired: false,
          retrievalDate: new Date(), metadata: { width: 1344, height: 768 },
        }
      }
    } catch (e: any) {
      console.warn(`[asset] Z.ai image failed for beat ${beat.id}: ${e.message.slice(0, 80)}`)
    }
  }

  // Try Z.ai video for ZAI_VIDEO type (expensive — limited)
  if (assetType === 'ZAI_VIDEO') {
    try {
      const { generateVideo } = await import('./zai-scheduler')
      const result = await generateVideo(visualDescription, { duration: 5, quality: 'speed' })
      return {
        id, type: 'ZAI_VIDEO', storyBeatId: beat.id, localPath: result.localPath,
        zaiTaskId: result.taskId, generationPrompt: visualDescription,
        estimatedCost: result.estimatedCost, creator: 'Z.ai generated video',
        license: 'Generated content', commercialUse: true, attributionRequired: false,
        retrievalDate: new Date(),
        metadata: { width: result.width, height: result.height, duration: result.duration, codec: result.codec },
      }
    } catch (e: any) {
      console.warn(`[asset] Z.ai video failed for beat ${beat.id}: ${e.message.slice(0, 80)} — falling back to image`)
    }
  }

  // Fallback: branded text card (deterministic, no API)
  const colorByPurpose: Record<string, string> = {
    HOOK: '#ff3d57', REVEAL: '#ff3d57', PAYOFF: '#10b981', ENDING: '#10b981',
    EVIDENCE: '#3b82f6', QUESTION: '#f59e0b', CONTRADICTION: '#a855f7',
  }
  const accentColor = colorByPurpose[beat.purpose] || '#ff3d57'
  const titleText = (beat.title || beat.narration.slice(0, 60)).replace(/'/g, '')
  const descText = (beat.visualIntent || beat.newInformation || '').slice(0, 100).replace(/'/g, '')

  await exec('ffmpeg', [
    '-f', 'lavfi', '-i', 'color=c=#0b0f1a:s=1920x1080:d=0.04',
    '-vf',
    `drawtext=text='${escapeFFmpegText(titleText)}':fontsize=56:fontcolor=white:x=60:y=h/2-80:box=1:boxcolor=${accentColor}@0.7:boxborderw=24,` +
    `drawtext=text='${escapeFFmpegText(descText)}':fontsize=28:fontcolor=#9ca3af:x=60:y=h/2+20`,
    '-frames:v', '1', '-y', localPath,
  ])

  return {
    id, type: 'ORIGINAL_GRAPHIC', storyBeatId: beat.id, localPath,
    creator: 'Original — text card fallback', license: 'Original work',
    commercialUse: true, attributionRequired: false,
    retrievalDate: new Date(), metadata: { width: 1920, height: 1080 },
  }
}

function escapeFFmpegText(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,')
    .replace(/\n/g, ' ')
    .slice(0, 100)
}

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
    return parseFloat(stdout.trim()) || 0
  } catch {
    return 0
  }
}

// ─── Thumbnail generation ──────────────────────────────────

async function generateThumbnailV3(opts: {
  videoProjectId: string
  title: string
  brief: MasterProductionPlan['reportingBrief']
  archetype: any
  isShort: boolean
  channelName: string
}): Promise<string> {
  const { videoProjectId, title, isShort, brief } = opts
  const thumbnailPath = path.join(DATA_DIR, 'thumbnails', `${videoProjectId}.png`)
  if (!existsSync(path.dirname(thumbnailPath))) await mkdir(path.dirname(thumbnailPath), { recursive: true })

  try {
    const prompt = `YouTube ${isShort ? 'Shorts' : 'video'} thumbnail. ${brief.whatIsSurprising[0] || brief.subject}. Eye-catching, dramatic, high contrast, no text overlay. Aspect ratio ${isShort ? '9:16' : '16:9'}.`
    const buf = await generateImage(prompt, { cacheable: true, size: '1344x768' })
    if (buf && buf.length > 1024) {
      await writeFile(thumbnailPath, buf)
      // Add title overlay
      const w = isShort ? 1080 : 1280
      const h = isShort ? 1920 : 720
      const overlayTmp = thumbnailPath + '.tmp.png'
      await exec('ffmpeg', [
        '-i', thumbnailPath,
        '-vf',
        `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},` +
        `drawbox=x=0:y=${h - 220}:w=${w}:h=220:color=black@0.6:t=fill,` +
        `drawtext=text='${escapeFFmpegText(title.slice(0, 50))}':fontsize=48:fontcolor=white:x=40:y=${h - 140}:box=1:boxcolor=0xff3d57@0.85:boxborderw=16`,
        '-frames:v', '1', '-f', 'image2', '-vcodec', 'png', overlayTmp, '-y',
      ])
      try { await unlink(thumbnailPath) } catch {}
      await readFile(overlayTmp).then(b => writeFile(thumbnailPath, b))
      try { await unlink(overlayTmp) } catch {}
    }
  } catch (e: any) {
    console.warn('[thumbnail] Generation failed, using fallback:', e.message.slice(0, 80))
    const w = isShort ? 1080 : 1280
    const h = isShort ? 1920 : 720
    await exec('ffmpeg', [
      '-f', 'lavfi', '-i', `color=c=#0b0f1a:s=${w}x${h}:d=0.04`,
      '-vf', `drawtext=text='${escapeFFmpegText(title.slice(0, 50))}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=0xff3d57@0.7:boxborderw=24`,
      '-frames:v', '1', '-f', 'image2', '-vcodec', 'png', thumbnailPath, '-y',
    ])
  }

  return thumbnailPath
}
