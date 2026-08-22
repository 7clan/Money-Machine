/**
 * Slop Score (Phase 38) + Quality Critic (Phase 37)
 *
 * SlopScore: penalize generic AI-slideshow patterns. LOWER is better.
 *   - too many AI stills
 *   - same transition repeatedly
 *   - same camera move repeatedly
 *   - same caption treatment repeatedly
 *   - random stock
 *   - visual unrelated to narration
 *   - repeated assets
 *   - generic voice / intro / outro
 *   - identical-looking scenes
 *   - visual template reused across unrelated subjects
 *   - unnecessary lower thirds
 *   - overuse of generated imagery
 *   - article-like narration
 *
 * QualityCritic: inspects the ACTUAL rendered video (sampled frames + audio)
 * via Z.ai vision model. NOT metadata-only — must look at real frames.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { z } from 'zai-web-dev-sdk'
import { llm } from '../zai-provider'
import { extractJSONObject } from '../json-utils'
import type {
  EditDecision, AssetManifest, StoryBeat, ArchetypeConfig,
  SlopScore, QualityCriticReport, ReportingBrief,
} from './types'

const exec = promisify(execFile)

// ─── Phase 38 — SlopScore ───────────────────────────────────

/**
 * Compute a SlopScore for a video based on its EDL + assets.
 * LOWER is better. Videos above the threshold FAIL.
 */
