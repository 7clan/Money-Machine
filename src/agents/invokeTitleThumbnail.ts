#!/usr/bin/env tsx
/**
 * invokeTitleThumbnail — TITLE_THUMBNAIL_DIRECTOR subagent invocation
 *
 * Isolated agent process. Reads { script, format, idea } from <chainDir>/input.json,
 * generates 5 title candidates + 3 thumbnail concepts via `z-ai chat`, scores
 * them on accuracy/curiosity/synergy, and writes the winning pair to
 * <chainDir>/output.json.
 *
 * Run: bunx tsx src/agents/invokeTitleThumbnail.ts
 */
import type { FormatSelection, Script } from './artifacts/schemas'
import { runAgent, zaiChatJson } from './subagentChain'

type Loose = Record<string, unknown>

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}
function num(v: unknown, fallback = 5): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : fallback
}

interface TitleCandidate {
  text: string
  scores: { accuracy: number; curiosity: number; specificity: number; thumbnailSynergy: number }
  composite: number
}
interface ThumbnailConcept {
  visualSubject: string
  composition: string
  emotion: string
  textIfAny: string
  curiosityMechanism: string
}
interface TitleThumbnailPair {
  title: string
  thumbnail: ThumbnailConcept
  titleComposite: number
  allTitles: TitleCandidate[]
  allThumbnails: ThumbnailConcept[]
}

function isPair(v: unknown): boolean {
  const r = v as Loose
  return (
    !!r &&
    typeof r.title === 'string' &&
    typeof (r.thumbnail as Loose | undefined)?.visualSubject === 'string'
  )
}

const SYSTEM =
  'You are TITLE_THUMBNAIL_DIRECTOR, an autonomous packaging subagent. ' +
  'You produce the title + thumbnail pair that gives the video its best honest chance on YouTube. ' +
  'Titles must be accurate (no clickbait lies), curiosity-driven, specific, and complementary to ' +
  'the thumbnail — never duplicate wording. Reply with ONLY raw JSON, no prose, no markdown fences.'

runAgent({
  agent: 'TitleThumbnailDirector',
  role: 'TITLE_THUMBNAIL_DIRECTOR',
  artifact: 'TitleThumbnailPair',
  execute: (input) => {
    const script = (input as Loose).script as Script | undefined
    const format = (input as Loose).format as FormatSelection | undefined
    const idea = (input as Loose).idea as Loose | undefined
    if (!script || !Array.isArray(script.segments)) {
      throw new Error('input.json must contain { "script": Script, "format": FormatSelection, "idea": CandidateIdea }')
    }
    const archetype = format?.archetype ?? 'unknown'
    const subject = str(idea?.subject, str(script.id))

    const prompt =
      `SCRIPT:\n${JSON.stringify(script, null, 1)}\n\n` +
      `FORMAT: ${archetype}\n` +
      `SUBJECT: ${subject}\n\n` +
      `Generate 5 distinct title candidates and 3 thumbnail concepts. Score each title 0-10 on ` +
      `{accuracy, curiosity, specificity, thumbnailSynergy}. Pick the winning title (highest ` +
      `composite mean) and pair it with the best thumbnail concept. Requirements:\n` +
      `- Title and thumbnail must NOT duplicate wording\n` +
      `- No clickbait that the video cannot deliver\n` +
      `- Thumbnail text (if any) <= 4 words, complementary to title\n\n` +
      `Output JSON:\n` +
      `{ "title": string, "titleComposite": number, "thumbnail": { "visualSubject", "composition", ` +
      `"emotion", "textIfAny", "curiosityMechanism" }, "allTitles": [{text, scores, composite}], ` +
      `"allThumbnails": [ThumbnailConcept] }\n\n` +
      `Reply with ONLY the JSON object.`

    const raw = zaiChatJson<Loose>({
      system: SYSTEM,
      prompt,
      tag: 'title-thumb',
      validate: isPair,
      attempts: 3,
    })

    const allTitles: TitleCandidate[] = (Array.isArray(raw.allTitles) ? raw.allTitles : []).map((t) => {
      const tt = (t ?? {}) as Loose
      const sc = (tt.scores ?? {}) as Loose
      const scores = {
        accuracy: num(sc.accuracy),
        curiosity: num(sc.curiosity),
        specificity: num(sc.specifity ?? sc.specificity),
        thumbnailSynergy: num(sc.thumbnailSynergy),
      }
      const composite = Math.round(((scores.accuracy + scores.curiosity + scores.specificity + scores.thumbnailSynergy) / 4) * 10) / 10
      return { text: str(tt.text), scores, composite }
    })
    const allThumbnails: ThumbnailConcept[] = (Array.isArray(raw.allThumbnails) ? raw.allThumbnails : []).map((t) => {
      const tt = (t ?? {}) as Loose
      return {
        visualSubject: str(tt.visualSubject),
        composition: str(tt.composition),
        emotion: str(tt.emotion),
        textIfAny: str(tt.textIfAny),
        curiosityMechanism: str(tt.curiosityMechanism),
      }
    })
    const thumbRaw = (raw.thumbnail ?? {}) as Loose
    const thumbnail: ThumbnailConcept = {
      visualSubject: str(thumbRaw.visualSubject),
      composition: str(thumbRaw.composition),
      emotion: str(thumbRaw.emotion),
      textIfAny: str(thumbRaw.textIfAny),
      curiosityMechanism: str(thumbRaw.curiosityMechanism),
    }
    const title = str(raw.title, allTitles[0]?.text ?? subject)
    const titleComposite =
      typeof raw.titleComposite === 'number' ? raw.titleComposite : allTitles[0]?.composite ?? 0

    const pair: TitleThumbnailPair = {
      title,
      thumbnail,
      titleComposite,
      allTitles,
      allThumbnails,
    }
    return pair
  },
})
