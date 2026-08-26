#!/usr/bin/env tsx
/**
 * invokeFormatDirector — FORMAT_DIRECTOR subagent invocation
 *
 * Isolated agent process. Reads {ideas: CandidateIdea[]} from
 * <chainDir>/input.json, has the LLM select the winning idea + production
 * archetype, cross-checks required capabilities against the REAL machine
 * capability registry (deterministic override), and writes a FormatSelection
 * artifact to <chainDir>/output.json.
 *
 * Run: bunx tsx src/agents/invokeFormatDirector.ts
 */
import type { CandidateIdea, FormatSelection } from './artifacts/schemas'
import { checkFeasibility, detectCapabilities } from './ProductionCapabilityRegistry'
import { runAgent, zaiChatJson } from './subagentChain'

type Loose = Record<string, unknown>

const ARCHETYPES = [
  'EXPLAINER_ESSAY',
  'TOP5_COUNTDOWN',
  'MYTH_BUSTER',
  'DEEP_DIVE_DOC',
  'TUTORIAL_WALKTHROUGH',
  'STORY_DRIVEN_CASE_STUDY',
]

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function isFormatShape(v: unknown): boolean {
  const f = v as Loose
  return (
    !!f &&
    typeof f.archetype === 'string' &&
    typeof f.reason === 'string' &&
    Array.isArray(f.capabilitiesRequired) &&
    typeof f.selectedIdeaId === 'string'
  )
}

function totalScore(idea: CandidateIdea): number {
  return Object.values(idea.scores).reduce((a, b) => a + b, 0)
}

const SYSTEM =
  'You are FORMAT_DIRECTOR, an autonomous format subagent inside a video production pipeline. ' +
  'You pick ONE winning idea and its production archetype, respecting what this machine can ' +
  'actually render. Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'FormatDirector',
  role: 'FORMAT_DIRECTOR',
  artifact: 'FormatSelection',
  execute: (input) => {
    const ideas = (input as Loose).ideas as CandidateIdea[] | undefined
    if (!Array.isArray(ideas) || ideas.length === 0) {
      throw new Error('input.json must contain { "ideas": CandidateIdea[] }')
    }

    const registry = detectCapabilities()
    const capNames = Object.keys(registry.capabilities)

    const prompt =
      `CANDIDATE IDEAS (upstream artifact):\n${JSON.stringify(ideas, null, 1)}\n\n` +
      `MACHINE CAPABILITY REGISTRY (real, live-detected):\n${JSON.stringify(registry.capabilities)}\n\n` +
      `Select the single best idea and its format. Reply with a JSON object:\n` +
      `- selectedIdeaId: the id of the winning idea (MUST be one with productionFeasible=true)\n` +
      `- archetype: one of [${ARCHETYPES.join(', ')}]\n` +
      `- reason: 1-2 sentences why this idea + archetype wins on THIS machine\n` +
      `- capabilitiesRequired: the minimal subset of [${capNames.join(', ')}] needed for the chosen format\n\n` +
      `Reply with ONLY the JSON object.`

    const raw = zaiChatJson<Loose>({
      system: SYSTEM,
      prompt,
      tag: 'format-selection',
      validate: isFormatShape,
      attempts: 3,
    })

    // Deterministic capability cross-check — trust nothing, verify everything
    let selectedId = str(raw.selectedIdeaId)
    let selected = ideas.find((i) => i.id === selectedId && i.productionFeasible)
    let reason = str(raw.reason, 'Selected by FormatDirector')
    if (!selected) {
      selected = [...ideas].filter((i) => i.productionFeasible).sort((a, b) => totalScore(b) - totalScore(a))[0]
      if (!selected) throw new Error('no production-feasible idea available for format selection')
      selectedId = selected.id
      reason = `${reason} [OVERRIDE: LLM selection was infeasible/unknown; machine picked highest-scoring feasible idea ${selectedId}]`
    }

    const requiredRaw = Array.isArray(raw.capabilitiesRequired)
      ? (raw.capabilitiesRequired as unknown[]).map((c) => str(c)).filter(Boolean)
      : []
    // Union: format needs ∪ winning idea needs — both must hold on this machine
    const required = Array.from(new Set([...requiredRaw, ...selected.requiredCapabilities]))
    const capabilitiesAvailable: Record<string, boolean> = {}
    for (const cap of required) capabilitiesAvailable[cap] = registry.capabilities[cap] === true
    const { feasible, blocked } = checkFeasibility(required, registry)

    const selection: FormatSelection & { selectedIdeaId: string } = {
      archetype: ARCHETYPES.includes(str(raw.archetype)) ? str(raw.archetype) : 'EXPLAINER_ESSAY',
      reason,
      capabilitiesAvailable,
      capabilitiesRequired: required,
      blocked: !feasible,
      ...(feasible ? {} : { blockedReason: `machine lacks: ${blocked.join(', ')}` }),
      selectedIdeaId: selectedId,
    }
    return selection
  },
})
