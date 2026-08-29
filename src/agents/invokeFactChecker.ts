#!/usr/bin/env tsx
/**
 * invokeFactChecker — FACT_CHECKER subagent invocation (READ ONLY)
 *
 * Isolated agent process. Reads { script, sources } from <chainDir>/input.json,
 * performs independent web searches to verify every factual claim in the script,
 * and writes a FactCheckReport to <chainDir>/output.json.
 *
 * NEVER edits the script — read only. The EditorAgent handles repairs.
 *
 * Run: bunx tsx src/agents/invokeFactChecker.ts
 */
import type { FactCheckReport, Script } from './artifacts/schemas'
import { runAgent, zaiChatJson, zaiWebSearch } from './subagentChain'

type Loose = Record<string, unknown>

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function isReportShape(v: unknown): boolean {
  const r = v as Loose
  return (
    !!r &&
    (r.verdict === 'PASS' || r.verdict === 'FAIL') &&
    Array.isArray(r.claims) &&
    // claims may be empty when verdict=PASS (no unsupported claims found)
    (r.verdict === 'PASS' || r.claims.length >= 1)
  )
}

const SYSTEM =
  'You are FACT_CHECKER, an autonomous read-only verification subagent. ' +
  'You verify factual claims (numbers, dates, named events, statistics) against the provided ' +
  'web search evidence. NEVER edit the script. For each claim: mark supported=true only when ' +
  'the evidence directly backs it. Cite the source URL. If a claim is unverifiable or wrong, ' +
  'mark supported=false and explain. Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'FactChecker',
  role: 'FACT_CHECKER',
  artifact: 'FactCheckReport',
  execute: (input) => {
    const script = (input as Loose).script as Script | undefined
    if (!script || !Array.isArray(script.segments)) {
      throw new Error('input.json must contain { "script": Script }')
    }

    // Pull every narrated segment into a list of factual claims
    const segments = script.segments
    const subjectText = segments.map((s) => s.narration).join(' \n ')
    const evidence = zaiWebSearch(`facts about: ${subjectText.slice(0, 400)}`, 5)

    const prompt =
      `SCRIPT TO VERIFY (READ ONLY — do not modify):\n${JSON.stringify(script, null, 1)}\n\n` +
      `WEB EVIDENCE (use ONLY these URLs):\n${JSON.stringify(evidence, null, 1)}\n\n` +
      `Extract every factual claim from the narration (numbers, dates, named events, statistics, attributions). ` +
      `For each, attempt to verify against the evidence. Produce a FactCheckReport JSON:\n` +
      `- verdict: "PASS" if 0 unsupported claims, "FAIL" if any unsupported\n` +
      `- claims: array of { claim, supported (bool), source (url or ""), issue (string if unsupported) }\n` +
      `- unsupportedCount: integer\n\n` +
      `Be strict but fair. A vague narrative phrasing is not a claim. A specific number/date IS a claim. ` +
      `Reply with ONLY the JSON object.`

    const raw = zaiChatJson<Loose>({
      system: SYSTEM,
      prompt,
      tag: 'fact-check',
      validate: isReportShape,
      attempts: 3,
    })

    const claims = (Array.isArray(raw.claims) ? raw.claims : []).map((c) => {
      const cc = (c ?? {}) as Loose
      return {
        claim: str(cc.claim, 'unspecified claim'),
        supported: cc.supported === true,
        source: str(cc.source),
        issue: str(cc.issue),
      }
    })
    const unsupportedCount = claims.filter((c) => !c.supported).length
    const report: FactCheckReport = {
      verdict: unsupportedCount === 0 ? 'PASS' : 'FAIL',
      claims,
      unsupportedCount,
    }
    return report
  },
})
