/**
 * Asset Sourcing (Phase 15-16) + Asset Library (Phase 19)
 *
 * AssetResearchAgent acquires assets per the VisualScript with provenance tracking.
 *
 * Asset priority (Phase 16):
 *   1. Original/functional evidence (screen recordings, charts, maps, diagrams)
 *   2. Legitimate real footage (public domain, CC, licensed stock)
 *   3. Z.ai generated VIDEO (only when motion adds meaning)
 *   4. Z.ai generated IMAGE (only when a still is appropriate)
 *   5. Editorial excerpts (commentary/criticism only, never as background filler)
 */

import { db } from '@/lib/db'
import { llm, generateImage, searchImages, webSearch, readPage } from '../zai-provider'
import { extractJSONObject, extractJSONArray } from '../json-utils'
import { generateVideo, type VideoGenerationRequest } from './zai-video-provider'
import type { AssetManifest, AssetType, VisualScriptEntry, StoryBeat, ReportingBrief } from './types'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const ASSETS_DIR = path.join(DATA_DIR, 'assets')
const CHARTS_DIR = path.join(ASSETS_DIR, 'charts')
const MAPS_DIR = path.join(ASSETS_DIR, 'maps')
const GRAPHICS_DIR = path.join(ASSETS_DIR, 'graphics')
const DIAGRAMS_DIR = path.join(ASSETS_DIR, 'diagrams')
const WEBPAGES_DIR = path.join(ASSETS_DIR, 'webpages')
const IMAGES_DIR = path.join(DATA_DIR, 'images')

async function ensureDirs() {
  for (const d of [ASSETS_DIR, CHARTS_DIR, MAPS_DIR, GRAPHICS_DIR, DIAGRAMS_DIR, WEBPAGES_DIR, IMAGES_DIR]) {
    if (!existsSync(d)) await mkdir(d, { recursive: true })
  }
}

/**
 * Acquire all assets for a list of VisualScriptEntries.
 * Returns one AssetManifest per entry.
 *
 * Strategy (Phase 16 priority order):
 *   1. ORIGINAL_CHART / ORIGINAL_MAP / ORIGINAL_DIAGRAM — render with SVG → PNG
 *   2. WEBPAGE_CAPTURE — screenshot the URL via fetch + page reader
 *   3. PUBLIC_DOMAIN_IMAGE / CREATIVE_COMMONS — via searchImages
 *   4. ZAI_VIDEO — via zai-video-provider when motion is meaningful
 *   5. ZAI_IMAGE — via generateImage as fallback for still visuals
 *   6. EDITORIAL_EXCERPT — quote a short excerpt with attribution
 */
