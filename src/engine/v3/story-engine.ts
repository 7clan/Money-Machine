/**
 * Story Engine (Phase 10-12) + Visual Script (Phase 13-14)
 *
 * Replaces "8-10 fixed scenes per video" with semantic StoryBeats.
 * A 10-minute documentary might have 50-150 beats — the count follows the content.
 *
 * Every beat has a PURPOSE (HOOK, QUESTION, EVIDENCE, REVEAL, PAYOFF, ...).
 * Every beat creates a new question in the viewer's head while answering one.
 * Every beat's visual is selected by asking: "what would a competent human editor
 * put on screen while this sentence is spoken?" — never just "an AI image".
 */

import { llm } from '../zai-provider'
import { extractJSONObject, extractJSONArray } from '../json-utils'
import type { ArchetypeConfig, ReportingBrief, StoryBeat, VisualScriptEntry, AssetType } from './types'
import { randomUUID } from 'crypto'

// ─── Phase 12 — Story Architecture ──────────────────────────────

/**
 * Generate 30-150 StoryBeats for a video based on the reporting brief + archetype.
 * The count follows the content — a 60-second short gets ~8-15 beats, a 10-min
 * documentary gets 50-150.
 */
export async function buildStoryArchitecture(
  brief: ReportingBrief,
  archetype: ArchetypeConfig,
  targetDurationSec: number,
): Promise<StoryBeat[]> {
  // Target beats per minute based on archetype's shot rhythm
  const beatsPerMinute = 60 / archetype.averageShotRhythm
  const targetBeatCount = Math.max(5, Math.round((targetDurationSec / 60) * beatsPerMinute))

  const response = await llm([
    {
      role: 'system',
      content: `You are a documentary writer + YouTube storyteller. Build a StoryArchitecture for a video.

CRITICAL RULES (Phase 10-12):
- Open with something that creates a question — NOT with "Welcome back" / "Today we're going to" / "Let's dive in"
- Every beat answers ONE question while creating the next one (chain of curiosity)
- Ban article-like narration — this is a STORY not a Wikipedia article
- Beats must have semantic purpose (HOOK, SETUP, QUESTION, EVIDENCE, ESCALATION, CONTRADICTION, REVEAL, PAYOFF, TRANSITION, CALLBACK, ENDING)
- A ${targetDurationSec}-second ${archetype.format} should have ~${targetBeatCount} beats
- Each beat's narration is ONE or TWO sentences (not a paragraph)

For each beat specify:
- narration: the actual spoken text (1-2 sentences, written for speech)
- purpose: one of HOOK, SETUP, QUESTION, EVIDENCE, ESCALATION, CONTRADICTION, REVEAL, PAYOFF, TRANSITION, CALLBACK, ENDING
- viewerQuestion: the question in the viewer's head at the START of this beat (null for beat 0)
- newQuestion: the question this beat creates (null for ENDING)
- newInformation: what new info this beat delivers
- emotionalIntent: the intended feeling
- visualIntent: WHAT should be on screen and WHY (specific: "market share chart 2000-2007" not "a chart")
- preferredAssetType: one of ORIGINAL_CHART, ORIGINAL_MAP, ORIGINAL_GRAPHIC, ORIGINAL_DIAGRAM, ORIGINAL_SCREEN_RECORDING, ZAI_VIDEO, ZAI_IMAGE, WEBPAGE_CAPTURE, DOCUMENT, NEWS_HEADLINE, DATASET, EDITORIAL_EXCERPT, PUBLIC_DOMAIN_IMAGE, PUBLIC_DOMAIN_VIDEO
- evidenceSourceIds: which brief.requiredEvidence items this beat cites (1-indexed numbers as strings, or empty array)
- soundIntent: what the sound should do here

ARCHETYPE GUIDANCE for ${archetype.archetype}:
- Structure: ${archetype.structurePattern}
- Hook: ${archetype.hookStrategy}
- Tone: ${archetype.narrationTone}
- Ending: ${archetype.endingStructure}

Return ONLY a JSON array of beats, no other text:
[{
  "narration": "...",
  "purpose": "HOOK",
  "viewerQuestion": null,
  "newQuestion": "...",
  "newInformation": "...",
  "emotionalIntent": "...",
  "visualIntent": "...",
  "preferredAssetType": "ORIGINAL_CHART",
  "evidenceSourceIds": ["1"],
  "soundIntent": "..."
}]`,
    },
    {
      role: 'user',
      content: `REPORTING BRIEF:
${JSON.stringify(brief, null, 2)}

Generate ${targetBeatCount} StoryBeats. The first beat MUST be a HOOK that creates the central question.
The last beat MUST be an ENDING that resolves it.`,
    },
  ])

  let rawBeats: any[]
  try {
    rawBeats = extractJSONArray<any>(response)
  } catch (e) {
    console.error('Story architecture parse failed:', e)
    // Minimal fallback — single beat with the hook
    rawBeats = [{
      narration: brief.centralQuestion,
      purpose: 'HOOK',
      viewerQuestion: null,
      newQuestion: brief.centralQuestion,
      newInformation: '',
      emotionalIntent: 'curious',
      visualIntent: 'Opening title card',
      preferredAssetType: 'ORIGINAL_GRAPHIC',
      evidenceSourceIds: [],
      soundIntent: 'curious',
    }]
  }

  // Assign IDs and order
  const beats: StoryBeat[] = rawBeats.map((b, i) => ({
    id: `beat_${i + 1}`,
    order: i + 1,
    narration: b.narration || '',
    purpose: (b.purpose || 'SETUP') as StoryBeat['purpose'],
    viewerQuestion: b.viewerQuestion ?? null,
    newQuestion: b.newQuestion ?? null,
    newInformation: b.newInformation || '',
    emotionalIntent: b.emotionalIntent || '',
    visualIntent: b.visualIntent || '',
    preferredAssetType: (b.preferredAssetType || 'ZAI_IMAGE') as AssetType,
    evidenceSourceIds: Array.isArray(b.evidenceSourceIds) ? b.evidenceSourceIds.map(String) : [],
    soundIntent: b.soundIntent || '',
  }))

  return beats
}

