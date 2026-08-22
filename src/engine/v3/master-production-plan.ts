/**
 * Master Production Plan (Phase: spec section 5-6)
 *
 * Replaces 9 separate LLM calls (reporting brief, reference board, story beats,
 * visual script, performance script, EDL, sound design, titles, thumbnail concepts)
 * with ONE high-quality GLM-5.3 creative call.
 *
 * The LLM decides CREATIVE INTENT.
 * Code (in deterministic-code-layer.ts) implements it: EDL timing, captions,
 * asset IDs, file paths, transitions, render jobs, cost accounting.
 *
 * Schema-validated locally via MasterProductionPlanSchema.
 * If one optional field is invalid, repair that field — don't discard the
 * entire expensive response.
 */

import { llm } from './zai-scheduler'
import { extractJSONObject } from '../json-utils'
import type {
  Archetype, ReportingBrief, StoryBeat, VisualScriptEntry,
  AssetManifest, SoundCue, ThumbnailConcept, TitleCandidate,
} from './types'
import { randomUUID } from 'crypto'

// ─── Master Plan Schema (Phase: spec section 20) ─────────────

export interface MasterProductionPlan {
  archetype: Archetype
  reportingBrief: ReportingBrief
  angle: {
    subject: string
    angle: string
    centralQuestion: string
    viewerPromise: string
  }
  story: {
    hook: StoryBeat[]
    beats: StoryBeat[]
    payoff: StoryBeat[]
  }
  visualScript: VisualScriptEntry[]
  voiceDirection: Array<{
    beatId: string
    speed: number
    emotion: 'neutral' | 'curious' | 'serious' | 'energetic' | 'mysterious' | 'sad'
    instruction: string
  }>
  assetRequirements: Array<{
    beatId: string
    assetType: AssetManifest['type']
    visualDescription: string
    sourceHint: string
    priority: 'critical' | 'high' | 'medium' | 'low'
  }>
  soundDirection: Array<{
    beatId: string
    type: 'music' | 'sfx' | 'silence'
    label: string
    volume: number
  }>
  thumbnailConcepts: ThumbnailConcept[]
  titleCandidates: Array<{
    title: string
    score: number
  }>
}

// ─── Validation (Phase: spec section 20) ─────────────────────

const VALID_ARCHETYPES: Archetype[] = [
  'DOCUMENTARY', 'VIDEO_ESSAY', 'BUSINESS_CASE_STUDY', 'HISTORY_DOCUMENTARY',
  'SCIENCE_EXPLAINER', 'TECH_EXPLAINER', 'SCREEN_TUTORIAL', 'PRODUCT_COMPARISON',
  'COMMENTARY', 'MEDIA_ANALYSIS', 'STORY_MYSTERY', 'LIST_ENTERTAINMENT',
  'DATA_STORY', 'GAMEPLAY', 'SHORT_FACT', 'SHORT_STORY', 'SHORT_COMMENTARY',
  'SHORT_VISUAL_SPECTACLE',
]

const VALID_ASSET_TYPES: AssetManifest['type'][] = [
  'ORIGINAL_SCREEN_RECORDING', 'ORIGINAL_GRAPHIC', 'ORIGINAL_CHART', 'ORIGINAL_MAP',
  'ORIGINAL_DIAGRAM', 'PUBLIC_DOMAIN_VIDEO', 'PUBLIC_DOMAIN_IMAGE', 'CREATIVE_COMMONS',
  'LICENSED_STOCK', 'WEBPAGE_CAPTURE', 'DOCUMENT', 'NEWS_HEADLINE', 'DATASET',
  'ZAI_VIDEO', 'ZAI_IMAGE', 'EDITORIAL_EXCERPT',
]

const VALID_BEAT_PURPOSES: StoryBeat['purpose'][] = [
  'HOOK', 'SETUP', 'QUESTION', 'EVIDENCE', 'ESCALATION', 'CONTRADICTION',
  'REVEAL', 'PAYOFF', 'TRANSITION', 'CALLBACK', 'ENDING',
]

/**
 * Validate a MasterProductionPlan. Returns a list of repairable issues.
 * If issues are found, repair them in place rather than rejecting the whole plan.
 */
