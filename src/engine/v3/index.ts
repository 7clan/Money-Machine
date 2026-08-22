/**
 * V3 Content Engine — Public API
 */

export * from './types'
export { routeArchetype, getArchetypeConfig, ARCHETYPE_CONFIGS, ALL_ARCHETYPES } from './archetypes'
export { runIdeaFunnel, buildReportingBrief, buildReferenceBoard } from './reporting-brief'
export { buildStoryArchitecture, buildVisualScript } from './story-engine'
export { acquireAssets, cacheAsset, findReusableAsset } from './asset-sourcing'
export { generateVideo, generateVideosParallel } from './zai-video-provider'
export type { VideoGenerationRequest, VideoGenerationResult } from './zai-video-provider'
export { buildEditDecisionList, buildPerformanceScript, buildSoundDesign, generateNarrationAudio, getBeatDurations } from './edit-and-sound'
export { renderFromEDL } from './renderer-v3'
export type { RenderResultV3 } from './renderer-v3'
export { computeSlopScore, inspectRenderedVideo } from './quality-critic'
export { buildTitleEngine } from './title-engine'
export { buildThumbnailConcepts } from './thumbnail-engine'
export { generateCaptionsV3 } from './captions'
export { produceVideoV3, generateIdeaViaFunnel } from './creative-director'