// ─── Phase 13 — Visual Script ───────────────────────────────────

/**
 * For each beat, produce a VisualScriptEntry with:
 *   VOICEOVER / VISUAL / PURPOSE / SOURCE / EDIT / SOUND
 *
 * The VISUAL field must answer: "what would a competent human editor put on screen
 * while this sentence is spoken?" — never just "an AI image of X".
 */
export async function buildVisualScript(
  beats: StoryBeat[],
  brief: ReportingBrief,
  archetype: ArchetypeConfig,
): Promise<VisualScriptEntry[]> {
  // Process in chunks of 8 beats to keep prompts manageable
  const chunks: StoryBeat[][] = []
  for (let i = 0; i < beats.length; i += 8) {
    chunks.push(beats.slice(i, i + 8))
  }

  const results: VisualScriptEntry[] = []

  for (const chunk of chunks) {
    const response = await llm([
      {
        role: 'system',
        content: `You are a documentary editor + visual researcher. For each story beat, write a VisualScriptEntry.

For every beat ask yourself: "What would a competent human editor put on screen while this sentence is spoken?"

BAD visual: "AI image of a city"
GOOD visual: "Market share chart 2007-2013, line for Apple rising as Nokia falls, sourced from IDC quarterly report"

Return ONLY a JSON array, one entry per beat, in order:
[{
  "beatId": "beat_1",
  "voiceover": "the narration text",
  "visual": "specific visual: subject + composition + duration on screen",
  "purpose": "WHY this visual belongs here (not just 'shows the topic')",
  "source": "where the visual comes from (web research result, generated image, screen recording, etc.)",
  "edit": "how it appears: hard cut, crossfade, animated build, zoom-into-detail, etc.",
  "sound": "music/SFX for this beat — could be 'music continues, low' or 'UI click' or 'silence'"
}]

CRITICAL:
- The visual MUST prove or illustrate the narration. Generic AI images are FORBIDDEN.
- If the narration mentions a number, the visual should show that number.
- If the narration mentions a place, the visual should show a map.
- If the narration mentions a UI flow, the visual should be a screen recording.
- The "purpose" field must explain WHY this visual belongs here — not what it is.`,
      },
      {
        role: 'user',
        content: `ARCHETYPE: ${archetype.archetype}
REPORTING BRIEF sources available:
${brief.sources.map((s, i) => `[${i}] ${s.title} — ${s.url}`).join('\n')}

BEATS TO SCRIPT:
${chunk.map(b => `${b.id} [${b.purpose}] ${b.narration}\n  Visual intent: ${b.visualIntent}\n  Preferred asset: ${b.preferredAssetType}`).join('\n\n')}

Write VisualScriptEntries for each beat.`,
      },
    ])

    try {
      const entries = extractJSONArray<any>(response)
      for (const e of entries) {
        results.push({
          beatId: e.beatId,
          voiceover: e.voiceover || '',
          visual: e.visual || '',
          purpose: e.purpose || '',
          source: e.source || '',
          edit: e.edit || 'hard cut',
          sound: e.sound || '',
        })
      }
    } catch (e) {
      console.error('Visual script parse failed:', e)
      // Fallback — synthesize entries from beats
      for (const b of chunk) {
        results.push({
          beatId: b.id,
          voiceover: b.narration,
          visual: b.visualIntent,
          purpose: 'Illustrates the narration',
          source: 'To be determined by asset sourcing',
          edit: 'hard cut',
          sound: b.soundIntent,
        })
      }
    }
  }

  return results
}
