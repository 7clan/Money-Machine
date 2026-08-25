/**
 * Artifact Schemas — structured contracts between agents
 *
 * Agents communicate through these artifacts, not conversation prose.
 * Every artifact is validated against its schema before acceptance.
 */

export interface OpportunityBrief {
  topic: string
  references: Array<{
    title: string
    url: string
    channel: string
    views?: number
    publishDate?: string
    whySelected: string
    patternLearned: string
  }>
  sources: Array<{
    url: string
    title: string
    type: string
    reliability: 'high' | 'medium' | 'low'
  }>
  audienceQuestions: string[]
  breakoutVideos: Array<{
    title: string
    channel: string
    views: number
    channelBaseline: number
    breakoutRatio: number
  }>
}

export interface CandidateIdea {
  id: string
  subject: string
  angle: string
  viewerPromise: string
  scores: {
    novelty: number
    visualPotential: number
    productionFeasibility: number
    monetization: number
    channelFit: number
  }
  requiredCapabilities: string[]
  productionFeasible: boolean
  feasibilityBlocked: string[]
}

export interface FormatSelection {
  archetype: string
  reason: string
  capabilitiesAvailable: Record<string, boolean>
  capabilitiesRequired: string[]
  blocked: boolean
  blockedReason?: string
}

export interface Script {
  id: string
  segments: Array<{
    id: string
    type: 'HOOK' | 'SETUP' | 'TRICK' | 'SECTION' | 'PAYOFF' | 'ENDING'
    narration: string
    screenAction: string
    expectedResult: string
    visualPurpose: string
  }>
  archetype: string
  tone: string
  targetDuration: number
}

export interface VisualShot {
  id: string
  segmentId: string
  start: number
  end: number
  duration: number
  type: string
  assetId?: string
  purpose: string
  animation?: string
  isRawVideo: boolean
  isScreenshot: boolean
}

export interface AssetManifest {
  assets: Array<{
    id: string
    type: string
    sourceUrl?: string
    creator?: string
    license?: string
    localPath: string
    beatId?: string
    reasonForUse: string
    provenance: 'real' | 'generated' | 'original'
  }>
}

export interface QCReport {
  verdict: 'PASS' | 'FAIL' | 'BLOCKED'
  scores: Record<string, number>
  failingShots: Array<{
    shotId: string
    timestamp: number
    issue: string
    recommendation: string
  }>
  fakeUICount: number
  realUIPercentage: number
  rawVideoPercentage: number
  staticScreenshotPercentage: number
}

export interface FactCheckReport {
  verdict: 'PASS' | 'FAIL'
  claims: Array<{
    claim: string
    supported: boolean
    source?: string
    issue?: string
  }>
  unsupportedCount: number
}

export interface ProductionCapabilityRegistry {
  host: string
  capabilities: {
    BROWSER_PAGE_CAPTURE: boolean
    WEB_APP_INTERACTION: boolean
    DEVTOOLS_CAPTURE: boolean
    BROWSER_CHROME_CAPTURE: boolean
    DESKTOP_APP_CAPTURE: boolean
    WINDOWS_CAPTURE: boolean
    MACOS_CAPTURE: boolean
    FFMPEG: boolean
    REMOTION: boolean
    ZAI_TEXT: boolean
    ZAI_IMAGE: boolean
    ZAI_VIDEO: boolean
    TTS: boolean
    WEB_RESEARCH: boolean
    REAL_MEDIA_DOWNLOAD: boolean
    SCREENSHOT_CAPTURE: boolean
    XVFB_DISPLAY: boolean
  }
  chromiumVersion?: string
}

export interface RenderLock {
  renderId: string
  composition: string
  pid: number
  startedAt: string
  output: string
  creativeVersion: string
  active: boolean
}