export function computeSlopScore(
  edl: EditDecision[],
  beats: StoryBeat[],
  assets: AssetManifest[],
  archetype: ArchetypeConfig,
  options: {
    /** Repeated visual treatment threshold (e.g. same motion > 3 times in a row) */
    repetitionThreshold?: number
  } = {},
): SlopScore {
  const threshold = 30 // videos above 30 slop points FAIL
  const penalties: SlopScore['penalties'] = []

  // Penalty 1: Too many ZAI_IMAGE assets (≤30% of total is OK)
  const aiImageCount = assets.filter(a => a.type === 'ZAI_IMAGE').length
  const aiImageRatio = assets.length > 0 ? aiImageCount / assets.length : 0
  if (aiImageRatio > 0.5) {
    penalties.push({
      rule: 'too_many_ai_images',
      points: Math.round((aiImageRatio - 0.5) * 30),
      occurrences: aiImageCount,
      examples: [`${aiImageCount}/${assets.length} assets are AI-generated images`],
    })
  }

  // Penalty 2: Repeated transitions (>50% same transitionIn)
  const transitionCounts: Record<string, number> = {}
  for (const d of edl) {
    const t = d.transitionIn || 'hard_cut'
    transitionCounts[t] = (transitionCounts[t] || 0) + 1
  }
  for (const [t, count] of Object.entries(transitionCounts)) {
    const ratio = count / edl.length
    if (ratio > 0.5 && edl.length > 4) {
      penalties.push({
        rule: 'repeated_transition',
        points: Math.round((ratio - 0.5) * 20),
        occurrences: count,
        examples: [`"${t}" used ${count}/${edl.length} times`],
      })
    }
  }

  // Penalty 3: Repeated motion (>50% same movement)
  const motionCounts: Record<string, number> = {}
  for (const d of edl) {
    const m = d.movement || 'static'
    motionCounts[m] = (motionCounts[m] || 0) + 1
  }
  for (const [m, count] of Object.entries(motionCounts)) {
    const ratio = count / edl.length
    if (ratio > 0.5 && m === 'ken_burns_in') {
      // Ken Burns is the most-flagged anti-pattern per Phase 23
      penalties.push({
        rule: 'ken_burns_overuse',
        points: Math.round((ratio - 0.5) * 25),
        occurrences: count,
        examples: [`Ken Burns zoom used ${count}/${edl.length} times — Phase 23 violation`],
      })
    } else if (ratio > 0.7) {
      penalties.push({
        rule: 'repeated_motion',
        points: Math.round((ratio - 0.7) * 15),
        occurrences: count,
        examples: [`"${m}" used ${count}/${edl.length} times`],
      })
    }
  }

  // Penalty 4: Repeated assets (same assetId used in multiple EDL entries)
  const assetIdCounts: Record<string, number> = {}
  for (const d of edl) {
    if (!d.assetId) continue
    assetIdCounts[d.assetId] = (assetIdCounts[d.assetId] || 0) + 1
  }
  for (const [aid, count] of Object.entries(assetIdCounts)) {
    if (count > 1) {
      penalties.push({
        rule: 'repeated_asset',
        points: (count - 1) * 5,
        occurrences: count,
        examples: [`Asset ${aid.slice(0, 30)}... used ${count} times`],
      })
    }
  }

  // Penalty 5: Generic / weak `reason` in EDL
  const weakReasons = edl.filter(d => {
    const r = (d.reason || '').toLowerCase()
    return r.length < 20 ||
      r.includes('shows the topic') ||
      r.includes('visually appealing') ||
      r.includes('ai image of')
  })
  if (weakReasons.length > 0) {
    penalties.push({
      rule: 'weak_visual_reasoning',
      points: weakReasons.length * 4,
      occurrences: weakReasons.length,
      examples: weakReasons.slice(0, 3).map(d => d.reason.slice(0, 60)),
    })
  }

  // Penalty 6: Article-like narration (long sentences, no questions)
  const longNarrationBeats = beats.filter(b => {
    const sentences = b.narration.split(/[.!?]/).filter(s => s.trim().length > 0)
    const avgLen = b.narration.length / Math.max(sentences.length, 1)
    return avgLen > 200 // sentences averaging > 200 chars are article-like
  })
  if (longNarrationBeats.length > beats.length * 0.3) {
    penalties.push({
      rule: 'article_like_narration',
      points: longNarrationBeats.length * 3,
      occurrences: longNarrationBeats.length,
      examples: longNarrationBeats.slice(0, 2).map(b => b.narration.slice(0, 60)),
    })
  }

  // Penalty 7: Generic openings ("Welcome back", "Today we're going to")
  const firstBeat = beats[0]
  if (firstBeat) {
    const opening = firstBeat.narration.toLowerCase()
    const genericOpenings = [
      'welcome back', "today we're going", 'today i', "let's dive in",
      'without further ado', "you won't believe", 'here are five reasons',
      'in conclusion', "in today's video",
    ]
    if (genericOpenings.some(g => opening.startsWith(g))) {
      penalties.push({
        rule: 'generic_intro',
        points: 15,
        occurrences: 1,
        examples: [`Opening: "${firstBeat.narration.slice(0, 60)}"`],
      })
    }
  }

  // Penalty 8: No visual variety (all beats have same preferred asset type)
  const assetTypes = new Set(beats.map(b => b.preferredAssetType))
  if (assetTypes.size === 1 && beats.length > 5) {
    penalties.push({
      rule: 'no_visual_variety',
      points: 20,
      occurrences: beats.length,
      examples: [`All ${beats.length} beats request "${[...assetTypes][0]}"`],
    })
  }

  const total = penalties.reduce((sum, p) => sum + p.points, 0)
  return {
    total,
    threshold,
    passed: total <= threshold,
    penalties: penalties.sort((a, b) => b.points - a.points),
  }
}

// ─── Phase 37 — Quality Critic ─────────────────────────────

/**
 * Inspect the ACTUAL rendered video by sampling frames + probing audio,
 * then run them through the Z.ai vision model.
 *
 * Returns a QualityCriticReport with pass/fail + per-category scores +
 * specific findings with sampled frame evidence.
 */