export function validateAndRepairPlan(raw: any): MasterProductionPlan {
  const issues: string[] = []

  // Archetype
  let archetype: Archetype = raw?.archetype
  if (!VALID_ARCHETYPES.includes(archetype)) {
    archetype = 'DOCUMENTARY'
    issues.push(`Invalid archetype "${raw?.archetype}" → defaulted to DOCUMENTARY`)
  }

  // Angle
  const angle = {
    subject: String(raw?.angle?.subject || raw?.reportingBrief?.subject || 'Topic').slice(0, 200),
    angle: String(raw?.angle?.angle || raw?.reportingBrief?.angle || '').slice(0, 300),
    centralQuestion: String(raw?.angle?.centralQuestion || raw?.reportingBrief?.centralQuestion || '').slice(0, 300),
    viewerPromise: String(raw?.angle?.viewerPromise || raw?.reportingBrief?.viewerPromise || '').slice(0, 500),
  }

  // Reporting Brief — repair missing fields
  const brief: ReportingBrief = {
    subject: raw?.reportingBrief?.subject || angle.subject,
    angle: raw?.reportingBrief?.angle || angle.angle,
    centralQuestion: raw?.reportingBrief?.centralQuestion || angle.centralQuestion,
    viewerPromise: raw?.reportingBrief?.viewerPromise || angle.viewerPromise,
    whyNow: raw?.reportingBrief?.whyNow || '',
    targetViewer: raw?.reportingBrief?.targetViewer || 'Curious general audience',
    whatViewerProbablyKnows: Array.isArray(raw?.reportingBrief?.whatViewerProbablyKnows) ? raw.reportingBrief.whatViewerProbablyKnows : [],
    whatIsSurprising: Array.isArray(raw?.reportingBrief?.whatIsSurprising) ? raw.reportingBrief.whatIsSurprising : [],
    mainConflict: raw?.reportingBrief?.mainConflict || '',
    mainPayoff: raw?.reportingBrief?.mainPayoff || '',
    requiredEvidence: Array.isArray(raw?.reportingBrief?.requiredEvidence) ? raw.reportingBrief.requiredEvidence : [],
    possibleVisualOpportunities: Array.isArray(raw?.reportingBrief?.possibleVisualOpportunities) ? raw.reportingBrief.possibleVisualOpportunities : [],
    risks: Array.isArray(raw?.reportingBrief?.risks) ? raw.reportingBrief.risks : [],
    sources: Array.isArray(raw?.reportingBrief?.sources) ? raw.reportingBrief.sources : [],
  }

  // Story beats — merge hook + beats + payoff, assign IDs
  const allRawBeats = [
    ...(raw?.story?.hook || []),
    ...(raw?.story?.beats || []),
    ...(raw?.story?.payoff || []),
  ]
  const allBeats: StoryBeat[] = allRawBeats.map((b: any, i: number) => ({
    id: b.id || `beat_${i + 1}`,
    order: i + 1,
    narration: String(b.narration || '').slice(0, 1000),
    purpose: VALID_BEAT_PURPOSES.includes(b.purpose) ? b.purpose : 'SETUP',
    viewerQuestion: b.viewerQuestion ?? null,
    newQuestion: b.newQuestion ?? null,
    newInformation: String(b.newInformation || ''),
    emotionalIntent: String(b.emotionalIntent || ''),
    visualIntent: String(b.visualIntent || ''),
    preferredAssetType: VALID_ASSET_TYPES.includes(b.preferredAssetType) ? b.preferredAssetType : 'ZAI_IMAGE',
    evidenceSourceIds: Array.isArray(b.evidenceSourceIds) ? b.evidenceSourceIds.map(String) : [],
    soundIntent: String(b.soundIntent || ''),
  }))

  // Split into hook / beats / payoff based on purpose
  const hook = allBeats.filter(b => b.purpose === 'HOOK')
  const payoff = allBeats.filter(b => b.purpose === 'ENDING' || b.purpose === 'PAYOFF')
  const beats = allBeats.filter(b => !hook.includes(b) && !payoff.includes(b))

  // Visual Script — one entry per beat
  const rawVS = raw?.visualScript || []
  const visualScript: VisualScriptEntry[] = allBeats.map((b, i) => {
    const vs = rawVS[i] || {}
    return {
      beatId: b.id,
      voiceover: vs.voiceover || b.narration,
      visual: vs.visual || b.visualIntent,
      purpose: vs.purpose || b.emotionalIntent,
      source: vs.source || '',
      edit: vs.edit || 'hard cut',
      sound: vs.sound || b.soundIntent,
    }
  })

  // Voice direction — per beat
  const voiceDirection = (raw?.voiceDirection || []).map((v: any) => ({
    beatId: v.beatId || '',
    speed: typeof v.speed === 'number' ? Math.max(0.5, Math.min(2.0, v.speed)) : 1.0,
    emotion: ['neutral', 'curious', 'serious', 'energetic', 'mysterious', 'sad'].includes(v.emotion) ? v.emotion : 'neutral',
    instruction: String(v.instruction || ''),
  }))

  // Asset requirements — per beat
  const assetRequirements = (raw?.assetRequirements || allBeats.map((b: any) => ({
    beatId: b.id,
    assetType: b.preferredAssetType || 'ZAI_IMAGE',
    visualDescription: b.visualIntent,
    sourceHint: '',
    priority: 'medium',
  }))).map((a: any) => ({
    beatId: a.beatId || '',
    assetType: VALID_ASSET_TYPES.includes(a.assetType) ? a.assetType : 'ZAI_IMAGE',
    visualDescription: String(a.visualDescription || ''),
    sourceHint: String(a.sourceHint || ''),
    priority: ['critical', 'high', 'medium', 'low'].includes(a.priority) ? a.priority : 'medium',
  }))

  // Sound direction
  const soundDirection = (raw?.soundDirection || []).map((s: any) => ({
    beatId: s.beatId || '',
    type: ['music', 'sfx', 'silence'].includes(s.type) ? s.type : 'music',
    label: String(s.label || ''),
    volume: typeof s.volume === 'number' ? Math.max(0, Math.min(1, s.volume)) : 0.5,
  }))

  // Thumbnail concepts
  const thumbnailConcepts = (raw?.thumbnailConcepts || []).slice(0, 5).map((t: any) => ({
    id: t.id || randomUUID(),
    visualSubject: String(t.visualSubject || ''),
    composition: String(t.composition || ''),
    emotion: String(t.emotion || 'curious'),
    background: String(t.background || 'dark'),
    textIfAny: String(t.textIfAny || ''),
    curiosityMechanism: String(t.curiosityMechanism || ''),
    relationToTitle: String(t.relationToTitle || ''),
  }))

  // Title candidates
  const titleCandidates = (raw?.titleCandidates || []).slice(0, 10).map((t: any) => ({
    id: randomUUID(),
    title: String(t.title || '').slice(0, 100),
    clarity: 60, curiosity: 60, specificity: 60, promise: 60,
    topicAccuracy: 70, novelty: 60, thumbnailSynergy: 60,
    overclaimingRisk: 30,
    compositeScore: typeof t.score === 'number' ? t.score : 60,
  }))

  if (issues.length > 0) {
    console.warn(`[master-plan] Repaired ${issues.length} issues:`, issues)
  }

  return {
    archetype,
    reportingBrief: brief,
    angle,
    story: { hook, beats, payoff },
    visualScript,
    voiceDirection,
    assetRequirements,
    soundDirection,
    thumbnailConcepts,
    titleCandidates,
  }
}

