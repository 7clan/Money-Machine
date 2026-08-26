#!/usr/bin/env tsx
/**
 * invokeIdeaStrategist — IDEA_STRATEGIST subagent invocation
 *
 * Isolated agent process. Reads an OpportunityBrief from <chainDir>/input.json,
 * generates 3 candidate video ideas via `z-ai chat`, then runs a DETERMINISTIC
 * feasibility merge against the real machine capability registry, and writes
 * CandidateIdea[] to <chainDir>/output.json.
 *
 * Run: bunx tsx src/agents/invokeIdeaStrategist.ts
 */
import type { CandidateIdea, OpportunityBrief } from './artifacts/schemas'
import { checkFeasibility, detectCapabilities } from './ProductionCapabilityRegistry'
import { runAgent, zaiChatJson } from './subagentChain'

type Loose = Record<string, unknown>

const SCORE_DIMS = ['novelty', 'visualPotential', 'productionFeasibility', 'monetization', 'channelFit'] as const

function clampScore(v: unknown): number {
  const n = Math.round(typeof v === 'number' ? v : Number(v))
  if (!Number.isFinite(n)) return 5
  return Math.max(0, Math.min(10, n))
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function normalizeIdea(raw: Loose, index: number): CandidateIdea {
  const scoresRaw = (raw.scores ?? {}) as Loose
  const scores = {} as Record<(typeof SCORE_DIMS)[number], number>
  for (const dim of SCORE_DIMS) scores[dim] = clampScore(scoresRaw[dim])
  return {
    id: str(raw.id, `idea-${index + 1}`),
    subject: str(raw.subject, 'Untitled idea'),
    angle: str(raw.angle, ''),
    viewerPromise: str(raw.viewerPromise, ''),
    scores,
    requiredCapabilities: Array.isArray(raw.requiredCapabilities)
      ? raw.requiredCapabilities.map((c) => str(c)).filter((c) => c.length > 0)
      : [],
    productionFeasible: raw.productionFeasible === true,
    feasibilityBlocked: Array.isArray(raw.feasibilityBlocked)
      ? raw.feasibilityBlocked.map((c) => str(c)).filter((c) => c.length > 0)
      : [],
  }
}

function isIdeasShape(v: unknown): boolean {
  return Array.isArray(v) && v.length >= 2 && v.length <= 4 && (v as Loose[]).every((i) => !!i && typeof (i as Loose).subject === 'string')
}

const SYSTEM =
  'You are IDEA_STRATEGIST, an autonomous strategy subagent inside a video production pipeline. ' +
  'You turn research briefs into scored candidate video ideas. Score honestly on a 0-10 scale — ' +
  'a dishonest score poisons the whole pipeline. Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'IdeaStrategist',
  role: 'IDEA_STRATEGIST',
  artifact: 'CandidateIdea[]',
  execute: (input) => {
    const brief = input as OpportunityBrief
    if (!brief || typeof brief.topic !== 'string') {
      throw new Error('input.json must be an OpportunityBrief artifact')
    }

    // Real machine capabilities — the strategist must respect physical reality
    const registry = detectCapabilities()
    const capNames = Object.keys(registry.capabilities)

    const prompt =
      `RESEARCH BRIEF (upstream artifact):\n${JSON.stringify(brief, null, 1)}\n\n` +
      `MACHINE CAPABILITY REGISTRY (what can actually be produced here):\n${JSON.stringify(registry.capabilities)}\n\n` +
      `Generate 3 DISTINCT candidate video ideas for this brief as a JSON array. Each item:\n` +
      `- id: "idea-1" | "idea-2" | "idea-3"\n` +
      `- subject: video subject in <= 12 words\n` +
      `- angle: the specific contrarian/fresh take\n` +
      `- viewerPromise: what the viewer gets, one sentence\n` +
      `- scores: {novelty, visualPotential, productionFeasibility, monetization, channelFit} each 0-10\n` +
      `- requiredCapabilities: array drawn ONLY from [${capNames.join(', ')}] — the minimum needed to produce it\n` +
      `- productionFeasible / feasibilityBlocked: your best guess (will be verified against the registry)\n\n` +
      `Prefer ideas that use capabilities which are true in the registry. Reply with ONLY the JSON array.`

    const rawIdeas = zaiChatJson<unknown>({
      system: SYSTEM,
      prompt,
      tag: 'strategist-ideas',
      validate: isIdeasShape,
      attempts: 3,
    })

    // Deterministic merge: LLM proposes, the machine disposes.
    const ideas = (rawIdeas as Loose[]).map((raw, i) => {
      const idea = normalizeIdea(raw, i)
      const { feasible, blocked } = checkFeasibility(idea.requiredCapabilities, registry)
      return {
        ...idea,
        productionFeasible: feasible,
        feasibilityBlocked: blocked,
      }
    })

    if (!ideas.some((i) => i.productionFeasible)) {
      throw new Error(
        `all candidate ideas infeasible on this machine (blocked: ${ideas
          .map((i) => i.feasibilityBlocked.join('+'))
          .join(' | ')})`,
      )
    }
    return ideas
  },
})