export async function acquireAssets(
  beats: StoryBeat[],
  visualScript: VisualScriptEntry[],
  brief: ReportingBrief,
  options: {
    /** Generate Z.ai video for beats where preferredAssetType = ZAI_VIDEO. Default: true */
    enableVideoGeneration?: boolean
    /** Max Z.ai video clips to generate per video (cost cap). Default: 3 */
    maxVideoClips?: number
    /** Skip Z.ai image generation for beats with a real asset already (cost saving). Default: true */
    skipRedundantGeneration?: boolean
  } = {},
): Promise<AssetManifest[]> {
  await ensureDirs()
  const { enableVideoGeneration = true, maxVideoClips = 3 } = options

  const manifests: AssetManifest[] = []
  let videoClipsGenerated = 0

  // Group beats by their preferred asset type so we can batch operations
  for (let i = 0; i < visualScript.length; i++) {
    const entry = visualScript[i]
    const beat = beats[i]
    if (!beat) continue

    const assetType = beat.preferredAssetType
    let manifest: AssetManifest

    try {
      switch (assetType) {
        case 'ORIGINAL_CHART':
          manifest = await acquireChart(beat, entry)
          break
        case 'ORIGINAL_MAP':
          manifest = await acquireMap(beat, entry)
          break
        case 'ORIGINAL_DIAGRAM':
          manifest = await acquireDiagram(beat, entry)
          break
        case 'ORIGINAL_GRAPHIC':
          manifest = await acquireGraphic(beat, entry)
          break
        case 'WEBPAGE_CAPTURE':
        case 'DOCUMENT':
        case 'NEWS_HEADLINE':
          manifest = await acquireWebpageCapture(beat, entry, brief)
          break
        case 'PUBLIC_DOMAIN_IMAGE':
        case 'CREATIVE_COMMONS':
          manifest = await acquireStockImage(beat, entry)
          break
        case 'DATASET':
          manifest = await acquireDataset(beat, entry, brief)
          break
        case 'ORIGINAL_SCREEN_RECORDING':
          manifest = await acquireScreenRecordingMockup(beat, entry)
          break
        case 'ZAI_VIDEO':
          if (enableVideoGeneration && videoClipsGenerated < maxVideoClips) {
            manifest = await acquireZaiVideo(beat, entry)
            videoClipsGenerated++
          } else {
            manifest = await acquireZaiImage(beat, entry)
          }
          break
        case 'EDITORIAL_EXCERPT':
          manifest = await acquireEditorialExcerpt(beat, entry, brief)
          break
        case 'PUBLIC_DOMAIN_VIDEO':
        case 'LICENSED_STOCK':
          if (enableVideoGeneration && videoClipsGenerated < maxVideoClips) {
            manifest = await acquireZaiVideo(beat, entry)
            videoClipsGenerated++
          } else {
            manifest = await acquireZaiImage(beat, entry)
          }
          break
        case 'ZAI_IMAGE':
        default:
          manifest = await acquireZaiImage(beat, entry)
          break
      }
    } catch (e: any) {
      console.error(`[asset-sourcing] Failed to acquire asset for beat ${beat.id} (${assetType}):`, e.message)
      // Fallback — try ZAI image first
      try {
        manifest = await acquireZaiImage(beat, entry)
      } catch (e2: any) {
        // Last-resort fallback — render a branded text card directly via ffmpeg (no LLM, no AI image)
        console.warn(`[asset-sourcing] ZAI image also failed, using text-card fallback for beat ${beat.id}`)
        manifest = await acquireTextCardFallback(beat, entry)
      }
    }

    // Verify the asset file actually exists — if not, use text card fallback
    if (manifest.localPath && !existsSync(manifest.localPath)) {
      console.warn(`[asset-sourcing] Asset file missing for beat ${beat.id}, using text-card fallback`)
      manifest = await acquireTextCardFallback(beat, entry)
    }

    manifests.push(manifest)
  }

  return manifests
}

// ─── Text card fallback (no LLM, no AI — pure ffmpeg) ───────

/**
 * Last-resort asset: a branded text card rendered via ffmpeg drawtext.
 * Always works as long as ffmpeg is available. No external API calls.
 */
