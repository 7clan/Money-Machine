#!/usr/bin/env tsx
/**
 * invokeResearcher — OPPORTUNITY_RESEARCHER subagent invocation
 *
 * Isolated agent process. Reads {topic} from <chainDir>/input.json,
 * performs real web research via `z-ai function --name web_search`,
 * synthesizes the evidence via `z-ai chat`, and writes an
 * OpportunityBrief artifact to <chainDir>/output.json.
 *
 * Run: bunx tsx src/agents/invokeResearcher.ts
 */
import type { OpportunityBrief } from './artifacts/schemas'
import { runAgent, zaiChatJson, zaiWebSearch } from './subagentChain'

type Loose = Record<string, unknown>

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function normalizeBrief(raw: Loose, topic: string): OpportunityBrief {
  const references = (Array.isArray(raw.references) ? raw.references : []).map((r) => {
    const ref = (r ?? {}) as Loose
    return {
      title: str(ref.title, 'Untitled reference'),
      url: str(ref.url),
      channel: str(ref.channel, str(ref.host_name, 'web')),
      views: num(ref.views, 0),
      publishDate: str(ref.publishDate, ''),
      whySelected: str(ref.whySelected, 'Relevant to topic'),
      patternLearned: str(ref.patternLearned, ''),
    }
  })
  const sources = (Array.isArray(raw.sources) ? raw.sources : []).map((s) => {
    const src = (s ?? {}) as Loose
    const reliability = src.reliability === 'high' || src.reliability === 'low' ? src.reliability : 'medium'
    return {
      url: str(src.url),
      title: str(src.title, 'Untitled source'),
      type: str(src.type, 'article'),
      reliability: reliability as 'high' | 'medium' | 'low',
    }
  })
  const audienceQuestions = (Array.isArray(raw.audienceQuestions) ? raw.audienceQuestions : [])
    .map((q) => str(q))
    .filter((q) => q.length > 0)
  const breakoutVideos = (Array.isArray(raw.breakoutVideos) ? raw.breakoutVideos : []).map((b) => {
    const vid = (b ?? {}) as Loose
    const views = num(vid.views, 0)
    const baseline = num(vid.channelBaseline, Math.max(1, Math.round(views / 10)))
    return {
      title: str(vid.title, 'Untitled video'),
      channel: str(vid.channel, 'unknown'),
      views,
      channelBaseline: baseline,
      breakoutRatio: num(vid.breakoutRatio, baseline > 0 ? Math.round((views / baseline) * 10) / 10 : 0),
    }
  })
  return { topic: str(raw.topic, topic), references, sources, audienceQuestions, breakoutVideos }
}

function isBriefShape(v: unknown): boolean {
  const b = v as Loose
  return (
    !!b &&
    typeof b.topic === 'string' &&
    Array.isArray(b.references) &&
    b.references.length >= 2 &&
    Array.isArray(b.sources) &&
    b.sources.length >= 2 &&
    Array.isArray(b.audienceQuestions) &&
    b.audienceQuestions.length >= 2 &&
    Array.isArray(b.breakoutVideos) &&
    b.breakoutVideos.length >= 1
  )
}

const SYSTEM =
  'You are OPPORTUNITY_RESEARCHER, an autonomous research subagent inside a video production ' +
  'pipeline. You reason ONLY from the provided web search evidence — never invent URLs. ' +
  'You communicate exclusively through a JSON artifact: reply with ONLY raw JSON, ' +
  'no prose, no markdown fences.'

runAgent({
  agent: 'Researcher',
  role: 'OPPORTUNITY_RESEARCHER',
  artifact: 'OpportunityBrief',
  execute: (input) => {
    const topic = str((input as Loose).topic)
    if (!topic) throw new Error('input.json must contain { "topic": string }')

    // Real web research: two search passes over the live web
    const hitsA = zaiWebSearch(topic, 5)
    const hitsB = zaiWebSearch(`${topic} research study statistics`, 5)
    const evidence = [...hitsA, ...hitsB].map((h) => ({
      url: h.url,
      title: h.name,
      host: h.host_name,
      snippet: h.snippet,
    }))

    const prompt =
      `TOPIC: "${topic}"\n\n` +
      `WEB SEARCH EVIDENCE (real results, use ONLY these URLs):\n${JSON.stringify(evidence, null, 1)}\n\n` +
      `Produce an OpportunityBrief JSON with EXACTLY these fields:\n` +
      `- topic: the topic string\n` +
      `- references: 3-5 items {title, url, channel, views(number, estimate 0 if unknown), ` +
      `publishDate(may be ""), whySelected, patternLearned} — url MUST come from the evidence\n` +
      `- sources: 3-6 items {url, title, type("article"|"study"|"video"|"forum"), ` +
      `reliability("high" for .edu/.gov/peer-reviewed, else "medium"|"low")} — url MUST come from the evidence\n` +
      `- audienceQuestions: 3-5 real questions people ask about this topic\n` +
      `- breakoutVideos: 2-3 items {title, channel, views, channelBaseline, breakoutRatio} — ` +
      `plausible estimates of videos that strongly outperformed their channel baseline\n\n` +
      `Reply with ONLY the JSON object.`

    const raw = zaiChatJson<Loose>({
      system: SYSTEM,
      prompt,
      tag: 'researcher-brief',
      validate: isBriefShape,
      attempts: 3,
    })

    return normalizeBrief(raw, topic)
  },
})
