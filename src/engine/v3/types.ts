/**
 * V3 Content Engine — Shared Type Definitions
 *
 * These types model the new pipeline around creative-decision-making
 * (not just "scenes + images + zoom"). Every visual must have a PURPOSE,
 * every cut must have a REASON, every asset must have PROVENANCE.
 *
 * The pipeline is:
 *   TOPIC DISCOVERY → REFERENCE RESEARCH → ANGLE DISCOVERY → FORMAT SELECTION →
 *   REPORTING BRIEF → RESEARCH PACK → STORY ARCHITECTURE → VISUAL SCRIPT →
 *   PAPER EDIT → ROUGH CUT → CRITIQUE → ASSET PLAN → ASSET ACQUISITION →
 *   EDIT DECISION LIST → FINE CUT → SOUND DESIGN → QUALITY REVIEW →
 *   THUMBNAIL/TITLE → PRIVATE OUTPUT → PUBLISH → ANALYTICS → LEARN
 */

// ─── Archetypes (Phase 3) ─────────────────────────────────────────
export type Archetype =
  | 'DOCUMENTARY'
  | 'VIDEO_ESSAY'
  | 'BUSINESS_CASE_STUDY'
  | 'HISTORY_DOCUMENTARY'
  | 'SCIENCE_EXPLAINER'
  | 'TECH_EXPLAINER'
  | 'SCREEN_TUTORIAL'
  | 'PRODUCT_COMPARISON'
  | 'COMMENTARY'
  | 'MEDIA_ANALYSIS'
  | 'STORY_MYSTERY'
  | 'LIST_ENTERTAINMENT'
  | 'DATA_STORY'
  | 'GAMEPLAY'
  | 'SHORT_FACT'
  | 'SHORT_STORY'
  | 'SHORT_COMMENTARY'
  | 'SHORT_VISUAL_SPECTACLE';

export interface ArchetypeConfig {
  archetype: Archetype;
  /** Default structure pattern (used as a starting point by the StoryEngine) */
  structurePattern: string;
  /** Typical shot rhythm in seconds — beats per minute of finished video */
  averageShotRhythm: number;
  /** Which asset types this archetype prefers, in priority order */
  assetPriorities: AssetType[];
  /** Caption style for this archetype */
  captionStyle: 'none' | 'selective' | 'phrase' | 'burned_in';
  /** Music mood profile */
  musicMood: MusicMood;
  /** Transition philosophy */
  transitionPhilosophy: 'hard_cut' | 'crossfade' | 'match_cut' | 'mixed';
  /** Hook strategy guidance */
  hookStrategy: string;
  /** Narration tone guidance */
  narrationTone: string;
  /** Typical ending structure */
  endingStructure: string;
  /** Long form (≥3min) or Short (≤60s) */
  format: 'longform' | 'short';
}

// ─── Asset types (Phase 15-16) ────────────────────────────────────
export type AssetType =
  | 'ORIGINAL_SCREEN_RECORDING'
  | 'ORIGINAL_GRAPHIC'
  | 'ORIGINAL_CHART'
  | 'ORIGINAL_MAP'
  | 'ORIGINAL_DIAGRAM'
  | 'PUBLIC_DOMAIN_VIDEO'
  | 'PUBLIC_DOMAIN_IMAGE'
  | 'CREATIVE_COMMONS'
  | 'LICENSED_STOCK'
  | 'WEBPAGE_CAPTURE'
  | 'DOCUMENT'
  | 'NEWS_HEADLINE'
  | 'DATASET'
  | 'ZAI_VIDEO'
  | 'ZAI_IMAGE'
  | 'EDITORIAL_EXCERPT';

export interface AssetManifest {
  id: string;
  type: AssetType;
  /** What story beat this asset belongs to */
  storyBeatId: string;
  /** Local file path after acquisition */
  localPath?: string;
  /** Original URL if sourced from the web */
  sourceUrl?: string;
  /** Creator / source attribution */
  creator?: string;
  /** License (CC-BY, public domain, editorial, etc.) */
  license?: string;
  /** Whether commercial use is allowed */
  commercialUse: boolean;
  /** Whether attribution is required */
  attributionRequired: boolean;
  /** When the asset was retrieved */
  retrievalDate: Date;
  /** Z.ai video task ID if ZAI_VIDEO */
  zaiTaskId?: string;
  /** Prompt used for generation (if ZAI_*) */
  generationPrompt?: string;
  /** Estimated generation cost in USD (if ZAI_*) */
  estimatedCost?: number;
  /** Asset metadata (width, height, duration, codec) */
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    codec?: string;
  };
}