// ─── Build the Master Plan (ONE LLM call) ────────────────────

/**
 * Make ONE high-quality GLM-5.3 creative call that produces the entire
 * MasterProductionPlan. This replaces 9 separate LLM calls.
 *
 * @param topic The video subject + angle
 * @param researchPack Real web research results (sources, snippets)
 * @param referenceBoard Real YouTube reference videos (with real IDs)
 * @param isShort Short-form vs long-form
 * @param targetDurationSec Target duration in seconds
 */
export async function buildMasterProductionPlan(opts: {
  topic: string
  angle: string
  researchPack: Array<{ url: string; title: string; snippet: string }>
  referenceBoard: Array<{ videoId: string; title: string; channel: string; views: number; duration: string }>
  isShort: boolean
  targetDurationSec: number
  channelNiche: string
  channelName: string
}): Promise<MasterProductionPlan> {
  const { topic, angle, researchPack, referenceBoard, isShort, targetDurationSec, channelNiche, channelName } = opts

  // Target beat count based on ~5 seconds per beat
  const targetBeatCount = Math.max(5, Math.round(targetDurationSec / 5))

  const systemPrompt = `You are a master YouTube creative director + writer + visual researcher.
You produce ONE MasterProductionPlan object that drives the entire video pipeline.

CRITICAL RULES:
- Open with something that creates a question — NOT "Welcome back" / "Today we're going to"
- Every beat answers ONE question while creating the next (chain of curiosity)
- Ban article-like narration — this is a STORY not a Wikipedia article
- Beats must have semantic purpose (HOOK/SETUP/QUESTION/EVIDENCE/REVEAL/PAYOFF/TRANSITION/ENDING)
- For each beat's preferredAssetType, ask: "what would a competent human editor put on screen?"
  - If narration cites a NUMBER → ORIGINAL_CHART
  - If narration mentions a PLACE → ORIGINAL_MAP
  - If narration mentions a UI flow → ORIGINAL_SCREEN_RECORDING
  - If narration cites a document/news → DOCUMENT or NEWS_HEADLINE
  - If narration needs cinematic atmosphere → ZAI_VIDEO (use sparingly — expensive)
  - Default for stills → ZAI_IMAGE
- Vary preferredAssetType across beats — NOT all AI images
- Each beat's narration is ONE or TWO sentences (not a paragraph)
- Target ${targetBeatCount} beats for a ${targetDurationSec}s ${isShort ? 'Short' : 'long-form'} video
- Title candidates must NOT duplicate the thumbnail text
- Thumbnail concepts must COMPLEMENT the title (not repeat it)

Return ONLY a JSON object with this exact shape:
{
  "archetype": "DOCUMENTARY" | "VIDEO_ESSAY" | "BUSINESS_CASE_STUDY" | "HISTORY_DOCUMENTARY" | "SCIENCE_EXPLAINER" | "TECH_EXPLAINER" | "SCREEN_TUTORIAL" | "PRODUCT_COMPARISON" | "COMMENTARY" | "MEDIA_ANALYSIS" | "STORY_MYSTERY" | "LIST_ENTERTAINMENT" | "DATA_STORY" | "GAMEPLAY" | "SHORT_FACT" | "SHORT_STORY" | "SHORT_COMMENTARY" | "SHORT_VISUAL_SPECTACLE",
  "reportingBrief": {
    "subject": "...", "angle": "...", "centralQuestion": "...", "viewerPromise": "...",
    "whyNow": "...", "targetViewer": "...",
    "whatViewerProbablyKnows": ["..."], "whatIsSurprising": ["..."],
    "mainConflict": "...", "mainPayoff": "...",
    "requiredEvidence": ["..."], "possibleVisualOpportunities": ["..."],
    "risks": ["..."], "sources": [{"url":"...","title":"...","type":"web"}]
  },
  "angle": { "subject": "...", "angle": "...", "centralQuestion": "...", "viewerPromise": "..." },
  "story": {
    "hook": [{"narration":"...","purpose":"HOOK","viewerQuestion":null,"newQuestion":"...","newInformation":"...","emotionalIntent":"...","visualIntent":"...","preferredAssetType":"ORIGINAL_CHART","evidenceSourceIds":["1"],"soundIntent":"..."}],
    "beats": [...],
    "payoff": [{"narration":"...","purpose":"ENDING","viewerQuestion":"...","newQuestion":null,"newInformation":"...","emotionalIntent":"...","visualIntent":"...","preferredAssetType":"ZAI_IMAGE","evidenceSourceIds":[],"soundIntent":"..."}]
  },
  "visualScript": [{"beatId":"beat_1","voiceover":"...","visual":"specific visual description","purpose":"why this visual","source":"where from","edit":"hard_cut|crossfade|fade","sound":"music|sfx|silence"}],
  "voiceDirection": [{"beatId":"beat_1","speed":1.0,"emotion":"neutral|curious|serious|energetic|mysterious|sad","instruction":"pause here"}],
  "assetRequirements": [{"beatId":"beat_1","assetType":"ORIGINAL_CHART","visualDescription":"...","sourceHint":"...","priority":"critical|high|medium|low"}],
  "soundDirection": [{"beatId":"beat_1","type":"music|sfx|silence","label":"...","volume":0.5}],
  "thumbnailConcepts": [{"visualSubject":"...","composition":"...","emotion":"...","background":"...","textIfAny":"...","curiosityMechanism":"...","relationToTitle":"..."}],
  "titleCandidates": [{"title":"...","score":80}]
}`

  const userPrompt = `TOPIC: ${topic}
ANGLE: ${angle}
CHANNEL: ${channelName} (${channelNiche})
FORMAT: ${isShort ? 'Short (9:16, ≤60s)' : 'Long-form (16:9)'}
TARGET DURATION: ${targetDurationSec}s (~${targetBeatCount} beats)

REAL WEB RESEARCH (use these as sources — do NOT invent URLs):
${researchPack.slice(0, 10).map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet?.slice(0, 200) || ''}`).join('\n')}

REAL YOUTUBE REFERENCE VIDEOS (study for principles — NEVER copy):
${referenceBoard.slice(0, 5).map((r, i) => `[${i + 1}] "${r.title}" by ${r.channel} — ${r.views} views, ${r.duration}`).join('\n')}

Produce the MasterProductionPlan now. ONE JSON object, no other text.`

  const response = await llm(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { thinking: true, cacheable: true }, // cacheable — never re-generate identical plans
  )

  let raw: any
  try {
    raw = extractJSONObject(response)
  } catch (e: any) {
    throw new Error(`MasterProductionPlan JSON parse failed: ${e.message}. Response: ${response.slice(0, 500)}`)
  }

  return validateAndRepairPlan(raw)
}
