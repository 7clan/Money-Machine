/**
 * Idea Funnel (Phase 8) + Reporting Brief (Phase 6) + Angle Discovery (Phase 7)
 *
 * Replaces the "first idea GLM invents" anti-pattern with a multi-stage funnel:
 *   100 raw concepts → 50 interesting → 25 strong angles → 15 strong visual →
 *   10 compelling promise → 5 feasible → 1-3 production candidates
 *
 * Each surviving candidate gets a full ReportingBrief that drives the rest of the
 * pipeline: subject ≠ angle, central question, viewer promise, required evidence,
 * visual opportunities, risks.
 */

import { llm, webSearch } from '../zai-provider'
import { extractJSONObject, extractJSONArray } from '../json-utils'
import type { FunnelCandidate, ReportingBrief } from './types'
import { randomUUID } from 'crypto'

// ─── Phase 8 — Idea Funnel ───────────────────────────────────────

/**
 * Generate a funnel of ~100 raw concepts for the channel niche, then cheaply
 * eliminate bad ones before any expensive video generation happens.
 *
 * Returns the top 1-3 production candidates (the rest are persisted for future runs).
 */
export async function runIdeaFunnel(
  niche: string,
  channelName: string,
  targetCount: number = 100,
): Promise<FunnelCandidate[]> {
  // Step 1: Generate ~100 raw concepts in batches of 25 (avoids token limits)
  const batches = Math.ceil(targetCount / 25)
  const raw: Array<{ subject: string; angle: string }> = []
  for (let i = 0; i < batches; i++) {
    const batch = await llm([
      {
        role: 'system',
        content: `You are a YouTube strategist generating raw video concepts for a channel about "${niche}" (channel: "${channelName}").
Return a JSON array of 25 distinct video concepts. Each concept must have:
- subject: the broad topic (e.g. "Nokia", "Roman Concrete", "Rust vs Go")
- angle: the specific framing that makes it interesting (NOT just "history of X" — instead "How X lost everything" or "Why X still works after 2000 years")

The angle must be DIFFERENT from a Wikipedia article. It must create a question in the viewer's mind.

Return ONLY the JSON array, no other text. Format: [{"subject": "...", "angle": "..."}, ...]`,
      },
      { role: 'user', content: `Batch ${i + 1} of ${batches}. Generate 25 NEW concepts (different from any prior batches).` },
    ])
    try {
      const arr = extractJSONArray<{ subject: string; angle: string }>(batch)
      raw.push(...arr)
    } catch (e) {
      console.error(`Funnel batch ${i + 1} failed to parse:`, e)
    }
  }

  // Step 2: Score each raw concept cheaply (single LLM call per concept, batched 10 at a time)
  const candidates: FunnelCandidate[] = []
  const BATCH_SIZE = 10
  for (let i = 0; i < raw.length; i += BATCH_SIZE) {
    const slice = raw.slice(i, i + BATCH_SIZE)
    const scored = await scoreBatch(slice, niche, channelName)
    candidates.push(...scored)
  }

  // Step 3: Filter — keep only the top-scoring candidates
  candidates.sort((a, b) => b.compositeScore - a.compositeScore)

  // Stage labels based on rank
  const ranked = candidates.map((c, i) => {
    let stage: FunnelCandidate['stage'] = 'raw'
    if (i < 3) stage = 'production_candidate'
    else if (i < 10) stage = 'feasible'
    else if (i < 25) stage = 'compelling_promise'
    else if (i < 50) stage = 'strong_visual'
    else if (i < 75) stage = 'strong_angle'
    else stage = 'potentially_interesting'
    return { ...c, stage }
  })

  // Eliminate anything below threshold
  for (const c of ranked) {
    if (c.compositeScore < 50) {
      c.eliminated = true
      c.eliminationReason = `Composite score ${c.compositeScore} below threshold 50`
    }
  }

  // Return top 3 production candidates
  return ranked.filter(c => !c.eliminated && c.stage === 'production_candidate').slice(0, 3)
}

