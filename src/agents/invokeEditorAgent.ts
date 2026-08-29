/**
 * invokeEditorAgent (extended) — now supports BOTH qc-repair and fact-repair scopes.
 *
 * For 'failing-shots-only' scope: modifies shots flagged by QC.
 * For 'match-script-repair' scope: updates shot purpose/animation text to match
 *   the repaired script narration (no visual change, just description alignment).
 */
import type { Script, VisualShot } from './artifacts/schemas'
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
  'You modify ONLY the shots/segments explicitly flagged for repair. ' +
  'You NEVER touch passing shots — minimal surgical edits only. ' +
  'Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'EditorAgent',
  role: 'EDITOR_AGENT',
  artifact: 'RepairedShots',
  execute: (input) => {
    const script = (input as Loose).script as Script | undefined
    const shots = (input as Loose).shots as VisualShot[] | undefined
    const repairScope = str((input as Loose).repairScope, 'failing-shots-only')
    if (!script || !Array.isArray(script.segments) || !Array.isArray(shots)) {
      throw new Error('input.json must contain { "script": Script, "shots": VisualShot[], "repairScope": string }')
    }

    if (repairScope === 'match-script-repair') {
      // The script narration was repaired for factual issues. Update shot purpose/animation
      // text that referenced the old (now-removed) specific claims, so shot descriptions
      // stay consistent with the new narration. DO NOT change shot timing, type, or visual.
      const prompt =
        `REPAIRED SCRIPT (the source of truth — narration was just fact-repaired):\n${JSON.stringify(script, null, 1)}\n\n` +
        `ALL SHOTS (update ONLY purpose/animation text that references removed claims):\n${JSON.stringify(shots, null, 1)}\n\n` +
        `For each shot, check if its purpose or animation text mentions a specific product/brand/concept that was REMOVED from the corresponding segment's narration.\n` +
        `If yes: rewrite the purpose/animation to match the new narration (general, no specific product names).\n` +
        `If no: leave the shot untouched.\n` +
        `DO NOT change: id, segmentId, start, end, duration, type, isRawVideo, isScreenshot.\n\n` +
        `Output JSON:\n` +
        `{ "shots": VisualShot[] (all shots, only affected ones modified), "repairSummary": string }\n\n` +
        `Reply with ONLY the JSON object.`

      const raw = zaiChatJson<Loose>({
        system: SYSTEM,
        prompt,
        tag: 'editor-match-script',
        validate: isRepairShape,
        attempts: 3,
      })

      const repairedById = new Map<string, VisualShot>()
      for (const r of (Array.isArray(raw.shots) ? raw.shots : []) as Loose[]) {
        const id = str(r.id)
        const original = shots.find((s) => s.id === id)
        if (!original) continue
        repairedById.set(id, {
          ...original,
          purpose: str(r.purpose, original.purpose),
          animation: str(r.animation, original.animation),
        })
      }
      const finalShots = shots.map((s) => repairedById.get(s.id) ?? s)
      const summary = str(raw.repairSummary, `Matched ${repairedById.size} shots to repaired script`)
      return { script, shots: finalShots, repairSummary: summary }
    }

    // Default: 'failing-shots-only' (original QC-repair logic)
    const qcReport = (input as Loose).qcReport as Loose | undefined
    if (!qcReport || !Array.isArray(qcReport.failingShots)) {
      throw new Error('input.json must contain qcReport.failingShots for failing-shots-only scope')
    }
    const failingIds = new Set((qcReport.failingShots as Loose[]).map((f) => str((f as Loose).shotId)))
    if (failingIds.size === 0) {
      return { script, shots, repairSummary: 'no failing shots — no repairs needed' }
    }
    const failingShots = shots.filter((s) => failingIds.has(s.id))
    const failingRecs = (qcReport.failingShots as Loose[]).map((f) => ({
      shotId: str((f as Loose).shotId),
      issue: str((f as Loose).issue),
      recommendation: str((f as Loose).recommendation),
    }))

    const prompt =
      `SCRIPT:\n${JSON.stringify(script, null, 1)}\n\n` +
      `ALL SHOTS (only modify failing ones):\n${JSON.stringify(shots, null, 1)}\n\n` +
      `QC FAILING SHOTS (the surgical repair targets):\n${JSON.stringify(failingRecs, null, 1)}\n\n` +
      `Modify ONLY the failing shots. DO NOT change shot IDs, segment IDs, timing, or any shot not in the failing list.\n\n` +
      `Output JSON: { "script": Script, "shots": VisualShot[], "repairSummary": string }\n\n` +
      `Reply with ONLY the JSON object.`

    const raw = zaiChatJson<Loose>({
      system: SYSTEM,
      prompt,
      tag: 'editor-repair',
      validate: isRepairShape,
      attempts: 3,
    })

    const repairedShotsRaw = (Array.isArray(raw.shots) ? raw.shots : []) as Loose[]
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