// ─── Story beats (Phase 12) ───────────────────────────────────────
export type BeatPurpose =
  | 'HOOK'
  | 'SETUP'
  | 'QUESTION'
  | 'EVIDENCE'
  | 'ESCALATION'
  | 'CONTRADICTION'
  | 'REVEAL'
  | 'PAYOFF'
  | 'TRANSITION'
  | 'CALLBACK'
  | 'ENDING';

export interface StoryBeat {
  id: string;
  order: number;
  narration: string;
  purpose: BeatPurpose;
  /** The question currently in the viewer's head when this beat starts (null for the very first beat) */
  viewerQuestion: string | null;
  /** The new question this beat creates in the viewer's head (null for the ending) */
  newQuestion: string | null;
  /** What new information this beat delivers */
  newInformation: string;
  /** The intended emotional effect */
  emotionalIntent: string;
  /** What kind of visual belongs here */
  visualIntent: string;
  /** Preferred asset type (chart, map, screen recording, etc.) */
  preferredAssetType: AssetType;
  /** IDs of evidence sources this beat cites */
  evidenceSourceIds: string[];
  /** Sound design intent for this beat */
  soundIntent: string;
}

// ─── Visual script (Phase 13) ────────────────────────────────────
export interface VisualScriptEntry {
  beatId: string;
  voiceover: string;
  visual: string;
  purpose: string;
  source: string;
  edit: string;
  sound: string;
}

// ─── Edit decision list (Phase 21) ───────────────────────────────
export interface EditDecision {
  id: string;
  start: number;  // seconds
  end: number;   // seconds
  narrationText: string;
  assetId: string;
  visualPurpose: string;
  crop?: string;
  movement?: string;
  overlay?: string;
  transitionIn?: string;
  transitionOut?: string;
  musicCue?: string;
  sfx?: string;
  /**
   * MANDATORY — the human-readable reason this visual belongs on screen
   * while this narration is spoken. If the agent cannot articulate a reason,
   * the EDL entry must be REJECTED and re-planned.
   */
  reason: string;
}

// ─── Reporting brief (Phase 6) ────────────────────────────────────
export interface ReportingBrief {
  subject: string;
  angle: string;
  centralQuestion: string;
  viewerPromise: string;
  whyNow: string;
  targetViewer: string;
  whatViewerProbablyKnows: string[];
  whatIsSurprising: string[];
  mainConflict: string;
  mainPayoff: string;
  requiredEvidence: string[];
  possibleVisualOpportunities: string[];
  risks: string[];
  sources: Array<{ url: string; title: string; type: string }>;
}

// ─── Reference board (Phase 9) ───────────────────────────────────
export interface ReferenceBoardEntry {
  videoTitle: string;
  channel: string;
  concept: string;
  openingMechanism: string;
  storyStructure: string;
  duration: string;
  visualGrammar: string;
  editingDensity: string;
  thumbnailConcept: string;
  titleStructure: string;
  whatWorks: string;
  whatShouldNotBeCopied: string;
}

// ─── Idea funnel (Phase 8) ───────────────────────────────────────
export interface FunnelCandidate {
  id: string;
  subject: string;
  angle: string;
  /** Score 0-100 across 10 dimensions */
  scores: {
    viewerCuriosity: number;
    marketEvidence: number;
    novelty: number;
    visualPotential: number;
    storyPotential: number;
    productionFeasibility: number;
    competition: number;        // LOWER is better (less competition)
    monetizationPotential: number;
    evergreenValue: number;
    channelFit: number;
  };
  compositeScore: number;
  stage: 'raw' | 'potentially_interesting' | 'strong_angle' | 'strong_visual'
       | 'compelling_promise' | 'feasible' | 'production_candidate';
  eliminated?: boolean;
  eliminationReason?: string;
}

