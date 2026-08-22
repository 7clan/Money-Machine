/**
 * Creative Director (Phase 2) — orchestrates the full V3 pipeline.
 *
 * Pipeline:
 *   TOPIC DISCOVERY → REFERENCE RESEARCH → ANGLE DISCOVERY → FORMAT SELECTION →
 *   REPORTING BRIEF → RESEARCH PACK → STORY ARCHITECTURE → VISUAL SCRIPT →
 *   PAPER EDIT → ROUGH CUT → CRITIQUE → ASSET PLAN → ASSET ACQUISITION →
 *   EDIT DECISION LIST → FINE CUT → SOUND DESIGN → QUALITY REVIEW →
 *   THUMBNAIL/TITLE → PRIVATE OUTPUT → PUBLISH → ANALYTICS → LEARN
 *
 * This module ties all the V3 engine modules together. Each stage produces a
 * concrete artifact that drives the next stage.
 */

import { db } from '@/lib/db'
import { routeArchetype, getArchetypeConfig } from './archetypes'
import { runIdeaFunnel, buildReportingBrief, buildReferenceBoard } from './reporting-brief'
import { buildStoryArchitecture, buildVisualScript } from './story-engine'
import { acquireAssets } from './asset-sourcing'
import { buildEditDecisionList, buildPerformanceScript, buildSoundDesign, generateNarrationAudio, getBeatDurations } from './edit-and-sound'
import { renderFromEDL } from './renderer-v3'
import { computeSlopScore, inspectRenderedVideo } from './quality-critic'
import { buildTitleEngine } from './title-engine'
import { buildThumbnailConcepts } from './thumbnail-engine'
import { generateCaptionsV3 } from './captions'
import type {
  Archetype, ArchetypeConfig, PipelineRunState, ReportingBrief,
  StoryBeat, VisualScriptEntry, AssetManifest, EditDecision,
  SoundCue, PerformanceScript, SlopScore, QualityCriticReport,
  TitleCandidate, ThumbnailConcept,
} from './types'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const PIPELINE_STATE_DIR = path.join(DATA_DIR, 'pipeline-state')

/**
 * Run the full V3 pipeline for a single video project.
 * Replaces the old "phase5_produceVideo" function in agent.ts.
 */