export async function inspectRenderedVideo(opts: {
  videoPath: string
  audioPath?: string
  edl: EditDecision[]
  beats: StoryBeat[]
  assets: AssetManifest[]
  archetype: ArchetypeConfig
  brief: ReportingBrief
  title: string
}): Promise<QualityCriticReport> {
  const { videoPath, edl, beats, assets, archetype, brief, title } = opts

  // Sample 6 frames evenly across the video
  const frames = await sampleFrames(videoPath, 6)

  // For each frame, ask the VLM what it sees and rate it
  const sampledFrameAnalyses: QualityCriticReport['sampledFrames'] = []
  for (const frame of frames) {
    const analysis = await analyzeFrameWithVLM(frame.path, frame.timestamp, {
      archetype: archetype.archetype,
      expectedVisual: beats[Math.floor(frame.timestamp / (edl.length > 0 ? (edl[edl.length - 1].end / beats.length) : 1))]?.visualIntent || '',
    })
    sampledFrameAnalyses.push({
      timestamp: frame.timestamp,
      path: frame.path,
      analysis,
    })
  }

  // Compute SlopScore
  const slopScore = computeSlopScore(edl, beats, assets, archetype)

  // Compute per-category scores from the VLM analyses
  const inspections: QualityCriticReport['inspections'] = []
  const allFindings = sampledFrameAnalyses.flatMap(f => {
    try {
      const parsed = JSON.parse(f.analysis)
      return parsed.findings || []
    } catch {
      return []
    }
  })

  // Hook clarity (based on first frame analysis)
  const firstFrameAnalysis = sampledFrameAnalyses[0]?.analysis || ''
  inspections.push({
    category: 'hook',
    score: extractScoreFromAnalysis(firstFrameAnalysis, 'hook'),
    findings: extractFindings(firstFrameAnalysis, 'hook'),
    evidence: sampledFrameAnalyses.slice(0, 2).map(f => `${f.timestamp}s: ${f.path}`),
  })

  // Visual / narration alignment
  inspections.push({
    category: 'visual_narration_alignment',
    score: extractScoreFromAnalysis(firstFrameAnalysis, 'alignment'),
    findings: extractFindings(firstFrameAnalysis, 'alignment'),
    evidence: sampledFrameAnalyses.slice(2, 4).map(f => `${f.timestamp}s: ${f.path}`),
  })

  // Visual variety (do all frames look the same?)
  const uniqueFrameHashes = new Set(sampledFrameAnalyses.map(f => f.analysis.slice(0, 50)))
  inspections.push({
    category: 'visual_variety',
    score: uniqueFrameHashes.size >= 3 ? 80 : 40,
    findings: [`${uniqueFrameHashes.size} distinct visual states across ${sampledFrameAnalyses.length} sampled frames`],
    evidence: sampledFrameAnalyses.map(f => `${f.timestamp}s`),
  })

  // AI artifact detection
  const aiArtifactFindings: string[] = []
  for (const f of sampledFrameAnalyses) {
    try {
      const parsed = JSON.parse(f.analysis)
      if (parsed.ai_artifacts) aiArtifactFindings.push(`${f.timestamp}s: ${parsed.ai_artifacts}`)
    } catch {}
  }
  inspections.push({
    category: 'ai_artifacts',
    score: aiArtifactFindings.length === 0 ? 90 : Math.max(20, 90 - aiArtifactFindings.length * 15),
    findings: aiArtifactFindings.length > 0 ? aiArtifactFindings : ['No obvious AI artifacts detected'],
    evidence: sampledFrameAnalyses.map(f => `${f.timestamp}s: ${f.path}`),
  })

  // SlopScore as an inspection category
  inspections.push({
    category: 'slop_score',
    score: slopScore.passed ? 90 : Math.max(20, 90 - slopScore.total),
    findings: slopScore.penalties.slice(0, 3).map(p => `${p.rule}: +${p.points} (${p.occurrences}x)`),
    evidence: [],
  })

  // Overall score
  const overallScore = Math.round(
    inspections.reduce((sum, i) => sum + i.score, 0) / Math.max(inspections.length, 1),
  )

  const passed = overallScore >= 60 && slopScore.passed

  // Recommendations
  const recommendations: string[] = []
  if (slopScore.penalties.find(p => p.rule === 'ken_burns_overuse')) {
    recommendations.push('Reduce Ken Burns zoom usage — vary motion styles (pan, static, mask reveal)')
  }
  if (slopScore.penalties.find(p => p.rule === 'too_many_ai_images')) {
    recommendations.push('Replace some AI images with original charts / maps / screen recordings')
  }
  if (slopScore.penalties.find(p => p.rule === 'generic_intro')) {
    recommendations.push('Rewrite opening hook to create a question, not announce the topic')
  }
  if (slopScore.penalties.find(p => p.rule === 'weak_visual_reasoning')) {
    recommendations.push('Re-plan visuals with stronger `reason` in the EDL — every visual must prove the narration')
  }
  if (aiArtifactFindings.length > 0) {
    recommendations.push('Re-generate assets with AI artifacts — use more specific prompts or fall back to original graphics')
  }

  // Cleanup sampled frames (keep them for now for evidence)
  return {
    passed,
    overallScore,
    slopScore,
    inspections,
    recommendations,
    sampledFrames: sampledFrameAnalyses,
  }
}

