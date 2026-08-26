#!/usr/bin/env tsx
/**
 * invokeWriter — WRITER subagent invocation
 *
 * Isolated agent process. Reads {ideas, format} from <chainDir>/input.json
 * (the FormatSelection names the winning idea via selectedIdeaId), writes a
 * segment-structured Script via `z-ai chat`, and writes the Script artifact
 * to <chainDir>/output.json.
 *
 * Run: bunx tsx src/agents/invokeWriter.ts
 */
import type { CandidateIdea, FormatSelection, Script } from './artifacts/schemas'
import { runAgent, zaiChatJson } from './subagentChain'

type Loose = Record<string, unknown>

const SEGMENT_TYPES = ['HOOK', 'SETUP', 'TRICK', 'SECTION', 'PAYOFF', 'ENDING'] as const
type SegmentType = (typeof SEGMENT_TYPES)[number]

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function normalizeSegment(raw: Loose, index: number): Script['segments'][number] {
  const typeRaw = str(raw.type, 'SECTION').toUpperCase() as SegmentType
  const type: SegmentType = SEGMENT_TYPES.includes(typeRaw) ? typeRaw : 'SECTION'
  return {
    id: str(raw.id, `seg-${index + 1}`),
    type,
    narration: str(raw.narration, ''),
    screenAction: str(raw.screenAction, ''),
    expectedResult: str(raw.expectedResult, ''),
    visualPurpose: str(raw.visualPurpose, ''),
  }
}

function normalizeScript(raw: Loose, archetype: string, fallbackDuration: number): Script {
  const durationRaw = Number(raw.targetDuration)
  const targetDuration =
    Number.isFinite(durationRaw) && durationRaw >= 30 && durationRaw <= 180
      ? Math.round(durationRaw)
      : fallbackDuration
  return {
    id: str(raw.id, `script-${Date.now()}`),
    segments: (Array.isArray(raw.segments) ? raw.segments : []).map((s, i) =>
      normalizeSegment((s ?? {}) as Loose, i),
    ),
    archetype: str(raw.archetype, archetype),
    tone: str(raw.tone, 'direct, curious, no fluff'),
    targetDuration,
  }
}

function isScriptShape(v: unknown): boolean {
  const s = v as Loose
  return (
    !!s &&
    Array.isArray(s.segments) &&
    s.segments.length >= 4 &&
    (s.segments as Loose[]).every((seg) => {
      const narration = (seg as Loose).narration
      return typeof narration === 'string' && narration.length > 0
    })
  )
}

const SYSTEM =
  'You are WRITER, an autonomous script subagent inside a video production pipeline. ' +
  'You write action-led narration scripts: every segment shows something happening on screen. ' +
  'No filler, no "in this video" intros. Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'Writer',
  role: 'WRITER',
  artifact: 'Script',
  execute: (input) => {
    const ideas = (input as Loose).ideas as CandidateIdea[] | undefined
    const format = (input as Loose).format as (FormatSelection & { selectedIdeaId?: string }) | undefined
    if (!Array.isArray(ideas) || !format) {
      throw new Error('input.json must contain { "ideas": CandidateIdea[], "format": FormatSelection }')
    }

    const selected =
      ideas.find((i) => i.id === format.selectedIdeaId) ??
      ideas.find((i) => i.productionFeasible) ??
      ideas[0]
    if (!selected) throw new Error('no candidate idea available to write from')

    const prompt =
      `WINNING IDEA (upstream artifact):\n${JSON.stringify(selected, null, 1)}\n\n` +
      `FORMAT SELECTION (upstream artifact):\n${JSON.stringify(format, null, 1)}\n\n` +
      `Write the production script as a JSON object:\n` +
      `- id: "script-<slug>"\n` +
      `- segments: 6-8 items, in order, starting with type "HOOK" and ending with type "ENDING"; ` +
      `each item {id: "seg-1"..., type: one of [${SEGMENT_TYPES.join(', ')}], narration: spoken-word ` +
      `voiceover 1-2 sentences (15-40 words), screenAction: the concrete on-screen action, ` +
      `expectedResult: what the viewer should feel/learn, visualPurpose: why this visual beat exists}\n` +
      `- archetype: "${format.archetype}"\n` +
      `- tone: 3-6 words\n` +
      `- targetDuration: total seconds, 45-90\n\n` +
      `The narration words must fit the targetDuration at ~2.5 words/second. ` +
      `Reply with ONLY the JSON object.`

    const raw = zaiChatJson<Loose>({
      system: SYSTEM,
      prompt,
      tag: 'writer-script',
      validate: isScriptShape,
      attempts: 3,
    })

    const script = normalizeScript(raw, format.archetype, 60)
    if (script.segments.length < 4) throw new Error('script has fewer than 4 segments after normalization')
    const words = script.segments.map((s) => s.narration).join(' ').split(/\s+/).length
    const implied = Math.round(words / 2.5)
    if (implied > script.targetDuration * 1.5) {
      // keep the artifact honest: narration length drives the real duration
      script.targetDuration = Math.min(180, Math.max(45, implied))
    }
    return script
  },
})