async function scoreBatch(
  concepts: Array<{ subject: string; angle: string }>,
  niche: string,
  channelName: string,
): Promise<FunnelCandidate[]> {
  const prompt = `Score these ${concepts.length} video concepts for a YouTube channel about "${niche}" (channel: "${channelName}").
For each concept, score 0-100 on each dimension. Competition is INVERSE (lower score = less competition = better).

Concepts:
${concepts.map((c, i) => `${i + 1}. SUBJECT: ${c.subject} | ANGLE: ${c.angle}`).join('\n')}

Return JSON array, one entry per concept, in order:
[{
  "viewerCuriosity": 0-100,
  "marketEvidence": 0-100,
  "novelty": 0-100,
  "visualPotential": 0-100,
  "storyPotential": 0-100,
  "productionFeasibility": 0-100,
  "competition": 0-100,  // LOWER = less competition = better
  "monetizationPotential": 0-100,
  "evergreenValue": 0-100,
  "channelFit": 0-100
}]

Be honest. Generic "history of X" angles should score LOW on novelty and curiosity.`

  const response = await llm([
    { role: 'system', content: 'You are a YouTube strategist. Return ONLY a JSON array, no other text.' },
    { role: 'user', content: prompt },
  ])

  try {
    const scores = extractJSONArray<any>(response)
    return concepts.map((c, i) => {
      const s = scores[i] || {}
      const compositeScore = computeComposite(s)
      return {
        id: randomUUID(),
        subject: c.subject,
        angle: c.angle,
        scores: {
          viewerCuriosity: clamp(s.viewerCuriosity ?? 50),
          marketEvidence: clamp(s.marketEvidence ?? 50),
          novelty: clamp(s.novelty ?? 50),
          visualPotential: clamp(s.visualPotential ?? 50),
          storyPotential: clamp(s.storyPotential ?? 50),
          productionFeasibility: clamp(s.productionFeasibility ?? 50),
          competition: clamp(s.competition ?? 50),
          monetizationPotential: clamp(s.monetizationPotential ?? 50),
          evergreenValue: clamp(s.evergreenValue ?? 50),
          channelFit: clamp(s.channelFit ?? 50),
        },
        compositeScore,
        stage: 'raw',
      }
    })
  } catch (e) {
    console.error('Score batch parse failed, returning defaults:', e)
    return concepts.map(c => ({
      id: randomUUID(),
      subject: c.subject,
      angle: c.angle,
      scores: {
        viewerCuriosity: 50, marketEvidence: 50, novelty: 50, visualPotential: 50,
        storyPotential: 50, productionFeasibility: 50, competition: 50,
        monetizationPotential: 50, evergreenValue: 50, channelFit: 50,
      },
      compositeScore: 50,
      stage: 'raw',
    }))
  }
}