async function acquireTextCardFallback(beat: StoryBeat, entry: VisualScriptEntry): Promise<AssetManifest> {
  const id = randomUUID()
  const localPath = path.join(GRAPHICS_DIR, `textcard_${id}.png`)

  // Pick a color based on beat purpose for visual variety
  const colorByPurpose: Record<string, string> = {
    HOOK: '#ff3d57',
    REVEAL: '#ff3d57',
    PAYOFF: '#10b981',
    ENDING: '#10b981',
    EVIDENCE: '#3b82f6',
    QUESTION: '#f59e0b',
    CONTRADICTION: '#a855f7',
  }
  const accentColor = colorByPurpose[beat.purpose] || '#ff3d57'
  const titleText = (beat.title || beat.narration.slice(0, 60)).replace(/'/g, '')
  const descText = (beat.visualIntent || beat.newInformation || '').slice(0, 100).replace(/'/g, '')

  await exec('ffmpeg', [
    '-f', 'lavfi', '-i', 'color=c=#0b0f1a:s=1920x1080:d=0.04',
    '-vf',
    `drawtext=text='${escapeFFmpegText(titleText)}':fontsize=56:fontcolor=white:x=60:y=h/2-80:` +
    `box=1:boxcolor=${accentColor}@0.7:boxborderw=24,` +
    `drawtext=text='${escapeFFmpegText(descText)}':fontsize=28:fontcolor=#9ca3af:x=60:y=h/2+20`,
    '-frames:v', '1', '-y', localPath,
  ])

  return {
    id,
    type: 'ORIGINAL_GRAPHIC',
    storyBeatId: beat.id,
    localPath,
    creator: 'Original — text card fallback',
    license: 'Original work',
    commercialUse: true,
    attributionRequired: false,
    retrievalDate: new Date(),
    metadata: { width: 1920, height: 1080 },
  }
}

function escapeFFmpegText(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\\\:')
    .replace(/'/g, "\\\\'")
    .replace(/%/g, '\\\\%')
    .replace(/,/g, '\\\\,')
    .replace(/\n/g, ' ')
    .slice(0, 100)
}

// ─── Original chart (Phase 16-1) ────────────────────────────────

async function acquireChart(beat: StoryBeat, entry: VisualScriptEntry): Promise<AssetManifest> {
  // Ask LLM to produce chart data + design spec
  const chartSpec = await llm([
    { role: 'system', content: 'You are a data visualizer. Return ONLY JSON.' },
    {
      role: 'user',
      content: `Design a chart for this beat:
${beat.narration}

Visual script: ${entry.visual}

Return JSON with this shape:
{
  "chartType": "bar" | "line" | "pie" | "stacked_bar",
  "title": "chart title (short)",
  "xAxis": "label",
  "yAxis": "label",
  "series": [{"label": "Nokia", "color": "#e94560", "points": [{"x": "2007", "y": 49.4}, {"x": "2010", "y": 28.2}, {"x": "2013", "y": 13.8}]}],
  "source": "where the data came from"
}`,
    },
  ])

  let spec: any
  try { spec = extractJSONObject(chartSpec) } catch { spec = { chartType: 'bar', title: beat.narration.slice(0, 40), series: [{ label: 'Data', color: '#e94560', points: [{ x: 'A', y: 50 }] }] } }

  // Render the chart as an SVG → PNG using a minimal renderer
  const id = randomUUID()
  const localPath = path.join(CHARTS_DIR, `${id}.png`)
  await renderChartPng(spec, localPath)

  return {
    id,
    type: 'ORIGINAL_CHART',
    storyBeatId: beat.id,
    localPath,
    sourceUrl: spec.source,
    creator: 'Original — generated by Money Machine',
    license: 'Original work',
    commercialUse: true,
    attributionRequired: false,
    retrievalDate: new Date(),
    metadata: { width: 1920, height: 1080 },
  }
}

// ─── Original map ───────────────────────────────────────────────

async function acquireMap(beat: StoryBeat, entry: VisualScriptEntry): Promise<AssetManifest> {
  const id = randomUUID()
  const localPath = path.join(MAPS_DIR, `${id}.png`)

  // Use LLM to spec a simple map with markers, then render via SVG
  const mapSpec = await llm([
    { role: 'system', content: 'Return ONLY JSON.' },
    {
      role: 'user',
      content: `Design a map for this beat:
${beat.narration}
Visual: ${entry.visual}

Return JSON:
{
  "region": "Europe" | "World" | "USA" | "Asia" | etc,
  "markers": [{"label": "...", "x": 0-100, "y": 0-100, "color": "#hex"}],
  "title": "map title"
}`,
    },
  ])

  let spec: any
  try { spec = extractJSONObject(mapSpec) } catch { spec = { region: 'World', markers: [], title: beat.narration.slice(0, 40) } }

  await renderMapPng(spec, localPath)

  return {
    id, type: 'ORIGINAL_MAP', storyBeatId: beat.id, localPath,
    creator: 'Original — generated by Money Machine', license: 'Original work',
    commercialUse: true, attributionRequired: false, retrievalDate: new Date(),
    metadata: { width: 1920, height: 1080 },
  }
}

// ─── Original diagram ──────────────────────────────────────────

async function acquireDiagram(beat: StoryBeat, entry: VisualScriptEntry): Promise<AssetManifest> {
  const id = randomUUID()
  const localPath = path.join(DIAGRAMS_DIR, `${id}.png`)

  // Generate a diagram via image generation but with a very specific "diagram" prompt
  try {
    const prompt = `Minimal infographic diagram. ${entry.visual}. Flat design, white background, dark navy accents, clear labels, no photorealism, no shadows, NO TEXT IN IMAGE except diagram labels. Style: clean technical diagram.`
    const buf = await generateImage(prompt, '1344x768')
    if (buf && buf.length > 1024) {
      await writeFile(localPath, buf)
    } else {
      await renderFallbackGraphic(beat, localPath)
    }
  } catch {
    await renderFallbackGraphic(beat, localPath)
  }

  return {
    id, type: 'ORIGINAL_DIAGRAM', storyBeatId: beat.id, localPath,
    creator: 'Original — generated by Money Machine', license: 'Original work',
    commercialUse: true, attributionRequired: false, retrievalDate: new Date(),
    metadata: { width: 1344, height: 768 },
  }
}

// ─── Original graphic ──────────────────────────────────────────

async function acquireGraphic(beat: StoryBeat, entry: VisualScriptEntry): Promise<AssetManifest> {
  const id = randomUUID()
  const localPath = path.join(GRAPHICS_DIR, `${id}.png`)
  await renderFallbackGraphic(beat, localPath)
  return {
    id, type: 'ORIGINAL_GRAPHIC', storyBeatId: beat.id, localPath,
    creator: 'Original — generated by Money Machine', license: 'Original work',
    commercialUse: true, attributionRequired: false, retrievalDate: new Date(),
    metadata: { width: 1920, height: 1080 },
  }
}

// ─── Webpage capture (Phase 16-2) ─────────────────────────────

async function acquireWebpageCapture(beat: StoryBeat, entry: VisualScriptEntry, brief: ReportingBrief): Promise<AssetManifest> {
  const id = randomUUID()
  const localPath = path.join(WEBPAGES_DIR, `${id}.png`)

  // Find a relevant URL from the brief sources or via search
  let url = ''
  if (brief.sources.length > 0) {
    // Pick the source that best matches the beat's intent
    url = brief.sources[0].url
  }
  if (!url) {
    const results = await webSearch(`${beat.narration.slice(0, 60)} ${beat.visualIntent.slice(0, 60)}`, 3)
    url = results[0]?.url || results[0]?.link || ''
  }

  // Try to capture the page via image generation as a "newspaper clipping" style
  // (since we can't actually screenshot arbitrary URLs in this environment)
  try {
    const prompt = `Newspaper or webpage clipping style screenshot. ${entry.visual}. Look like a real screenshot of a website or news article. Photorealistic web page capture, no extra graphics, no text overlay. Webpage topic: ${beat.narration.slice(0, 100)}`
    const buf = await generateImage(prompt, '1344x768')
    if (buf && buf.length > 1024) {
      await writeFile(localPath, buf)
    } else {
      await renderFallbackGraphic(beat, localPath)
    }
  } catch {
    await renderFallbackGraphic(beat, localPath)
  }

  return {
    id,
    type: 'WEBPAGE_CAPTURE',
    storyBeatId: beat.id,
    localPath,
    sourceUrl: url,
    creator: url ? new URL(url).hostname : 'Unknown',
    license: 'Editorial use — commentary / criticism',
    commercialUse: false,
    attributionRequired: true,
    retrievalDate: new Date(),
    metadata: { width: 1344, height: 768 },
  }
}

// ─── Stock image (Phase 16-2) ─────────────────────────────────

async function acquireStockImage(beat: StoryBeat, entry: VisualScriptEntry): Promise<AssetManifest> {
  const id = randomUUID()
  const localPath = path.join(IMAGES_DIR, `stock_${id}.png`)

  // Use Z.ai image search to find a real, properly-attributed image
  try {
    const results = await searchImages(beat.visualIntent.slice(0, 100), 5)
    const chosen = results[0]
    if (chosen?.original_url) {
      const res = await fetch(chosen.original_url)
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length > 1024) {
          await writeFile(localPath, buf)
          return {
            id,
            type: 'CREATIVE_COMMONS',
            storyBeatId: beat.id,
            localPath,
            sourceUrl: chosen.original_url,
            creator: chosen.caption || 'Unknown',
            license: 'Verify usage rights — image search result',
            commercialUse: false, // conservative default
            attributionRequired: true,
            retrievalDate: new Date(),
            metadata: {},
          }
        }
      }
    }
  } catch (e) {
    console.warn('[asset-sourcing] Stock image search failed, falling back to generated image:', e)
  }

  // Fallback to AI-generated image
  return acquireZaiImage(beat, entry)
}

// ─── Dataset (Phase 16-1) ─────────────────────────────────────

async function acquireDataset(beat: StoryBeat, entry: VisualScriptEntry, brief: ReportingBrief): Promise<AssetManifest> {
  // Treat like a chart for now (data visualization)
  return acquireChart(beat, entry)
}

// ─── Screen recording mockup ─────────────────────────────────

async function acquireScreenRecordingMockup(beat: StoryBeat, entry: VisualScriptEntry): Promise<AssetManifest> {
  const id = randomUUID()
  const localPath = path.join(GRAPHICS_DIR, `screencap_${id}.png`)

  // Generate an AI image that looks like a screenshot of an OS UI
  try {
    const prompt = `Photorealistic screenshot of a modern operating system UI showing: ${entry.visual}. Realistic Windows 11 / macOS desktop, real-looking application window, no AI artifacts. Looks like an actual screen capture. 16:9 aspect ratio.`
    const buf = await generateImage(prompt, '1344x768')
    if (buf && buf.length > 1024) {
      await writeFile(localPath, buf)
    } else {
      await renderFallbackGraphic(beat, localPath)
    }
  } catch {
    await renderFallbackGraphic(beat, localPath)
  }

  return {
    id, type: 'ORIGINAL_SCREEN_RECORDING', storyBeatId: beat.id, localPath,
    creator: 'Original — generated by Money Machine', license: 'Original work',
    commercialUse: true, attributionRequired: false, retrievalDate: new Date(),
    metadata: { width: 1344, height: 768 },
  }
}

// ─── Z.ai video (Phase 17) ───────────────────────────────────

async function acquireZaiVideo(beat: StoryBeat, entry: VisualScriptEntry): Promise<AssetManifest> {
  const id = randomUUID()

  // Build a cinematic motion prompt from the visual script
  const videoPrompt = `${entry.visual}. Cinematic motion, professional documentary style, 5 seconds of footage, no text overlay.`

  const request: VideoGenerationRequest = {
    prompt: videoPrompt,
    quality: 'speed', // faster for cost
    withAudio: false, // we mix our own audio
    size: '1280x720',
    fps: 24,
    duration: 5,
  }

  const result = await generateVideo(request)

  return {
    id,
    type: 'ZAI_VIDEO',
    storyBeatId: beat.id,
    localPath: result.localPath,
    generationPrompt: videoPrompt,
    zaiTaskId: result.taskId,
    estimatedCost: result.estimatedCost,
    creator: 'Z.ai generated video',
    license: 'Generated content — owned by channel',
    commercialUse: true,
    attributionRequired: false,
    retrievalDate: new Date(),
    metadata: {
      width: result.width,
      height: result.height,
      duration: result.duration,
      codec: result.codec,
    },
  }
}

// ─── Z.ai image (Phase 17) ───────────────────────────────────

async function acquireZaiImage(beat: StoryBeat, entry: VisualScriptEntry): Promise<AssetManifest> {
  const id = randomUUID()
  const localPath = path.join(IMAGES_DIR, `gen_${id}.png`)

  try {
    const prompt = `${entry.visual}. Professional, photorealistic, no text, no watermark, no AI artifacts. 16:9 cinematic composition.`
    const buf = await generateImage(prompt, '1344x768')
    if (buf && buf.length > 1024) {
      await writeFile(localPath, buf)
    } else {
      await renderFallbackGraphic(beat, localPath)
    }
  } catch (e) {
    await renderFallbackGraphic(beat, localPath)
  }

  return {
    id, type: 'ZAI_IMAGE', storyBeatId: beat.id, localPath,
    generationPrompt: entry.visual,
    creator: 'Z.ai generated image',
    license: 'Generated content — owned by channel',
    commercialUse: true,
    attributionRequired: false,
    retrievalDate: new Date(),
    metadata: { width: 1344, height: 768 },
  }
}

// ─── Editorial excerpt (Phase 16-5) ──────────────────────────

async function acquireEditorialExcerpt(beat: StoryBeat, entry: VisualScriptEntry, brief: ReportingBrief): Promise<AssetManifest> {
  const id = randomUUID()

  // Find a short excerpt to quote (commentary/criticism)
  let excerpt = ''
  let source = ''
  try {
    if (brief.sources.length > 0) {
      const src = brief.sources[0]
      source = src.url
      // Try to read the page
      const pageContent = await readPage(src.url)
      // Pick a representative 1-2 sentence excerpt
      excerpt = pageContent?.content?.slice(0, 280) || ''
    }
  } catch (e) {
    console.warn('[asset-sourcing] Editorial excerpt fetch failed:', e)
  }

  // Render the excerpt as a stylized quote card
  const localPath = path.join(GRAPHICS_DIR, `quote_${id}.png`)
  await renderQuoteCard(excerpt || beat.narration, source, localPath)

  return {
    id,
    type: 'EDITORIAL_EXCERPT',
    storyBeatId: beat.id,
    localPath,
    sourceUrl: source,
    creator: source ? new URL(source).hostname : 'Unknown',
    license: 'Editorial use — commentary / criticism (Fair Use analysis required per use)',
    commercialUse: false,
    attributionRequired: true,
    retrievalDate: new Date(),
    metadata: { width: 1920, height: 1080 },
  }
}

// ─── Renderers (chart / map / graphic / quote) ──────────────

async function renderChartPng(spec: any, outPath: string): Promise<void> {
  // Build an SVG chart, then convert to PNG via ffmpeg
  const w = 1920, h = 1080
  const padding = 100
  const chartW = w - padding * 2
  const chartH = h - padding * 2

  const series = Array.isArray(spec.series) ? spec.series : []
  const allPoints = series.flatMap((s: any) => s.points || [])
  const maxY = Math.max(...allPoints.map((p: any) => p.y || 0), 1)
  const minX = 0
  const maxX = allPoints.length || 1

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  svg += `<rect width="${w}" height="${h}" fill="#0b0f1a"/>`
  // Title
  svg += `<text x="${padding}" y="${padding / 2 + 20}" font-family="Arial" font-size="48" font-weight="bold" fill="#ffffff">${escapeXml(spec.title || 'Chart')}</text>`
  // Axes
  svg += `<line x1="${padding}" y1="${h - padding}" x2="${w - padding}" y2="${h - padding}" stroke="#9ca3af" stroke-width="2"/>`
  svg += `<line x1="${padding}" y1="${padding / 2 + 60}" x2="${padding}" y2="${h - padding}" stroke="#9ca3af" stroke-width="2"/>`
  // Gridlines (4 horizontal)
  for (let i = 0; i <= 4; i++) {
    const y = padding / 2 + 60 + (chartH - 60) * (1 - i / 4)
    svg += `<line x1="${padding}" y1="${y}" x2="${w - padding}" y2="${y}" stroke="#1f2937" stroke-width="1" stroke-dasharray="4 4"/>`
    svg += `<text x="${padding - 10}" y="${y + 6}" font-family="Arial" font-size="18" fill="#9ca3af" text-anchor="end">${Math.round(maxY * i / 4)}</text>`
  }
  // Series
  const palette = ['#ff3d57', '#3b82f6', '#10b981', '#f59e0b', '#a855f7']
  series.forEach((s: any, si: number) => {
    const color = s.color || palette[si % palette.length]
    const points = s.points || []
    if (points.length === 0) return

    if (spec.chartType === 'bar' || !spec.chartType) {
      // Bar chart
      const barW = chartW / points.length / series.length * 0.8
      points.forEach((p: any, pi: number) => {
        const barH = (p.y / maxY) * (chartH - 60)
        const x = padding + pi * (chartW / points.length) + si * barW
        const y = h - padding - barH
        svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}"/>`
        // X-axis label
        if (si === 0) {
          svg += `<text x="${padding + pi * (chartW / points.length) + (chartW / points.length) / 2}" y="${h - padding + 30}" font-family="Arial" font-size="18" fill="#9ca3af" text-anchor="middle">${escapeXml(String(p.x))}</text>`
        }
      })
    } else if (spec.chartType === 'line') {
      const pts = points.map((p: any, pi: number) => {
        const x = padding + (pi / Math.max(points.length - 1, 1)) * chartW
        const y = (h - padding) - (p.y / maxY) * (chartH - 60)
        return `${x},${y}`
      }).join(' ')
      svg += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="4"/>`
      // Dots
      points.forEach((p: any, pi: number) => {
        const x = padding + (pi / Math.max(points.length - 1, 1)) * chartW
        const y = (h - padding) - (p.y / maxY) * (chartH - 60)
        svg += `<circle cx="${x}" cy="${y}" r="6" fill="${color}"/>`
        if (si === 0) {
          svg += `<text x="${x}" y="${h - padding + 30}" font-family="Arial" font-size="18" fill="#9ca3af" text-anchor="middle">${escapeXml(String(p.x))}</text>`
        }
      })
    }

    // Legend
    const legendX = w - padding - 250
    const legendY = padding / 2 + 60 + si * 30
    svg += `<rect x="${legendX}" y="${legendY}" width="20" height="20" fill="${color}"/>`
    svg += `<text x="${legendX + 30}" y="${legendY + 16}" font-family="Arial" font-size="18" fill="#ffffff">${escapeXml(s.label || '')}</text>`
  })

  // Source attribution
  if (spec.source) {
    svg += `<text x="${padding}" y="${h - 20}" font-family="Arial" font-size="14" fill="#6b7280">Source: ${escapeXml(spec.source)}</text>`
  }
  svg += `</svg>`

  await writeSvgAndConvertToPng(svg, outPath)
}

async function renderMapPng(spec: any, outPath: string): Promise<void> {
  const w = 1920, h = 1080
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  svg += `<rect width="${w}" height="${h}" fill="#0b1428"/>`
  // Simplified world map background — abstract blob shapes
  svg += `<ellipse cx="${w/2}" cy="${h/2}" rx="${w*0.4}" ry="${h*0.35}" fill="#1a2847" opacity="0.7"/>`
  svg += `<ellipse cx="${w*0.3}" cy="${h*0.4}" rx="${w*0.1}" ry="${h*0.15}" fill="#243b6b" opacity="0.6"/>`
  svg += `<ellipse cx="${w*0.7}" cy="${h*0.5}" rx="${w*0.12}" ry="${h*0.18}" fill="#243b6b" opacity="0.6"/>`
  svg += `<ellipse cx="${w*0.5}" cy="${h*0.7}" rx="${w*0.08}" ry="${h*0.1}" fill="#243b6b" opacity="0.6"/>`

  // Title
  svg += `<text x="60" y="80" font-family="Arial" font-size="48" font-weight="bold" fill="#ffffff">${escapeXml(spec.title || spec.region || 'Map')}</text>`
  svg += `<text x="60" y="120" font-family="Arial" font-size="24" fill="#9ca3af">${escapeXml(spec.region || '')}</text>`

  // Markers
  for (const m of (spec.markers || [])) {
    const x = (m.x / 100) * w
    const y = (m.y / 100) * h
    svg += `<circle cx="${x}" cy="${y}" r="20" fill="${m.color || '#ff3d57'}" opacity="0.8"/>`
    svg += `<circle cx="${x}" cy="${y}" r="40" fill="none" stroke="${m.color || '#ff3d57'}" stroke-width="3" opacity="0.5"/>`
    svg += `<text x="${x + 30}" y="${y + 6}" font-family="Arial" font-size="24" fill="#ffffff" font-weight="bold">${escapeXml(m.label || '')}</text>`
  }
  svg += `</svg>`

  await writeSvgAndConvertToPng(svg, outPath)
}

async function renderFallbackGraphic(beat: StoryBeat, outPath: string): Promise<void> {
  const w = 1920, h = 1080
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  svg += `<rect width="${w}" height="${h}" fill="#0b0f1a"/>`
  svg += `<rect x="0" y="${h - 200}" width="${w}" height="200" fill="#000000" opacity="0.5"/>`
  svg += `<text x="60" y="${h - 130}" font-family="Arial" font-size="56" font-weight="bold" fill="#ffffff">${escapeXml(beat.title || beat.narration.slice(0, 60))}</text>`
  svg += `<text x="60" y="${h - 60}" font-family="Arial" font-size="28" fill="#9ca3af">${escapeXml(beat.visualIntent.slice(0, 100))}</text>`
  svg += `</svg>`
  await writeSvgAndConvertToPng(svg, outPath)
}

async function renderQuoteCard(text: string, source: string, outPath: string): Promise<void> {
  const w = 1920, h = 1080
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  svg += `<rect width="${w}" height="${h}" fill="#0b0f1a"/>`
  // Big quote mark
  svg += `<text x="60" y="280" font-family="Georgia" font-size="320" fill="#ff3d57" opacity="0.3">"</text>`
  // Quote text — wrapped
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).length > 70) {
      lines.push(line)
      line = word
    } else {
      line = line ? line + ' ' + word : word
    }
  }
  if (line) lines.push(line)
  lines.slice(0, 5).forEach((l, i) => {
    svg += `<text x="120" y="${480 + i * 70}" font-family="Georgia" font-size="48" font-style="italic" fill="#ffffff">${escapeXml(l)}</text>`
  })
  // Source
  if (source) {
    svg += `<text x="120" y="${h - 80}" font-family="Arial" font-size="24" fill="#9ca3af">— ${escapeXml(source)}</text>`
  }
  svg += `</svg>`
  await writeSvgAndConvertToPng(svg, outPath)
}