export async function produceVideoV3(
  videoProjectId: string,
  options: {
    /** Skip the critique + re-edit loop (first pass only). Default: false */
    skipCritique?: boolean
    /** Force a specific archetype (skip routing). Default: undefined */
    forcedArchetype?: Archetype
    /** Enable Z.ai video generation (cost-sensitive). Default: true */
    enableVideoGeneration?: boolean
    /** Max Z.ai video clips per video. Default: 3 */
    maxVideoClips?: number
  } = {},
): Promise<{
  videoPath: string
  duration: number
  archetype: Archetype
  slopScore: SlopScore
  criticReport: QualityCriticReport
}> {
  const { skipCritique = false, forcedArchetype, enableVideoGeneration = true, maxVideoClips = 3 } = options

  // ── Load project + idea ────────────────────────────────────
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
  if (!project.videoIdea.scripts.length) throw new Error('No script found for this video')

  const script = project.videoIdea.scripts[0]
  const isShort = project.videoIdea.type === 'short'
  // Reduced from 360 to 120 for TEST A — fewer beats = smaller LLM prompts = less rate limiting
  const targetDurationSec = isShort ? 45 : 120 // 45s for shorts, 2min for longform (TEST scope)

  // Load channel context
  const nicheState = await db.agentState.findUnique({ where: { key: 'selected_niche' } })
  const channelState = await db.agentState.findUnique({ where: { key: 'channel_strategy' } })
  const niche = nicheState ? JSON.parse(nicheState.value).nicheName : 'Technology'
  const channelName = channelState ? (JSON.parse(channelState.value).channelName || 'Money Machine') : 'Money Machine'

  // ── Initialize pipeline state ──────────────────────────────
  await db.videoProject.update({
    where: { id: videoProjectId },
    data: { status: 'editing', renderProgress: 2 },
  })

  const runState: PipelineRunState = {
    videoProjectId,
    archetype: forcedArchetype || 'DOCUMENTARY',
    stage: 'reporting_brief',
    startedAt: new Date(),
    completedStages: [],
    errors: [],
  }

  try {
    // ── STAGE: Reporting Brief (Phase 6) ─────────────────────
    console.log(`[v3] Stage: reporting_brief for "${project.title}"`)
    // Build a brief from the existing VideoIdea (the idea was already selected via the funnel)
    const candidate = {
      id: project.videoIdeaId,
      subject: project.title.split(/[:|–-]/)[0].trim(),
      angle: project.title,
      scores: {} as any,
      compositeScore: project.videoIdea.compositeScore || 60,
      stage: 'production_candidate' as const,
    }
    const brief = await buildReportingBrief(candidate, niche)
    runState.brief = brief
    runState.completedStages.push('reporting_brief')

    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { renderProgress: 10 },
    })

    // ── STAGE: Format Selection (Phase 3) ────────────────────
    const archetype = forcedArchetype || routeArchetype(brief, isShort)
    const archetypeConfig = getArchetypeConfig(archetype)
    runState.archetype = archetype
    console.log(`[v3] Selected archetype: ${archetype} (${archetypeConfig.format})`)

    // ── STAGE: Reference Board (Phase 9) ─────────────────────
    console.log(`[v3] Stage: reference_research`)
    const referenceBoard = await buildReferenceBoard(brief)
    runState.referenceBoard = referenceBoard
    runState.completedStages.push('reference_research')

    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { renderProgress: 15 },
    })

    // ── STAGE: Story Architecture (Phase 12) ─────────────────
    console.log(`[v3] Stage: story_architecture`)
    const beats = await buildStoryArchitecture(brief, archetypeConfig, targetDurationSec)
    runState.beats = beats
    runState.completedStages.push('story_architecture')

    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { renderProgress: 25 },
    })

    // ── STAGE: Visual Script (Phase 13) ─────────────────────
    console.log(`[v3] Stage: visual_script`)
    const visualScript = await buildVisualScript(beats, brief, archetypeConfig)
    runState.visualScript = visualScript
    runState.completedStages.push('visual_script')

    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { renderProgress: 30 },
    })

    // ── STAGE: Performance Script + TTS (Phase 26) ──────────
    console.log(`[v3] Stage: performance_script`)
    const perfScript = await buildPerformanceScript(beats, archetypeConfig)
    runState.performanceScript = perfScript
    runState.completedStages.push('paper_edit') // paper_edit = the script is locked

    // Generate TTS audio per beat — this gives us REAL durations to drive the rest of the pipeline
    const perBeatAudio = await generateNarrationAudio(script.id, perfScript)
    const perBeatDurations = perBeatAudio.map(a => a.duration)

    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { renderProgress: 40 },
    })

    // ── STAGE: Asset Plan + Acquisition (Phase 15-17) ────────
    console.log(`[v3] Stage: asset_acquisition`)
    const assets = await acquireAssets(beats, visualScript, brief, {
      enableVideoGeneration,
      maxVideoClips,
    })
    runState.assets = assets
    runState.completedStages.push('asset_acquisition')

    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { renderProgress: 55 },
    })

    // ── STAGE: Edit Decision List (Phase 21) ─────────────────
    console.log(`[v3] Stage: edit_decision_list`)
    const edl = await buildEditDecisionList(beats, visualScript, assets, archetypeConfig, perBeatDurations)
    runState.edl = edl
    runState.completedStages.push('edit_decision_list')

    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { renderProgress: 60 },
    })

    // ── STAGE: Sound Design (Phase 25) ───────────────────────
    console.log(`[v3] Stage: sound_design`)
    const totalDuration = perBeatDurations.reduce((s, d) => s + d, 0)
    const { cues: soundCues, musicBedPath } = await buildSoundDesign(beats, edl, archetypeConfig, totalDuration)
    runState.soundCues = soundCues
    runState.completedStages.push('sound_design')

    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { renderProgress: 65 },
    })

    // ── STAGE: Captions (Phase 31 — selective for longform, burned for shorts) ─
    const captionPath = path.join(DATA_DIR, 'videos', `${videoProjectId}.srt`)
    await generateCaptionsV3(beats, perBeatAudio, captionPath, archetypeConfig.captionStyle)

    // ── STAGE: Fine Cut / Render (Phase 20) ──────────────────
    console.log(`[v3] Stage: fine_cut (rendering)`)
    const renderResult = await renderFromEDL({
      videoProjectId,
      edl, beats, assets, perBeatAudio,
      musicBedPath, soundCues,
      archetype: archetypeConfig, brief,
      isShort, title: project.title, channelName,
      captionPath,
    })
    runState.completedStages.push('fine_cut')

    await db.videoProject.update({
      where: { id: videoProjectId },
      data: { renderProgress: 92 },
    })

    // ── STAGE: Title + Thumbnail (Phase 34-35) ───────────────
    console.log(`[v3] Stage: thumbnail_title`)
    const titleCandidates = await buildTitleEngine(brief, archetypeConfig, project.title)
    runState.titleCandidates = titleCandidates
    const thumbnailConcepts = await buildThumbnailConcepts(brief, archetypeConfig, isShort)
    runState.thumbnailConcepts = thumbnailConcepts
    runState.completedStages.push('thumbnail_title')

    // ── STAGE: Quality Review (Phase 37-38) ──────────────────
    console.log(`[v3] Stage: quality_review`)
    const criticReport = await inspectRenderedVideo({
      videoPath: renderResult.videoPath,
      edl, beats, assets,
      archetype: archetypeConfig, brief,
      title: titleCandidates[0]?.title || project.title,
    })
    runState.criticReport = criticReport
    runState.slopScore = criticReport.slopScore
    runState.completedStages.push('quality_review')

    // Persist run state to disk for inspection
    await persistRunState(runState)

    // Update VideoProject status — if critic FAILED, mark as failed for re-edit
    if (!criticReport.passed && !skipCritique) {
      console.warn(`[v3] Quality critic FAILED (score ${criticReport.overallScore}, slop ${criticReport.slopScore.total}). Marking for re-edit.`)
      await db.videoProject.update({
        where: { id: videoProjectId },
        data: {
          status: 'failed',
          reviewResult: JSON.stringify({
            overallScore: criticReport.overallScore,
            slopScore: criticReport.slopScore.total,
            recommendations: criticReport.recommendations,
          }),
          editorNotes: `V3 critic FAILED: ${criticReport.recommendations.slice(0, 3).join('; ')}`,
        },
      })
    } else {
      await db.videoProject.update({
        where: { id: videoProjectId },
        data: {
          status: 'review',
          renderProgress: 100,
          reviewResult: JSON.stringify({
            overallScore: criticReport.overallScore,
            slopScore: criticReport.slopScore.total,
            passed: criticReport.passed,
          }),
        },
      })
    }

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'v3_render_complete',
        actor: 'agent',
        target: videoProjectId,
        details: JSON.stringify({
          archetype,
          beatCount: beats.length,
          assetCount: assets.length,
          aiVideoClips: assets.filter(a => a.type === 'ZAI_VIDEO').length,
          slopScore: criticReport.slopScore.total,
          overallScore: criticReport.overallScore,
          passed: criticReport.passed,
        }),
      },
    })

    return {
      videoPath: renderResult.videoPath,
      duration: renderResult.duration,
      archetype,
      slopScore: criticReport.slopScore,
      criticReport,
    }
  } catch (e: any) {
    console.error(`[v3] Pipeline failed at stage ${runState.stage}:`, e)
    runState.errors.push({ stage: runState.stage, error: e.message, timestamp: new Date() })
    await persistRunState(runState)
    await db.videoProject.update({
      where: { id: videoProjectId },
      data: {
        status: 'failed',
        editorNotes: `V3 pipeline failed at ${runState.stage}: ${e.message.slice(0, 200)}`,
      },
    })
    throw e
  }
}