// ─── Performance script (Phase 26) ─────────────────────────────
export interface PerformanceInstruction {
  /** Markers like [pause 500ms], [emphasis], [quiet], [energy up] */
  marker: string;
  /** Position in the narration text (char offset) */
  position: number;
}

export interface PerformanceScript {
  beats: Array<{
    beatId: string;
    text: string;
    instructions: PerformanceInstruction[];
    /** Speech rate multiplier (0.8 = slower, 1.0 = normal, 1.2 = faster) */
    speed: number;
    /** Emotion tag for TTS */
    emotion: 'neutral' | 'curious' | 'serious' | 'energetic' | 'mysterious' | 'sad';
  }>;
}

// ─── Sound design (Phase 25) ────────────────────────────────────
export type MusicMood =
  | 'curious' | 'mysterious' | 'tense' | 'optimistic'
  | 'sad' | 'energetic' | 'comic' | 'neutral';

export interface SoundCue {
  start: number;          // seconds
  end?: number;           // seconds (omit for one-shot SFX)
  type: 'music' | 'sfx' | 'silence' | 'riser' | 'impact' | 'ambience';
  /** For music: the mood; for SFX: a description like "UI click" */
  label: string;
  /** Volume 0-1 */
  volume: number;
}

// ─── Thumbnail (Phase 34) ───────────────────────────────────────
export interface ThumbnailConcept {
  id: string;
  visualSubject: string;
  composition: string;
  emotion: string;
  background: string;
  textIfAny: string;
  curiosityMechanism: string;
  relationToTitle: string;
}

// ─── Title (Phase 35) ───────────────────────────────────────────
export interface TitleCandidate {
  id: string;
  title: string;
  clarity: number;
  curiosity: number;
  specificity: number;
  promise: number;
  topicAccuracy: number;
  novelty: number;
  thumbnailSynergy: number;
  overclaimingRisk: number;  // LOWER is better
  compositeScore: number;
}

// ─── Slop score (Phase 38) ──────────────────────────────────────
export interface SlopScore {
  total: number;             // LOWER is better
  threshold: number;         // videos above this FAIL
  passed: boolean;
  penalties: Array<{
    rule: string;
    points: number;
    occurrences: number;
    examples?: string[];
  }>;
}

// ─── Quality critic (Phase 37) ─────────────────────────────────
export interface QualityCriticReport {
  passed: boolean;
  overallScore: number;       // 0-100
  slopScore: SlopScore;
  inspections: Array<{
    category: string;
    score: number;
    findings: string[];
    evidence: string[];       // sampled frame paths + timestamps
  }>;
  recommendations: string[];
  sampledFrames: Array<{ timestamp: number; path: string; analysis: string }>;
}

// ─── Pipeline run state ────────────────────────────────────────
export type PipelineStage =
  | 'topic_discovery'
  | 'reference_research'
  | 'angle_discovery'
  | 'format_selection'
  | 'reporting_brief'
  | 'research_pack'
  | 'story_architecture'
  | 'visual_script'
  | 'paper_edit'
  | 'rough_cut'
  | 'critique'
  | 'asset_plan'
  | 'asset_acquisition'
  | 'edit_decision_list'
  | 'fine_cut'
  | 'sound_design'
  | 'quality_review'
  | 'thumbnail_title'
  | 'private_output'
  | 'publish'
  | 'analytics'
  | 'learn';

export interface PipelineRunState {
  videoProjectId: string;
  archetype: Archetype;
  stage: PipelineStage;
  startedAt: Date;
  completedStages: PipelineStage[];
  brief?: ReportingBrief;
  referenceBoard?: ReferenceBoardEntry[];
  beats?: StoryBeat[];
  visualScript?: VisualScriptEntry[];
  assets?: AssetManifest[];
  edl?: EditDecision[];
  soundCues?: SoundCue[];
  performanceScript?: PerformanceScript;
  thumbnailConcepts?: ThumbnailConcept[];
  titleCandidates?: TitleCandidate[];
  slopScore?: SlopScore;
  criticReport?: QualityCriticReport;
  errors: Array<{ stage: PipelineStage; error: string; timestamp: Date }>;
}