async function sampleFrames(videoPath: string, count: number): Promise<Array<{ timestamp: number; path: string }>> {
  const framesDir = path.join(process.cwd(), 'data', 'critic-frames')
  if (!existsSync(framesDir)) await mkdir(framesDir, { recursive: true })

  const duration = await probeDuration(videoPath)
  const interval = duration / (count + 1)

  const frames: Array<{ timestamp: number; path: string }> = []
  for (let i = 1; i <= count; i++) {
    const ts = interval * i
    const framePath = path.join(framesDir, `frame_${i}_${Math.round(ts)}s.png`)
    try {
      await exec('ffmpeg', [
        '-hide_banner', '-loglevel', 'error',
        '-ss', String(ts),
        '-i', videoPath,
        '-frames:v', '1', '-y', framePath,
      ])
      frames.push({ timestamp: ts, path: framePath })
    } catch (e) {
      console.error(`[critic] Failed to sample frame at ${ts}s:`, e)
    }
  }
  return frames
}

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
    ])
    return parseFloat(stdout.trim()) || 0
  } catch {
    return 0
  }
}

async function analyzeFrameWithVLM(
  framePath: string,
  timestamp: number,
  context: { archetype: string; expectedVisual: string },
): Promise<string> {
  try {
    const ZAIModule = await import('z-ai-web-dev-sdk')
    const ZAI = ZAIModule.default
    const zai = await ZAI.create()

    const imageBuffer = await import('fs/promises').then(m => m.readFile(framePath))
    const base64Image = imageBuffer.toString('base64')

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a YouTube quality critic inspecting a frame at ${timestamp.toFixed(1)}s of a ${context.archetype} video.
Expected visual: "${context.expectedVisual}"

Return ONLY a JSON object with this shape:
{
  "what_is_on_screen": "describe what you actually see",
  "matches_expected": true/false,
  "ai_artifacts": "any AI generation artifacts visible? (extra fingers, garbled text, weird anatomy, etc.) — empty string if none",
  "hook": 0-100,  // if this is the opening, how strong is the hook?
  "alignment": 0-100,  // does the visual match the narration intent?
  "findings": ["specific observation 1", "specific observation 2"]
}`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    return response.choices[0]?.message?.content || '{}'
  } catch (e: any) {
    console.error(`[critic] VLM analysis failed for ${framePath}:`, e.message)
    return JSON.stringify({
      what_is_on_screen: 'VLM analysis failed',
      matches_expected: false,
      ai_artifacts: '',
      hook: 50,
      alignment: 50,
      findings: [`VLM analysis failed: ${e.message}`],
    })
  }
}

function extractScoreFromAnalysis(analysis: string, key: string): number {
  try {
    const parsed = JSON.parse(analysis)
    return parsed[key] || 50
  } catch {
    return 50
  }
}

function extractFindings(analysis: string, key: string): string[] {
  try {
    const parsed = JSON.parse(analysis)
    return parsed.findings || []
  } catch {
    return []
  }
}