async function persistRunState(state: PipelineRunState): Promise<void> {
  if (!existsSync(PIPELINE_STATE_DIR)) await mkdir(PIPELINE_STATE_DIR, { recursive: true })
  const statePath = path.join(PIPELINE_STATE_DIR, `${state.videoProjectId}.json`)
  // Strip circular references / non-serializable
  const safe = JSON.parse(JSON.stringify(state, (k, v) => {
    if (v instanceof Date) return v.toISOString()
    return v
  }))
  await writeFile(statePath, JSON.stringify(safe, null, 2))
}

// ─── Trigger a fresh V3 idea → video production ─────────────

/**
 * Generate a new idea via the funnel, create a VideoProject, run the V3 pipeline.
 * Used by the "Generate More" button.
 */
export async function generateIdeaViaFunnel(channelNiche?: string): Promise<string> {
  const nicheState = await db.agentState.findUnique({ where: { key: 'selected_niche' } })
  const niche = channelNiche || (nicheState ? JSON.parse(nicheState.value).nicheName : 'Technology')
  const channelState = await db.agentState.findUnique({ where: { key: 'channel_strategy' } })
  const channelName = channelState ? (JSON.parse(channelState.value).channelName || 'Money Machine') : 'Money Machine'

  console.log(`[v3] Running idea funnel for niche "${niche}"`)
  const candidates = await runIdeaFunnel(niche, channelName, 100)
  if (candidates.length === 0) {
    throw new Error('Idea funnel produced no production candidates')
  }
  const candidate = candidates[0]
  console.log(`[v3] Top candidate: ${candidate.subject} — ${candidate.angle} (score ${candidate.compositeScore})`)

  // Create VideoIdea
  const idea = await db.videoIdea.create({
    data: {
      title: candidate.angle.slice(0, 200),
      description: `${candidate.subject} — ${candidate.angle}`,
      type: 'longform', // default to longform; shorts funnel can be added later
      status: 'idea',
      compositeScore: candidate.compositeScore,
      tags: JSON.stringify([candidate.subject]),
    },
  })

  return idea.id
}
