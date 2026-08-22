/**
 * Deterministic Code Layer (Phase: spec section 6)
 *
 * Derives everything from the MasterProductionPlan that should NOT come from the LLM:
 *   - EDL timing (from actual TTS durations)
 *   - Audio duration mapping
 *   - Caption timestamps
 *   - Asset IDs + file paths
 *   - Transition assignments (archetype-driven, not LLM)
 *   - Render jobs
 *   - Cost accounting
 *   - Scene numbering
 *   - Progress values
 *   - Technical metadata
 *
 * The LLM decides CREATIVE INTENT.
 * This module IMPLEMENTS it deterministically.
 */

import type {
  MasterProductionPlan,
  StoryBeat, EditDecision, SoundCue, PerformanceScript,
} from './types'
import { randomUUID } from 'crypto'
import path from 'path'

/**
 * Build the full StoryBeats list from the MasterPlan's story.hook + beats + payoff.
 * Assigns sequential IDs and order.
 */
export function flattenBeats(plan: MasterProductionPlan): StoryBeat[] {
  const all = [...plan.story.hook, ...plan.story.beats, ...plan.story.payoff]
  return all.map((b, i) => ({
    ...b,
    id: b.id || `beat_${i + 1}`,
    order: i + 1,
  }))
}

/**
 * Build the PerformanceScript from the MasterPlan's voiceDirection.
 * Maps beat IDs to speed/emotion/instruction.
 */
export function buildPerformanceScript(
  beats: StoryBeat[],
  voiceDirection: MasterProductionPlan['voiceDirection'],
): PerformanceScript {
  const directionByBeatId = new Map(voiceDirection.map(v => [v.beatId, v]))
  return {
    beats: beats.map(b => {
      const d = directionByBeatId.get(b.id)
      return {
        beatId: b.id,
        text: b.narration,
        instructions: [], // parsed from instruction string if needed
        speed: d?.speed ?? 1.0,
        emotion: d?.emotion || 'neutral',
      }
    }),
  }
}

/**
 * Build the EditDecisionList from per-beat audio durations.
 * This is the DETERMINISTIC version — NO LLM call.
 *
 * Each EDL entry gets:
 *   - start/end times (cumulative from actual TTS durations)
 *   - assetId (assigned later by asset sourcer)
 *   - movement (archetype-driven rotation, NOT Ken Burns everywhere)
 *   - transitionIn/Out (archetype-driven)
 *   - visualPurpose (from the plan's visualScript)
 *   - reason (from the plan's visualScript.purpose — the LLM already provided it)
 */
export function buildEDLDeterministic(
  beats: StoryBeat[],
  visualScript: MasterProductionPlan['visualScript'],
  perBeatDurationsSec: number[],
  options: {
    transitionPhilosophy: 'hard_cut' | 'crossfade' | 'match_cut' | 'mixed'
  },
): EditDecision[] {
  const vsByBeatId = new Map(visualScript.map(v => [v.beatId, v]))

  // Movement rotation per archetype philosophy (Phase 23 — NOT Ken Burns everywhere)
  const movementPool = {
    hard_cut: ['static', 'pan_right', 'static', 'pan_left', 'static', 'zoom_in'],
    crossfade: ['ken_burns_in', 'static', 'ken_burns_out', 'static', 'pan_right'],
    match_cut: ['static', 'pan_left', 'static', 'pan_right'],
    mixed: ['ken_burns_in', 'pan_right', 'static', 'ken_burns_out', 'pan_left', 'static'],
  }
  const pool = movementPool[options.transitionPhilosophy] || movementPool.mixed

  const edl: EditDecision[] = []
  let cursor = 0

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i]
    const vs = vsByBeatId.get(beat.id)
    const dur = perBeatDurationsSec[i] || 4

    // Transition: first beat fades in, last fades out, middle uses archetype philosophy
    let transitionIn = 'hard_cut'
    let transitionOut = 'hard_cut'
    if (i === 0) {
      transitionIn = 'fade_in'
      transitionOut = options.transitionPhilosophy === 'hard_cut' ? 'hard_cut' : 'crossfade'
    } else if (i === beats.length - 1) {
      transitionIn = options.transitionPhilosophy === 'hard_cut' ? 'hard_cut' : 'crossfade'
      transitionOut = 'fade_out'
    } else {
      transitionIn = options.transitionPhilosophy === 'hard_cut' ? 'hard_cut' : 'crossfade'
      transitionOut = options.transitionPhilosophy === 'hard_cut' ? 'hard_cut' : 'crossfade'
    }

    edl.push({
      id: `edl_${i + 1}`,
      start: cursor,
      end: cursor + dur,
      narrationText: beat.narration,
      assetId: '', // assigned by asset sourcer
      visualPurpose: vs?.purpose || beat.emotionalIntent,
      movement: pool[i % pool.length],
      overlay: beat.title || beat.narration.slice(0, 50),
      transitionIn,
      transitionOut,
      musicCue: vs?.sound,
      sfx: undefined,
      reason: vs?.purpose || `Illustrates: ${beat.visualIntent.slice(0, 80)}`,
    })

    cursor += dur
  }

  return edl
}

/**
 * Generate SRT captions aligned to actual per-beat audio durations.
 * This is DETERMINISTIC — no LLM call.
 *
 * Caption style:
 *   - longform: selective (only beats with numbers/names/dates/quotes)
 *   - short: burned-in (every phrase)
 */
