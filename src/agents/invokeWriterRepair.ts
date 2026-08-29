#!/usr/bin/env tsx
/**
 * invokeWriterRepair — WRITER targeted fact-repair subagent
 *
 * Isolated agent process. Reads { script, factCheckReport, repairScope } from
 * <chainDir>/input.json. Modifies ONLY the segments whose claims are flagged
 * as unsupported by the FactChecker. Replaces specific product/brand mentions
 * with factually-defensible general statements. Writes the repaired Script to
 * <chainDir>/output.json.
 *
 * DOES NOT touch passing segments. DOES NOT rewrite the script structure.
 *
 * Run: bunx tsx src/agents/invokeWriterRepair.ts
 */
import type { FactCheckReport, Script } from './artifacts/schemas'
import { runAgent, zaiChatJson } from './subagentChain'

type Loose = Record<string, unknown>

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function isRepairShape(v: unknown): boolean {
  const r = v as Loose
  return !!r && Array.isArray(r.segments) && typeof r.repairSummary === 'string'
}

const SYSTEM =
  'You are WRITER (repair mode), an autonomous targeted-repair subagent. ' +
  'The FactChecker flagged specific factual claims as unsupported. You modify ONLY the ' +
  'affected segment narrations to remove the unsupported specific claims, replacing them ' +
  'with factually-defensible general statements that preserve the segment\'s narrative purpose. ' +
  'You NEVER touch passing segments. You NEVER change segment IDs, types, ordering, or count. ' +
  'Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'WriterRepair',
  role: 'WRITER_REPAIR',
  artifact: 'RepairedScript',
  execute: (input) => {
    const script = (input as Loose).script as Script | undefined
    const factReport = (input as Loose).factCheckReport as FactCheckReport | undefined
    if (!script || !Array.isArray(script.segments) || !factReport || !Array.isArray(factReport.claims)) {
      throw new Error('input.json must contain { "script": Script, "factCheckReport": FactCheckReport }')
    }

    const unsupported = factReport.claims.filter((c) => !c.supported)
    if (unsupported.length === 0) {
      return { ...script, repairSummary: 'no unsupported claims — no repair needed' }
    }

    // Identify which segments contain unsupported claims (match by narration substring)
    const affectedSegments = new Set<string>()
    for (const claim of unsupported) {
      for (const seg of script.segments) {
        if (seg.narration.includes(claim.claim.split(' ').slice(0, 4).join(' ')) ||
            seg.narration.toLowerCase().includes(claim.claim.toLowerCase().slice(0, 30))) {
          affectedSegments.add(seg.id)
        }
      }
    }
    const affectedList = Array.from(affectedSegments)

    const prompt =
      `ORIGINAL SCRIPT (only modify segments in the affected list):\n${JSON.stringify(script, null, 1)}\n\n` +
      `FACT CHECKER REPORT (the unsupported claims to fix):\n${JSON.stringify(unsupported, null, 1)}\n\n` +
      `AFFECTED SEGMENT IDS (modify ONLY these): ${JSON.stringify(affectedList)}\n\n` +
      `Rules:\n` +
      `1. For each affected segment, rewrite ONLY the narration to remove the unsupported specific claim.\n` +
      `2. Replace with a factually-defensible general statement that preserves the segment's purpose.\n` +
      `3. DO NOT introduce new specific product names, version numbers, or statistics.\n` +
      `4. DO NOT touch any other field (id, type, screenAction, expectedResult, visualPurpose).\n` +
      `5. DO NOT touch segments NOT in the affected list.\n` +
      `6. Keep the new narration similar length (within 20% of original word count) so TTS timing is preserved.\n\n` +
      `Output JSON:\n` +
      `{ "id": same as input, "segments": [all segments, only affected ones modified], ` +
      `"archetype": same, "tone": same, "targetDuration": same, "repairSummary": "1-2 sentences explaining what changed" }\n\n` +
      `Reply with ONLY the JSON object.`

    const raw = zaiChatJson<Loose>({
      system: SYSTEM,
      prompt,
      tag: 'writer-repair',
      validate: isRepairShape,
      attempts: 3,
    })

    // Merge: keep all original segments, replace only the affected ones by id
    const repairedById = new Map<string, Script['segments'][number]>()
    for (const seg of (Array.isArray(raw.segments) ? raw.segments : []) as Loose[]) {
      const id = str(seg.id)
      if (affectedSegments.has(id)) {
        const original = script.segments.find((s) => s.id === id)
        if (!original) continue
        repairedById.set(id, {
          ...original,
          narration: str(seg.narration, original.narration),
        })
      }
    }
    const finalSegments = script.segments.map((s) => repairedById.get(s.id) ?? s)
    const repairedScript: Script = {
      ...script,
      segments: finalSegments,
    }
    const summary = str(raw.repairSummary, `Repaired ${repairedById.size} segments: ${Array.from(repairedById.keys()).join(', ')}`)
    return { ...repairedScript, repairSummary: summary }
  },
})
