/**
 * ArchetypeRouter (Phase 3)
 *
 * Maps a topic + reporting brief to a specific archetype. Each archetype has
 * a fundamentally different visual / story / sound / edit profile so videos
 * do NOT all look like the same AI slideshow template.
 *
 * The router picks the archetype based on the reporting brief's subject,
 * central question, and required evidence — not randomly.
 */

import type { Archetype, ArchetypeConfig, AssetType, MusicMood, ReportingBrief } from './types';

// ─── Per-archetype configs (Phase 3) ──────────────────────────────
export const ARCHETYPE_CONFIGS: Record<Archetype, ArchetypeConfig> = {
  DOCUMENTARY: {
    archetype: 'DOCUMENTARY',
    structurePattern: 'hook → context → rise → conflict → climax → resolution',
    averageShotRhythm: 6,
    assetPriorities: ['PUBLIC_DOMAIN_VIDEO', 'NEWS_HEADLINE', 'ORIGINAL_CHART', 'ZAI_VIDEO', 'ZAI_IMAGE', 'EDITORIAL_EXCERPT'],
    captionStyle: 'selective',
    musicMood: 'serious',
    transitionPhilosophy: 'match_cut',
    hookStrategy: 'Open with a contradiction, a surprising fact, or a dramatic moment — never a definition',
    narrationTone: 'Measured, journalistic, lets the facts breathe. Avoid hype words.',
    endingStructure: 'Synthesize the lesson — connect back to the opening question with new understanding',
    format: 'longform',
  },
  VIDEO_ESSAY: {
    archetype: 'VIDEO_ESSAY',
    structurePattern: 'thesis → evidence → counterpoint → synthesis',
    averageShotRhythm: 5,
    assetPriorities: ['ORIGINAL_GRAPHIC', 'ZAI_IMAGE', 'WEBPAGE_CAPTURE', 'ORIGINAL_CHART', 'EDITORIAL_EXCERPT'],
    captionStyle: 'selective',
    musicMood: 'curious',
    transitionPhilosophy: 'crossfade',
    hookStrategy: 'Open with a claim the viewer might disagree with, then promise to defend it',
    narrationTone: 'Thoughtful, opinionated but fair. First-person allowed.',
    endingStructure: 'Restate the thesis with the new evidence integrated; don\'t moralize',
    format: 'longform',
  },
  BUSINESS_CASE_STUDY: {
    archetype: 'BUSINESS_CASE_STUDY',
    structurePattern: 'setup of company → the bet → the rise → the mistake → the fall → the lesson',
    averageShotRhythm: 5,
    assetPriorities: ['ORIGINAL_CHART', 'WEBPAGE_CAPTURE', 'NEWS_HEADLINE', 'DOCUMENT', 'ZAI_IMAGE'],
    captionStyle: 'selective',
    musicMood: 'neutral',
    transitionPhilosophy: 'hard_cut',
    hookStrategy: 'Open with the shocking number — the dollar amount lost, the valuation peak, the time it took to collapse',
    narrationTone: 'Analytical, numbers-forward, avoids jargon',
    endingStructure: 'The one decision that mattered — framed as a transferable lesson',
    format: 'longform',
  },
  HISTORY_DOCUMENTARY: {
    archetype: 'HISTORY_DOCUMENTARY',
    structurePattern: 'time → place → people → event → consequence → modern echo',
    averageShotRhythm: 7,
    assetPriorities: ['ORIGINAL_MAP', 'PUBLIC_DOMAIN_IMAGE', 'DOCUMENT', 'ORIGINAL_GRAPHIC', 'ZAI_VIDEO'],
    captionStyle: 'selective',
    musicMood: 'serious',
    transitionPhilosophy: 'crossfade',
    hookStrategy: 'Open with a specific moment — a date, a place, a single person — not an era',
    narrationTone: 'Calm, slightly formal, names places and dates clearly',
    endingStructure: 'Connect the historical event to a present-day parallel',
    format: 'longform',
  },
  SCIENCE_EXPLAINER: {
    archetype: 'SCIENCE_EXPLAINER',
    structurePattern: 'mystery → misconception → mechanism → evidence → implication',
    averageShotRhythm: 5,
    assetPriorities: ['ORIGINAL_DIAGRAM', 'ORIGINAL_GRAPHIC', 'DATASET', 'ZAI_VIDEO', 'ZAI_IMAGE'],
    captionStyle: 'selective',
    musicMood: 'curious',
    transitionPhilosophy: 'mixed',
    hookStrategy: 'Open with a counterintuitive fact that breaks what the viewer thought they knew',
    narrationTone: 'Enthusiastic but precise — never condescending',
    endingStructure: 'The big-picture implication — why this changes how the viewer sees the world',
    format: 'longform',
  },
  TECH_EXPLAINER: {
    archetype: 'TECH_EXPLAINER',
    structurePattern: 'problem → old approach → new approach → how it works → why it matters',
    averageShotRhythm: 4,
    assetPriorities: ['ORIGINAL_SCREEN_RECORDING', 'ORIGINAL_DIAGRAM', 'ORIGINAL_GRAPHIC', 'ZAI_IMAGE'],
    captionStyle: 'selective',
    musicMood: 'neutral',
    transitionPhilosophy: 'hard_cut',
    hookStrategy: 'Open with the user-facing pain or the surprising capability, not the technology name',
    narrationTone: 'Conversational, technically accurate, no buzzwords',
    endingStructure: 'Concrete takeaway: what the viewer should do or try next',
    format: 'longform',
  },
  SCREEN_TUTORIAL: {
    archetype: 'SCREEN_TUTORIAL',
    structurePattern: 'promise → setup → step 1 → step 2 → ... → result → recap',
    averageShotRhythm: 8,
    assetPriorities: ['ORIGINAL_SCREEN_RECORDING', 'ORIGINAL_GRAPHIC', 'ORIGINAL_DIAGRAM'],
    captionStyle: 'phrase',
    musicMood: 'neutral',
    transitionPhilosophy: 'hard_cut',
    hookStrategy: 'Open with the end-state the viewer wants (the working result), then promise to get them there',
    narrationTone: 'Instructional, calm, anticipates confusion',
    endingStructure: 'Recap the steps in order; mention the next-level thing to try',
    format: 'longform',
  },
  PRODUCT_COMPARISON: {
    archetype: 'PRODUCT_COMPARISON',
    structurePattern: 'context → criteria → A vs B per criterion → verdict',
    averageShotRhythm: 4,
    assetPriorities: ['ORIGINAL_SCREEN_RECORDING', 'ORIGINAL_CHART', 'ORIGINAL_GRAPHIC', 'ZAI_IMAGE'],
    captionStyle: 'selective',
    musicMood: 'neutral',
    transitionPhilosophy: 'hard_cut',
    hookStrategy: 'Open with the decision the viewer is trying to make — name the two options',
    narrationTone: 'Even-handed, criteria-first, no preference signaling until the verdict',
    endingStructure: 'A clear verdict per use case — not a wishy-washy "it depends"',
    format: 'longform',
  },
  COMMENTARY: {
    archetype: 'COMMENTARY',
    structurePattern: 'event → reaction → context → implication → call to attention',
    averageShotRhythm: 4,
    assetPriorities: ['WEBPAGE_CAPTURE', 'NEWS_HEADLINE', 'EDITORIAL_EXCERPT', 'ORIGINAL_GRAPHIC'],
    captionStyle: 'phrase',
    musicMood: 'neutral',
    transitionPhilosophy: 'hard_cut',
    hookStrategy: 'Open with the thing being commented on — a quote, a screenshot, a clip',
    narrationTone: 'Direct, opinionated, fair — owns subjectivity',
    endingStructure: 'What to watch for next',
    format: 'longform',
  },
  MEDIA_ANALYSIS: {
    archetype: 'MEDIA_ANALYSIS',
    structurePattern: 'piece → pattern → technique → meaning → wider application',
    averageShotRhythm: 4,
    assetPriorities: ['EDITORIAL_EXCERPT', 'ORIGINAL_GRAPHIC', 'ZAI_IMAGE'],
    captionStyle: 'selective',
    musicMood: 'curious',
    transitionPhilosophy: 'crossfade',
    hookStrategy: 'Open with the specific scene / shot / line being analyzed',
    narrationTone: 'Analytical, references craft (editing, framing, writing) not just plot',
    endingStructure: 'What this technique teaches about the medium',
    format: 'longform',
  },
  STORY_MYSTERY: {
    archetype: 'STORY_MYSTERY',
    structurePattern: 'mystery → first clue → red herring → real clue → reveal → explanation',
    averageShotRhythm: 4,
    assetPriorities: ['ORIGINAL_MAP', 'DOCUMENT', 'ZAI_VIDEO', 'ZAI_IMAGE', 'NEWS_HEADLINE'],
    captionStyle: 'phrase',
    musicMood: 'mysterious',
    transitionPhilosophy: 'crossfade',
    hookStrategy: 'Open with the unanswered question — the thing that doesn\'t make sense',
    narrationTone: 'Measured, lets silence breathe, drops revelations with weight',
    endingStructure: 'The cleanest explanation that fits all the evidence',
    format: 'longform',
  },
  LIST_ENTERTAINMENT: {
    archetype: 'LIST_ENTERTAINMENT',
    structurePattern: 'promise → countdown → reveal of #1 → final thought',
    averageShotRhythm: 4,
    assetPriorities: ['ZAI_IMAGE', 'ORIGINAL_GRAPHIC', 'WEBPAGE_CAPTURE'],
    captionStyle: 'phrase',
    musicMood: 'energetic',
    transitionPhilosophy: 'hard_cut',
    hookStrategy: 'Open with #1 implicit — make viewer want to know what beats the rest',
    narrationTone: 'Upbeat but not fake — energy from genuine interest',
    endingStructure: 'The #1 with a clear justification, then a callback to the promise',
    format: 'longform',
  },
  DATA_STORY: {
    archetype: 'DATA_STORY',
    structurePattern: 'question → dataset → surprising pattern → mechanism → implication',
    averageShotRhythm: 5,
    assetPriorities: ['DATASET', 'ORIGINAL_CHART', 'ORIGINAL_GRAPHIC', 'ZAI_IMAGE'],
    captionStyle: 'selective',
    musicMood: 'curious',
    transitionPhilosophy: 'mixed',
    hookStrategy: 'Open with the surprising number, then ask why',
    narrationTone: 'Data-first, lets charts speak, narrates the trend not the chart',
    endingStructure: 'The one chart the viewer should remember + what to do with it',
    format: 'longform',
  },
  GAMEPLAY: {
    archetype: 'GAMEPLAY',
    structurePattern: 'setup → attempt → setback → strategy → success → reflection',
    averageShotRhythm: 3,
    assetPriorities: ['ORIGINAL_SCREEN_RECORDING', 'ORIGINAL_GRAPHIC'],
    captionStyle: 'phrase',
    musicMood: 'energetic',
    transitionPhilosophy: 'hard_cut',
    hookStrategy: 'Open with the moment of crisis or the impossible shot',
    narrationTone: 'Reactive, first-person, authentic surprise',
    endingStructure: 'What the run taught — transferable insight',
    format: 'longform',
  },
  SHORT_FACT: {
    archetype: 'SHORT_FACT',
    structurePattern: 'visual hook → claim → proof → payoff',
    averageShotRhythm: 1.5,
    assetPriorities: ['ZAI_VIDEO', 'ORIGINAL_GRAPHIC', 'ZAI_IMAGE'],
    captionStyle: 'burned_in',
    musicMood: 'energetic',
    transitionPhilosophy: 'hard_cut',
    hookStrategy: 'First frame must be the visual proof or the surprising object',
    narrationTone: 'Fast, declarative, no filler',
    endingStructure: 'Loop back to the hook visual for infinite replay',
    format: 'short',
  },
  SHORT_STORY: {
    archetype: 'SHORT_STORY',
    structurePattern: 'mystery → escalation → twist → resolution',
    averageShotRhythm: 1.2,
    assetPriorities: ['ZAI_VIDEO', 'ORIGINAL_MAP', 'ZAI_IMAGE', 'DOCUMENT'],
    captionStyle: 'burned_in',
    musicMood: 'mysterious',
    transitionPhilosophy: 'crossfade',
    hookStrategy: 'First frame: the unanswered visual question',
    narrationTone: 'Tense, sparse, lets visuals carry weight',
    endingStructure: 'The reveal — one frame, one line',
    format: 'short',
  },
  SHORT_COMMENTARY: {
    archetype: 'SHORT_COMMENTARY',
    structurePattern: 'clip → reaction → point',
    averageShotRhythm: 2,
    assetPriorities: ['EDITORIAL_EXCERPT', 'ORIGINAL_GRAPHIC', 'WEBPAGE_CAPTURE'],
    captionStyle: 'burned_in',
    musicMood: 'neutral',
    transitionPhilosophy: 'hard_cut',
    hookStrategy: 'Open with the thing being commented on — quote / clip / screenshot',
    narrationTone: 'Direct, one-point-only, no preamble',
    endingStructure: 'The point — said once, clearly',
    format: 'short',
  },
  SHORT_VISUAL_SPECTACLE: {
    archetype: 'SHORT_VISUAL_SPECTACLE',
    structurePattern: 'establishing shot → escalation → money shot',
    averageShotRhythm: 1.5,
    assetPriorities: ['ZAI_VIDEO', 'ZAI_IMAGE'],
    captionStyle: 'burned_in',
    musicMood: 'energetic',
    transitionPhilosophy: 'crossfade',
    hookStrategy: 'First frame must be the spectacle — don\'t build to it',
    narrationTone: 'Minimal — let the visual speak',
    endingStructure: 'Hold the money shot for 1.5s before loop',
    format: 'short',
  },
};

