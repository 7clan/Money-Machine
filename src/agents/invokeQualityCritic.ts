#!/usr/bin/env tsx
/**
 * invokeQualityCritic — QUALITY_CRITIC subagent invocation (READ ONLY)
 *
 * Isolated agent process. Reads {script, shots} from <chainDir>/input.json
 * and produces a QCReport via `z-ai chat` critique MERGED with deterministic
 * structural metrics (coverage, contiguity, duration fit, honesty flags).
 *
 * READ ONLY GUARANTEE: this agent never writes anything except its own
 * output.json + runs/ telemetry. runAgent() verifies by hash that
 * input.json is bit-identical after the run and records `inputUnmodified`.
 *
 * Run: bunx tsx src/agents/invokeQualityCritic.ts
 */
import type { QCReport, Script, VisualShot } from './artifacts/schemas'
import { runAgent, zaiChatJson } from './subagentChain'

type Loose = Record<string, unknown>

function isCritiqueShape(v: unknown): boolean {
  const c = v as Loose
  return !!c && typeof c === 'object' && !!c.scores && typeof (c.scores as Loose) === 'object'
}

const SYSTEM =
  'You are QUALITY_CRITIC, an autonomous READ-ONLY review subagent inside a video production ' +
  'pipeline. You are adversarial: hunt for real problems — weak hooks, pacing drag, redundant ' +
  'shots, narration that outruns its visuals, static screenshots pretending to be motion. ' +
  'You NEVER rewrite the artifacts; you only judge them. ' +
  'Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'QualityCritic',
  role: 'QUALITY_CRITIC',
  artifact: 'QCReport',
  execute: (input) => {
    const script = (input as Loose).script as Script | undefined
    const shots = (input as Loose).shots as VisualShot[] | undefined
    if (!script || !Array.isArray(script.segments) || !Array.isArray(shots)) {
      throw new Error('input.json must contain { "script": Script, "shots": VisualShot[] }')
    }

    // ---------- deterministic structural metrics ----------
    const shotCount = shots.length
    const staticShots = shots.filter((s) => s.isScreenshot && !s.isRawVideo)
    const rawVideoShots = shots.filter((s) => s.isRawVideo)
    const fakeUiShots = shots.filter((s) => s.type === 'SCREEN_CAPTURE' && s.isScreenshot && !s.isRawVideo)
    const pct = (n: number): number => Math.round((n / shotCount) * 1000) / 10

    const structuralFailing: QCReport['failingShots'] = []
    let cursor = 0
    for (const shot of shots) {
      if (Math.abs(shot.start - cursor) > 0.35) {
        structuralFailing.push({
          shotId: shot.id,
          timestamp: shot.start,
          issue: `timeline discontinuity: expected start ${cursor}, got ${shot.start}`,
          recommendation: 'renormalize the shot timeline to be contiguous',
        })
      }
      cursor = shot.end
    }
    const uncovered = script.segments.filter((seg) => !shots.some((s) => s.segmentId === seg.id))
    for (const seg of uncovered) {
      structuralFailing.push({
        shotId: 'none',
        timestamp: 0,
        issue: `script segment ${seg.id} (${seg.type}) has no visual coverage`,
        recommendation: 'add at least one shot for this segment',
      })
    }
    const timelineTotal = shots.length > 0 ? shots[shots.length - 1].end : 0
    const durationDrift =
      script.targetDuration > 0 ? Math.abs(timelineTotal - script.targetDuration) / script.targetDuration : 1
    if (durationDrift > 0.2) {
      structuralFailing.push({
        shotId: shots[shots.length - 1]?.id ?? 'none',
        timestamp: timelineTotal,
        issue: `timeline total ${timelineTotal}s drifts >20% from targetDuration ${script.targetDuration}s`,
        recommendation: 'rescale shot durations to match the target',
      })
    }
    const staticPct = pct(staticShots.length)
    if (staticPct > 50) {
      structuralFailing.push({
        shotId: 'none',
        timestamp: 0,
        issue: `${staticPct}% of shots are static screenshots — reads as a slideshow`,
        recommendation: 'convert static shots to motion graphics or animated vectors',
      })
    }

    // ---------- LLM adversarial critique (READ ONLY reasoning) ----------
    const prompt =
      `SCRIPT (artifact under review — DO NOT REWRITE, only judge):\n${JSON.stringify(script, null, 1)}\n\n` +
      `VISUAL SHOT TIMELINE (artifact under review — DO NOT REWRITE, only judge):\n${JSON.stringify(shots, null, 1)}\n\n` +
      `Structural facts computed by the machine: ${shotCount} shots, ` +
      `${staticPct}% static screenshots, ${pct(rawVideoShots.length)}% raw video, ` +
      `timeline total ${timelineTotal}s vs target ${script.targetDuration}s.\n\n` +
      `Judge this production plan. Reply with a JSON object:\n` +
      `- scores: {hookStrength, narrativeFlow, visualVariety, pacing, narrationAlignment, visualCoverage} ` +
      `each 0-10, judged adversarially\n` +
      `- failingShots: array (may be empty) of {shotId, timestamp, issue, recommendation} for REAL problems only\n` +
      `- verdictSuggestion: "PASS" | "FAIL"\n\n` +
      `Reply with ONLY the JSON object.`

    const critique = zaiChatJson<Loose>({
      system: SYSTEM,
      prompt,
      tag: 'qc-critique',
      validate: isCritiqueShape,
      attempts: 3,
    })

    // ---------- merge: deterministic truth + LLM judgment ----------
    const scoresRaw = (critique.scores ?? {}) as Loose
    const scores: Record<string, number> = {
      hookStrength: clampScore(scoresRaw.hookStrength),
      narrativeFlow: clampScore(scoresRaw.narrativeFlow),
      visualVariety: clampScore(scoresRaw.visualVariety),
      pacing: clampScore(scoresRaw.pacing),
      narrationAlignment: clampScore(scoresRaw.narrationAlignment),
      visualCoverage: clampScore(scoresRaw.visualCoverage),
    }
    const llmFailing = (Array.isArray(critique.failingShots) ? critique.failingShots : []).map((f) => {
      const item = (f ?? {}) as Loose
      return {
        shotId: typeof item.shotId === 'string' ? item.shotId : 'none',
        timestamp: Number(item.timestamp) || 0,
        issue: typeof item.issue === 'string' ? item.issue : 'unspecified issue',
        recommendation: typeof item.recommendation === 'string' ? item.recommendation : 'review manually',
      }
    })

    const failingShots = [...structuralFailing, ...llmFailing]
    const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length
    // Machine truth gate: >2 structural failures or adversarial average < 6 → FAIL
    const verdict: QCReport['verdict'] =
      structuralFailing.length > 2 || avg < 6 ? 'FAIL' : 'PASS'

    const report: QCReport = {
      verdict,
      scores,
      failingShots,
      fakeUICount: fakeUiShots.length,
      realUIPercentage: Math.round((100 - staticPct) * 10) / 10,
      rawVideoPercentage: pct(rawVideoShots.length),
      staticScreenshotPercentage: staticPct,
    }
    return report
  },
})

function clampScore(v: unknown): number {
  const n = Math.round(typeof v === 'number' ? v : Number(v))
  if (!Number.isFinite(n)) return 5
  return Math.max(0, Math.min(10, n))
}