function clamp(n: number): number {
  if (isNaN(n)) return 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

function computeComposite(s: any): number {
  // Weighted: curiosity + novelty + story + visualPotential + productionFeasibility + (100 - competition)
  const curiosity = clamp(s.viewerCuriosity ?? 50)
  const novelty = clamp(s.novelty ?? 50)
  const story = clamp(s.storyPotential ?? 50)
  const visual = clamp(s.visualPotential ?? 50)
  const feasibility = clamp(s.productionFeasibility ?? 50)
  const competition = clamp(s.competition ?? 50)
  const channelFit = clamp(s.channelFit ?? 50)
  const evergreen = clamp(s.evergreenValue ?? 50)
  // Lower competition = better → invert
  const invCompetition = 100 - competition
  const composite = Math.round(
    curiosity * 0.18 +
    novelty * 0.15 +
    story * 0.15 +
    visual * 0.12 +
    feasibility * 0.10 +
    invCompetition * 0.10 +
    channelFit * 0.10 +
    evergreen * 0.10,
  )
  return composite
}

// ─── Phase 6 — Reporting Brief ───────────────────────────────────

/**
 * Build a ReportingBrief for a production candidate.
 * Drives the entire rest of the pipeline.
 */
export async function buildReportingBrief(
  candidate: FunnelCandidate,
  channelNiche: string,
): Promise<ReportingBrief> {
  // Phase 5: web research — collect relevant sources for the subject+angle
  const searchQuery = `${candidate.subject} ${candidate.angle}`
  const webResults = await webSearch(searchQuery, 10)
  const sources = webResults.map(r => ({
    url: r.url || r.link || '',
    title: r.title || r.snippet || '',
    type: 'web',
  }))

  const llmResponse = await llm([
    {
      role: 'system',
      content: `You are an investigative reporter + YouTube strategist. Build a ReportingBrief for a video.
The brief drives every later decision (story, visuals, asset sourcing, editing).
Be specific. Vague briefs produce vague videos.

Return ONLY a JSON object — no other text — with this exact shape:
{
  "subject": "the broad topic (one or two words)",
  "angle": "the specific framing — must create a question, not be a Wikipedia summary",
  "centralQuestion": "the question the video answers",
  "viewerPromise": "what the viewer will understand by the end",
  "whyNow": "why this is worth making now (not just 'interesting')",
  "targetViewer": "who this is for",
  "whatViewerProbablyKnows": ["...", "..."],
  "whatIsSurprising": ["...", "..."],
  "mainConflict": "the tension at the heart of the story",
  "mainPayoff": "the satisfying resolution",
  "requiredEvidence": ["specific facts, numbers, documents, or visuals needed to support the argument"],
  "possibleVisualOpportunities": ["specific visual opportunities: charts, maps, screen recordings, documents, archival footage, etc."],
  "risks": ["what could go wrong: factual errors, copyright issues, weak visuals, etc."],
  "sources": []  // leave empty — sources will be injected
}`,
    },
    {
      role: 'user',
      content: `SUBJECT: ${candidate.subject}
ANGLE: ${candidate.angle}
NICHE: ${channelNiche}
COMPOSITE SCORE: ${candidate.compositeScore}/100

Discovered web sources (verify which are authoritative, ignore the rest):
${sources.map((s, i) => `[${i}] ${s.title} — ${s.url}`).join('\n')}

Build the brief now.`,
    },
  ])

  let brief: Partial<ReportingBrief>
  try {
    brief = extractJSONObject<Partial<ReportingBrief>>(llmResponse)
  } catch (e) {
    console.error('Brief parse failed, using fallback:', e)
    brief = {
      subject: candidate.subject,
      angle: candidate.angle,
      centralQuestion: candidate.angle,
      viewerPromise: `Understand ${candidate.subject}`,
      whyNow: 'Timely and underexplored',
      targetViewer: 'Curious general audience',
      whatViewerProbablyKnows: [],
      whatIsSurprising: [],
      mainConflict: '',
      mainPayoff: '',
      requiredEvidence: [],
      possibleVisualOpportunities: [],
      risks: [],
      sources: [],
    }
  }

  return {
    subject: brief.subject || candidate.subject,
    angle: brief.angle || candidate.angle,
    centralQuestion: brief.centralQuestion || candidate.angle,
    viewerPromise: brief.viewerPromise || '',
    whyNow: brief.whyNow || '',
    targetViewer: brief.targetViewer || 'Curious general audience',
    whatViewerProbablyKnows: brief.whatViewerProbablyKnows || [],
    whatIsSurprising: brief.whatIsSurprising || [],
    mainConflict: brief.mainConflict || '',
    mainPayoff: brief.mainPayoff || '',
    requiredEvidence: brief.requiredEvidence || [],
    possibleVisualOpportunities: brief.possibleVisualOpportunities || [],
    risks: brief.risks || [],
    sources,
  }
}

// ─── Phase 9 — Reference Board ──────────────────────────────────

/**
 * Build a reference board of 3-8 related YouTube videos.
 * Used as INSPIRATION ONLY — never copied.
 */
export async function buildReferenceBoard(brief: ReportingBrief) {
  const query = `${brief.subject} ${brief.angle} youtube documentary`
  const results = await webSearch(query, 8)

  // For each result, ask the LLM to extract the reference board fields
  const response = await llm([
    {
      role: 'system',
      content: `You are analyzing YouTube videos as reference material. NEVER clone — extract principles only.
Return ONLY a JSON array, no other text. Each entry:
[{
  "videoTitle": "...",
  "channel": "...",
  "concept": "what the video is about (1 sentence)",
  "openingMechanism": "how the first 10 seconds work",
  "storyStructure": "the overall shape",
  "duration": "approximate length",
  "visualGrammar": "what kinds of visuals they use",
  "editingDensity": "fast/slow/medium cuts",
  "thumbnailConcept": "what the thumbnail shows",
  "titleStructure": "how the title is phrased",
  "whatWorks": "what to learn from",
  "whatShouldNotBeCopied": "what to avoid copying"
}]`,
    },
    {
      role: 'user',
      content: `Reference videos found via web search for the topic "${brief.subject} — ${brief.angle}":

${results.map((r, i) => `[${i}] ${r.title} — ${r.url}\n    ${r.snippet}`).join('\n\n')}

Extract reference board entries from these. If a result is clearly not a YouTube video, skip it.`,
    },
  ])

  try {
    return extractJSONArray<any>(response)
  } catch {
    return []
  }
}
