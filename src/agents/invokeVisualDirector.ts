#!/usr/bin/env tsx
/**
 * invokeVisualDirector — VISUAL_DIRECTOR subagent invocation
 *
 * Isolated agent process. Reads {script, format} from <chainDir>/input.json,
 * plans a VisualShot timeline via `z-ai chat`, then DETERMINISTICALLY
 * normalizes the timeline (contiguous, starts at 0, bounded by
 * script.targetDuration) and validates segment coverage. Writes VisualShot[]
 * to <chainDir>/output.json.
 *
 * Run: bunx tsx src/agents/invokeVisualDirector.ts
 */
import type { FormatSelection, Script, VisualShot } from './artifacts/schemas'
import { runAgent, zaiChatJson } from './subagentChain'

type Loose = Record<string, unknown>

const SHOT_TYPES = [
  'MOTION_GRAPHIC',
  'ANIMATED_VECTOR',
  'TEXT_CARD',
  'SCREEN_CAPTURE',
  'STOCK_BROLL',
  'GENERATED_IMAGE',
]

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function isShotsShape(v: unknown): boolean {
  return (
    Array.isArray(v) && v.length >= 4 && (v as Loose[]).every((s) => !!s && typeof (s as Loose).segmentId === 'string')
  )
}

/**
 * Deterministic timeline normalization: sort by intended start, force t=0
 * start, remove gaps/overlaps, clamp durations, then rescale the whole
 * timeline to the script's target duration.
 */
function normalizeTimeline(shots: VisualShot[], targetDuration: number): VisualShot[] {
  const sorted = [...shots].sort((a, b) => a.start - b.start)
  const clamped = sorted.map((s, i) => ({
    ...s,
    id: str(s.id, `shot-${i + 1}`) || `shot-${i + 1}`,
    duration: Math.max(1.5, Math.min(15, s.duration)),
  }))
  let t = 0
  const contiguous = clamped.map((s) => {
    const shot = { ...s, start: Math.round(t * 10) / 10, end: Math.round((t + s.duration) * 10) / 10 }
    t = shot.end
    return shot
  })
  const total = t > 0 ? t : 1
  const scale = targetDuration / total
  return contiguous.map((s, i) => {
    const start = Math.round(s.start * scale * 10) / 10
    const end = Math.round(s.end * scale * 10) / 10
    return { ...s, start, end, duration: Math.round((end - start) * 10) / 10, id: `shot-${i + 1}` }
  })
}

const SYSTEM =
  'You are VISUAL_DIRECTOR, an autonomous visual planning subagent inside a video production ' +
  'pipeline. You convert script segments into a second-accurate shot timeline. Mark honesty ' +
  'flags (isRawVideo/isScreenshot) truthfully — a static screenshot must NEVER claim to be a ' +
  'live UI capture. Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'VisualDirector',
  role: 'VISUAL_DIRECTOR',
  artifact: 'VisualShot[]',
  execute: (input) => {
    const script = (input as Loose).script as Script | undefined
    const format = (input as Loose).format as FormatSelection | undefined
    if (!script || !Array.isArray(script.segments)) {
      throw new Error('input.json must contain { "script": Script, "format": FormatSelection }')
    }
    const targetDuration =
      typeof script.targetDuration === 'number' && script.targetDuration >= 30
        ? script.targetDuration
        : 60

    const prompt =
      `SCRIPT (upstream artifact):\n${JSON.stringify(script, null, 1)}\n\n` +
      `FORMAT (upstream artifact):\n${JSON.stringify(format, null, 1)}\n\n` +
      `Plan the shot timeline as a JSON array. 1-2 shots per script segment, in script order, ` +
      `each shot 3-8 seconds, covering EVERY segment at least once. Each item:\n` +
      `- id: "shot-1", "shot-2", ...\n` +
      `- segmentId: the exact id of the script segment it visualizes\n` +
      `- start / end / duration: seconds (floats, contiguous, first shot starts at 0)\n` +
      `- type: one of [${SHOT_TYPES.join(', ')}]\n` +
      `- purpose: what this shot accomplishes\n` +
      `- animation: the motion that happens during the shot (never "none")\n` +
      `- isRawVideo: true ONLY if this is real filmed footage\n` +
      `- isScreenshot: true ONLY if this is a single static frame\n\n` +
      `Total timeline should sum to ~${targetDuration}s. Prefer motion over static frames. ` +
      `Reply with ONLY the JSON array.`

    const rawShots = zaiChatJson<unknown>({
      system: SYSTEM,
      prompt,
      tag: 'visual-shots',
      validate: isShotsShape,
      attempts: 3,
    })

    const segmentIds = new Set(script.segments.map((s) => s.id))
    const shots: VisualShot[] = (rawShots as Loose[]).map((raw, i) => {
      const s = (raw ?? {}) as Loose
      const start = Number(s.start)
      const end = Number(s.end)
      const duration =
        Number.isFinite(s.duration) && Number(s.duration) > 0
          ? Number(s.duration)
          : Number.isFinite(end) && Number.isFinite(start)
            ? Math.max(0, end - start)
            : 4
      const type = SHOT_TYPES.includes(str(s.type)) ? str(s.type) : 'MOTION_GRAPHIC'
      return {
        id: str(s.id, `shot-${i + 1}`),
        segmentId: str(s.segmentId, script.segments[Math.min(i, script.segments.length - 1)]?.id ?? 'seg-1'),
        start: Number.isFinite(start) ? start : i * 4,
        end: Number.isFinite(end) ? end : i * 4 + duration,
        duration,
        type,
        purpose: str(s.purpose, 'Visualize segment'),
        animation: str(s.animation, 'fade + slide'),
        isRawVideo: s.isRawVideo === true,
        isScreenshot: s.isScreenshot === true,
      }
    })

    const unknownSegments = shots.filter((s) => !segmentIds.has(s.segmentId))
    if (unknownSegments.length > 0) {
      throw new Error(`shots reference unknown segments: ${unknownSegments.map((s) => s.segmentId).join(', ')}`)
    }
    const uncovered = script.segments.filter((seg) => !shots.some((s) => s.segmentId === seg.id))
    if (uncovered.length > 0) {
      throw new Error(`script segments with no shot coverage: ${uncovered.map((s) => s.id).join(', ')}`)
    }

    return normalizeTimeline(shots, targetDuration)
  },
})