export function generateCaptionsDeterministic(
  beats: StoryBeat[],
  perBeatAudio: Array<{ beatId: string; duration: number }>,
  captionStyle: 'none' | 'selective' | 'phrase' | 'burned_in',
): string {
  if (captionStyle === 'none') return ''

  let srt = ''
  let index = 1
  let cursor = 0

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i]
    const audio = perBeatAudio.find(a => a.beatId === beat.id)
    if (!audio || !beat.narration?.trim()) continue

    const sceneDuration = audio.duration
    const words = beat.narration.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    const shouldCaption = captionStyle === 'phrase' || captionStyle === 'burned_in' ||
      (captionStyle === 'selective' && hasCaptionableElement(beat))

    if (shouldCaption) {
      const chunkSize = captionStyle === 'burned_in' ? 5 : 7
      const totalChars = words.reduce((s, w) => s + w.length, 0) + words.length
      const charPerSec = totalChars / sceneDuration
      let lineStart = cursor
      let line = ''
      let lineWords = 0

      for (let j = 0; j < words.length; j++) {
        line += (line ? ' ' : '') + words[j]
        lineWords++
        if (lineWords >= chunkSize || j === words.length - 1) {
          const lineDuration = line.length / charPerSec
          const lineEnd = Math.min(lineStart + lineDuration, cursor + sceneDuration)
          srt += `${index}\n`
          srt += `${srtTs(lineStart)} --> ${srtTs(lineEnd)}\n`
          srt += `${line}\n\n`
          index++
          lineStart = lineEnd
          line = ''
          lineWords = 0
        }
      }
    }

    cursor += sceneDuration
  }

  return srt
}

function hasCaptionableElement(beat: StoryBeat): boolean {
  const text = beat.narration
  if (/\$\d|\d+%|\b(19|20)\d{2}\b|\b\d{2,}\b/.test(text)) return true
  if (/"[^"]+"|'[^']+'/.test(text)) return true
  if (['HOOK', 'REVEAL', 'PAYOFF', 'ENDING'].includes(beat.purpose)) return true
  return false
}

function srtTs(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

/**
 * Build SoundCues deterministically from the plan's soundDirection.
 */
export function buildSoundCuesDeterministic(
  beats: StoryBeat[],
  edl: EditDecision[],
  soundDirection: MasterProductionPlan['soundDirection'],
): SoundCue[] {
  const cues: SoundCue[] = []
  const directionByBeatId = new Map(soundDirection.map(s => [s.beatId, s]))

  for (let i = 0; i < edl.length; i++) {
    const decision = edl[i]
    const beat = beats[i]
    if (!beat) continue
    const dir = directionByBeatId.get(beat.id)
    if (dir) {
      cues.push({
        start: decision.start,
        end: decision.end,
        type: dir.type,
        label: dir.label,
        volume: dir.volume,
      })
    }
  }

  return cues
}

/**
 * Generate deterministic file paths for all pipeline outputs.
 */
export function generateFilePaths(videoProjectId: string) {
  const dataDir = path.join(process.cwd(), 'data')
  return {
    video: path.join(dataDir, 'videos', `${videoProjectId}.mp4`),
    rawVideo: path.join(dataDir, 'videos', `${videoProjectId}_raw.mp4`),
    thumbnail: path.join(dataDir, 'thumbnails', `${videoProjectId}.png`),
    caption: path.join(dataDir, 'videos', `${videoProjectId}.srt`),
    narration: path.join(dataDir, 'audio', `${videoProjectId}_narration.mp3`),
    finalAudio: path.join(dataDir, 'audio', `${videoProjectId}_final.aac`),
    musicBed: null as string | null, // musicMode = NONE per spec section 18
    pipelineState: path.join(dataDir, 'pipeline-state', `${videoProjectId}.json`),
    contactSheet: path.join(dataDir, 'contact-sheets', `${videoProjectId}.jpg`),
    beatAudio: (beatId: string) => path.join(dataDir, 'audio', `${videoProjectId}_${beatId}.mp3`),
    segment: (index: number) => path.join(dataDir, 'videos', `${videoProjectId}_seg_${index}.mp4`),
    overlaySvg: (index: number) => path.join(dataDir, 'frames', `overlay_${index}.svg`),
    overlayPng: (index: number) => path.join(dataDir, 'frames', `overlay_${index}.png`),
    asset: (assetId: string, ext: string) => path.join(dataDir, 'assets', `${assetId}.${ext}`),
  }
}

/**
 * Calculate progress values for a given stage (deterministic — no LLM).
 */
export function calculateProgress(stage: string, subProgress: number = 0): number {
  const stageProgress: Record<string, [number, number]> = {
    'master_plan':     [2, 10],
    'reference_research': [10, 15],
    'tts':             [15, 35],
    'asset_acquisition': [35, 60],
    'edl':             [60, 62],
    'sound_design':    [62, 65],
    'captions':        [65, 67],
    'render_segments': [67, 85],
    'render_concat':   [85, 90],
    'render_audio':    [90, 95],
    'render_mux':      [95, 98],
    'quality_gate':    [98, 100],
  }
  const [start, end] = stageProgress[stage] || [0, 100]
  return Math.round(start + (end - start) * subProgress)
}
