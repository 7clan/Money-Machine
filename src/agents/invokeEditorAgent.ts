#!/usr/bin/env tsx
/**
 * invokeEditorAgent — EDITOR_AGENT subagent invocation (targeted repair)
 *
 * Isolated agent process. Reads { script, shots, qcReport, repairScope } from
 * <chainDir>/input.json and modifies ONLY the shots/segments flagged as failing
 * by the QualityCritic. Writes the repaired { script, shots } to output.json.
 *
 * Run: bunx tsx src/agents/invokeEditorAgent.ts
 */
import type { QCReport, Script, VisualShot } from './artifacts/schemas'
import { runAgent, zaiChatJson } from './subagentChain'

type Loose = Record<string, unknown>

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function isRepairShape(v: unknown): boolean {
  const r = v as Loose
  return !!r && Array.isArray(r.shots) && typeof r.repairSummary === 'string'
}

const SYSTEM =
  'You are EDITOR_AGENT, an autonomous targeted-repair subagent. ' +
  'You modify ONLY the shots/segments flagged as failing by the QualityCritic. ' +
  'You NEVER touch passing shots — minimal surgical edits only. ' +
  'Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'EditorAgent',
  role: 'EDITOR_AGENT',
  artifact: 'RepairedProduction',
  execute: (input) => {
    const script = (input as Loose).script as Script | undefined
    const shots = (input as Loose).shots as VisualShot[] | undefined
    const qcReport = (input as Loose).qcReport as QCReport | undefined
    if (!script || !Array.isArray(script.segments) || !Array.isArray(shots) || !qcReport) {
      throw new Error('input.json must contain { "script": Script, "shots": VisualShot[], "qcReport": QCReport }')
    }

    const failingIds = new Set((qcReport.failingShots ?? []).map((f) => f.shotId))
    if (failingIds.size === 0) {
      return { script, shots, repairSummary: 'no failing shots — no repairs needed' }
    }
    const failingShots = shots.filter((s) => failingIds.has(s.id))
    const failingRecs = (qcReport.failingShots ?? []).map((f) => ({ shotId: f.shotId, issue: f.issue, recommendation: f.recommendation }))

    const prompt =
      `SCRIPT (only modify segments whose shots are failing):\n${JSON.stringify(script, null, 1)}\n\n` +
      `ALL SHOTS (only modify failing ones):\n${JSON.stringify(shots, null, 1)}\n\n` +
      `QC FAILING SHOTS (the surgical repair targets):\n${JSON.stringify(failingRecs, null, 1)}\n\n` +
      `Modify ONLY the failing shots to address their issues. You may:\n` +
      `- Change a shot's type (e.g., TEXT_CARD → GENERATED_IMAGE if too static)\n` +
      `- Rewrite the shot's purpose/animation to fix the issue\n` +
      `- Replace a static screenshot flag with motion (isScreenshot=false)\n` +
      `- Update the corresponding segment's narration if the issue is content-related\n` +
      `DO NOT change shot IDs, segment IDs, timing, or any shot not in the failing list.\n\n` +
      `Output JSON:\n` +
      `{ "script": Script (modified only if needed), "shots": VisualShot[] (only failing shots modified), "repairSummary": string }\n\n` +
      `Reply with ONLY the JSON object.`

    const raw = zaiChatJson<Loose>({
      system: SYSTEM,
      prompt,
      tag: 'editor-repair',
      validate: isRepairShape,
      attempts: 3,
    })

    const repairedShotsRaw = (Array.isArray(raw.shots) ? raw.shots : []) as Loose[]
    // Merge: keep all original shots, replace only the failing ones by id
    const repairedById = new Map<string, VisualShot>()
    for (const r of repairedShotsRaw) {
      const id = str(r.id)
      if (failingIds.has(id)) {
        repairedById.set(id, {
          id,
          segmentId: str(r.segmentId),
          start: Number(r.start) || 0,
          end: Number(r.end) || 0,
          duration: Number(r.duration) || 0,
          type: str(r.type, 'GENERATED_IMAGE'),
          purpose: str(r.purpose, 'Repaired shot'),
          animation: str(r.animation, 'fade + slide'),
          isRawVideo: r.isRawVideo === true,
          isScreenshot: r.isScreenshot === true,
        })
      }
    }
    const finalShots = shots.map((s) => repairedById.get(s.id) ?? s)
    const repairedScript = raw.script && typeof (raw.script as Loose).segments === 'object' ? (raw.script as Script) : script
    const summary = str(raw.repairSummary, `Repaired ${repairedById.size} shots`)
    return { script: repairedScript, shots: finalShots, repairSummary: summary }
  },
})
