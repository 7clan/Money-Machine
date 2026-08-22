/**
 * Title Engine (Phase 35) + Thumbnail Engine (Phase 34)
 *
 * Title: generate MANY title candidates, evaluate across 8 dimensions,
 * pick the best. Avoid fabricated claims.
 *
 * Thumbnail: generate 5-10 thumbnail CONCEPTS first, then pick + render pixels.
 * Title and thumbnail must COMPLEMENT each other (not duplicate).
 */

import { llm } from '../zai-provider'
import { extractJSONArray, extractJSONObject } from '../json-utils'
import type { ArchetypeConfig, ReportingBrief, TitleCandidate, ThumbnailConcept } from './types'
import { randomUUID } from 'crypto'

// ─── Phase 35 — Title Engine ───────────────────────────────

export async function buildTitleEngine(
  brief: ReportingBrief,
  archetype: ArchetypeConfig,
  currentTitle: string,
): Promise<TitleCandidate[]> {
  const response = await llm([
    {
      role: 'system',
      content: `You are a YouTube title strategist. Generate 10 distinct title candidates.
Score each on 0-100 across 8 dimensions. overclaimingRisk is INVERSE (lower = safer).

Return ONLY a JSON array, no other text:
[{
  "title": "the title (max 70 chars)",
  "clarity": 0-100,
  "curiosity": 0-100,
  "specificity": 0-100,
  "promise": 0-100,
  "topicAccuracy": 0-100,
  "novelty": 0-100,
  "thumbnailSynergy": 0-100,
  "overclaimingRisk": 0-100
}]

Rules:
- NO fabricated claims or numbers
- NO clickbait ("You won't believe...", "Shocking...")
- The title must create a question the video actually answers
- Vary the structure across candidates (statement, question, "How X...", "Why X...", "The X That Y")`,
    },
    {
      role: 'user',
      content: `SUBJECT: ${brief.subject}
ANGLE: ${brief.angle}
CENTRAL QUESTION: ${brief.centralQuestion}
VIEWER PROMISE: ${brief.viewerPromise}
WHAT'S SURPRISING: ${brief.whatIsSurprising.join('; ')}
ARCHETYPE: ${archetype.archetype}

Current title (improve on this): ${currentTitle}

Generate 10 candidates.`,
    },
  ])

  let candidates: any[]
  try {
    candidates = extractJSONArray<any>(response)
  } catch {
    candidates = [{ title: currentTitle, clarity: 60, curiosity: 60, specificity: 60, promise: 60, topicAccuracy: 80, novelty: 50, thumbnailSynergy: 50, overclaimingRisk: 30 }]
  }

  const scored: TitleCandidate[] = candidates.map(c => {
    const compositeScore = Math.round(
      (c.clarity || 50) * 0.15 +
      (c.curiosity || 50) * 0.20 +
      (c.specificity || 50) * 0.10 +
      (c.promise || 50) * 0.15 +
      (c.topicAccuracy || 50) * 0.15 +
      (c.novelty || 50) * 0.10 +
      (c.thumbnailSynergy || 50) * 0.10 -
      (c.overclaimingRisk || 50) * 0.15,
    )
    return {
      id: randomUUID(),
      title: c.title || currentTitle,
      clarity: clamp(c.clarity ?? 50),
      curiosity: clamp(c.curiosity ?? 50),
      specificity: clamp(c.specificity ?? 50),
      promise: clamp(c.promise ?? 50),
      topicAccuracy: clamp(c.topicAccuracy ?? 50),
      novelty: clamp(c.novelty ?? 50),
      thumbnailSynergy: clamp(c.thumbnailSynergy ?? 50),
      overclaimingRisk: clamp(c.overclaimingRisk ?? 50),
      compositeScore,
    }
  })

  // Sort by composite score descending
  return scored.sort((a, b) => b.compositeScore - a.compositeScore)
}

function clamp(n: number): number {
  if (isNaN(n)) return 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

// ─── Phase 34 — Thumbnail Engine ────────────────────────────

export async function buildThumbnailConcepts(
  brief: ReportingBrief,
  archetype: ArchetypeConfig,
  isShort: boolean,
): Promise<ThumbnailConcept[]> {
  const response = await llm([
    {
      role: 'system',
      content: `You are a YouTube thumbnail designer. Generate 5 distinct thumbnail CONCEPTS (not pixels — just the design ideas).

The thumbnail and title must COMPLEMENT each other. If the title is "How Nokia Lost Everything",
the thumbnail should NOT just say "WHY NOKIA FAILED" — it should show something the title doesn't:
a falling graph, a date, a shocking number.

Return ONLY a JSON array:
[{
  "visualSubject": "what's the main subject",
  "composition": "how it's framed (close-up, wide, rule-of-thirds, etc.)",
  "emotion": "what feeling it evokes",
  "background": "what's behind the subject",
  "textIfAny": "max 3 words of text on the thumbnail (often empty)",
  "curiosityMechanism": "what makes viewer want to click",
  "relationToTitle": "how it complements the title"
}]`,
    },
    {
      role: 'user',
      content: `SUBJECT: ${brief.subject}
ANGLE: ${brief.angle}
WHAT'S SURPRISING: ${brief.whatIsSurprising.join('; ')}
ARCHETYPE: ${archetype.archetype}
FORMAT: ${isShort ? 'Short (9:16)' : 'Long-form (16:9)'}

Generate 5 thumbnail concepts.`,
    },
  ])

  let concepts: any[]
  try {
    concepts = extractJSONArray<any>(response)
  } catch {
    concepts = []
  }

  return concepts.map(c => ({
    id: randomUUID(),
    visualSubject: c.visualSubject || brief.subject,
    composition: c.composition || 'centered',
    emotion: c.emotion || 'curious',
    background: c.background || 'dark',
    textIfAny: c.textIfAny || '',
    curiosityMechanism: c.curiosityMechanism || 'mystery',
    relationToTitle: c.relationToTitle || 'complements',
  }))
}