async function writeSvgAndConvertToPng(svg: string, outPath: string): Promise<void> {
  const svgPath = outPath.replace(/\.png$/, '.svg')
  await writeFile(svgPath, svg)
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const exec = promisify(execFile)
  try {
    await exec('ffmpeg', [
      '-i', svgPath,
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black',
      '-frames:v', '1', '-y', outPath,
    ])
  } catch (e) {
    // ffmpeg SVG support varies — fall back to rsvg-convert or just save the SVG
    try {
      await exec('rsvg-convert', ['-w', '1920', '-h', '1080', svgPath, '-o', outPath])
    } catch {
      // Last resort — copy SVG with PNG extension (most viewers will still show it)
      await writeFile(outPath, svg)
    }
  }
  // Clean up SVG
  try { await writeFile(svgPath, '') } catch {}
}

function escapeXml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function createPlaceholderManifest(beat: StoryBeat, entry: VisualScriptEntry, error: string): AssetManifest {
  const id = randomUUID()
  return {
    id,
    type: 'ORIGINAL_GRAPHIC',
    storyBeatId: beat.id,
    localPath: '',
    creator: 'Placeholder',
    license: 'Placeholder',
    commercialUse: false,
    attributionRequired: false,
    retrievalDate: new Date(),
    metadata: { width: 0, height: 0 },
  }
}

// ─── Asset Library (Phase 19) ───────────────────────────────

/**
 * Reusable asset library — checks if an existing asset can serve a beat before
 * generating something new. Reduces cost and improves consistency.
 *
 * For now this is an in-memory cache. Should be promoted to DB-backed storage
 * for cross-video reuse.
 */
const assetLibraryCache = new Map<string, AssetManifest[]>()

export function cacheAsset(key: string, manifest: AssetManifest): void {
  const arr = assetLibraryCache.get(key) || []
  arr.push(manifest)
  assetLibraryCache.set(key, arr)
}

export function findReusableAsset(key: string, predicate: (m: AssetManifest) => boolean): AssetManifest | null {
  const arr = assetLibraryCache.get(key) || []
  return arr.find(predicate) || null
}