// ─── Router logic ─────────────────────────────────────────────────

/**
 * Pick the best archetype for a given reporting brief.
 * Uses keyword matching on the subject + angle + central question + required evidence.
 * Falls back to DOCUMENTARY (longform) or SHORT_FACT (short) if no clear match.
 */
export function routeArchetype(brief: ReportingBrief, isShort: boolean): Archetype {
  const text = `${brief.subject} ${brief.angle} ${brief.centralQuestion} ${brief.requiredEvidence.join(' ')} ${brief.possibleVisualOpportunities.join(' ')}`.toLowerCase();

  // Short-form routing
  if (isShort) {
    if (/\b(myster|disappear|unsolved|strange|odd|bizarre|weird)\b/.test(text)) return 'SHORT_STORY';
    if (/\b(fact|number|statistic|record|fastest|biggest|oldest)\b/.test(text)) return 'SHORT_FACT';
    if (/\b(react|response|thought|opinion|take)\b/.test(text)) return 'SHORT_COMMENTARY';
    if (/\b(spectacle|cinematic|epic|visual|nature|space|storm)\b/.test(text)) return 'SHORT_VISUAL_SPECTACLE';
    return 'SHORT_FACT';
  }

  // Long-form routing — order matters (more specific first)
  if (/\b(stock market|billion|million|company|startup|valuation|revenue|business|profit|collapse|ipo)\b/.test(text)) return 'BUSINESS_CASE_STUDY';
  if (/\b(tutorial|how to|setup|configure|windows|macos|linux|vs code|install)\b/.test(text)) return 'SCREEN_TUTORIAL';
  if (/\b(compare|comparison|vs\.?\|versus|better than|which is)\b/.test(text)) return 'PRODUCT_COMPARISON';
  if (/\b(gameplay|gaming|game|level|boss|run|speedrun)\b/.test(text)) return 'GAMEPLAY';
  if (/\b(data|dataset|statistics|trend|chart|graph|numbers|survey)\b/.test(text)) return 'DATA_STORY';
  if (/\b(mystery|disappeared|unsolved|strange|bizarre|puzzle)\b/.test(text)) return 'STORY_MYSTERY';
  if (/\b(movie|film|tv show|episode|scene|character|franchise|season)\b/.test(text)) return 'MEDIA_ANALYSIS';
  if (/\b(history|ancient|century|medieval|empire|war|battle|kingdom)\b/.test(text)) return 'HISTORY_DOCUMENTARY';
  if (/\b(science|physics|chemistry|biology|quantum|atom|cell|dna|space|cosmos)\b/.test(text)) return 'SCIENCE_EXPLAINER';
  if (/\b(tech|technology|ai|software|algorithm|programming|code|api|framework)\b/.test(text)) return 'TECH_EXPLAINER';
  if (/\b(news|react|response|opinion|take|commentary)\b/.test(text)) return 'COMMENTARY';
  if (/\b(list|top 10|countdown|best of|ranking)\b/.test(text)) return 'LIST_ENTERTAINMENT';
  if (/\b(essay|argument|thesis|analysis|critique)\b/.test(text)) return 'VIDEO_ESSAY';

  return 'DOCUMENTARY';
}

export function getArchetypeConfig(archetype: Archetype): ArchetypeConfig {
  return ARCHETYPE_CONFIGS[archetype];
}

export const ALL_ARCHETYPES: Archetype[] = Object.keys(ARCHETYPE_CONFIGS) as Archetype[];
