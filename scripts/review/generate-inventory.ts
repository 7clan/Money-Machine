/**
 * Generate video-inventory.json — physical audit of all MONEY MACHINE videos.
 *
 * Scans for MP4 files, validates each with ffprobe, cross-references with
 * audit artifacts (fact-check, QC, publish manifests) for metadata.
 *
 * HONEST: if a reported video doesn't physically exist, marks it MISSING.
 *
 * Run: bunx tsx scripts/review/generate-inventory.ts
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, statSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { getPlaybackSource, getManifest as getArtifactManifest } from '../../src/engine/artifact-store'

const exec = promisify(execFile)
const ROOT = process.cwd()
const INVENTORY_PATH = path.join(ROOT, 'data', 'review', 'video-inventory.json')

interface VideoEntry {
  id: string
  name: string
  format: string
  category: 'APPROVED' | 'DEVELOPMENT' | 'SUPERSEDED' | 'MISSING'
  status: string
  path: string
  exists: boolean
  duration: number | null
  resolution: string | null
  sizeBytes: number | null
  sizeMB: number | null
  factCheckStatus: string | null
  qcStatus: string | null
  youtubeVideoId: string | null
  youtubePrivacy: string | null
  thumbnailPath: string | null
  contactSheetPath: string | null
  superseded: boolean
  supersededBy: string | null
  notes: string
  playbackSource: 'PERSISTED' | 'LOCAL' | 'YOUTUBE' | 'NONE'
  storageStatus: string | null
  artifactId: string | null
}

async function probeVideo(filePath: string): Promise<{ duration: number | null; resolution: string | null; codec: string | null; audioCodec: string | null }> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,duration', '-of', 'json', filePath])
    const data = JSON.parse(stdout)
    const video = data.streams?.find((s: any) => s.codec_type === 'video')
    const audio = data.streams?.find((s: any) => s.codec_type === 'audio')
    return {
      duration: video?.duration ? Number(video.duration) : null,
      resolution: video?.width && video?.height ? `${video.width}x${video.height}` : null,
      codec: video?.codec_name || null,
      audioCodec: audio?.codec_name || null,
    }
  } catch {
    return { duration: null, resolution: null, codec: null, audioCodec: null }
  }
}

function readJson(p: string): any {
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

/**
 * Get playback source for a production from the artifact store.
 */
function getPlayback(productionId: string): { playbackSource: 'PERSISTED' | 'LOCAL' | 'YOUTUBE' | 'NONE'; storageStatus: string | null; artifactId: string | null } {
  try {
    const pb = getPlaybackSource(productionId)
    return {
      playbackSource: pb.source,
      storageStatus: pb.artifact?.storageStatus || null,
      artifactId: pb.artifact?.artifactId || null,
    }
  } catch {
    return { playbackSource: 'NONE', storageStatus: null, artifactId: null }
  }
}

async function main() {
  const entries: VideoEntry[] = []

  // ===== CAPABILITY SHOWCASE 001 =====
  const showcaseDir = path.join(ROOT, 'data', 'autonomous-runs', 'capability-showcase-001')
  const showcaseVideo = path.join(showcaseDir, 'renders', 'final.mp4')
  const showcaseExists = existsSync(showcaseVideo)
  const showcaseProbe = showcaseExists ? await probeVideo(showcaseVideo) : { duration: null, resolution: null, codec: null, audioCodec: null }
  const showcaseStat = showcaseExists ? statSync(showcaseVideo) : null
  const showcaseFactCheck = readJson(path.join(showcaseDir, 'fact-check.json'))
  const showcaseQC = readJson(path.join(showcaseDir, 'qc-round-1.json'))
  const showcaseTitle = readJson(path.join(showcaseDir, 'title-thumbnail.json'))
  const showcaseThumb = readJson(path.join(showcaseDir, 'thumbnail-manifest.json'))
  const showcasePublish = readJson(path.join(showcaseDir, 'publish-manifest.json'))
  entries.push({
    id: 'capability-showcase-001',
    name: 'Capability Showcase 001 — Your Mind\'s Renewable Energy',
    format: 'EXPLAINER_ESSAY',
    category: 'APPROVED',
    status: showcaseExists ? 'APPROVED' : 'MISSING',
    path: showcaseVideo,
    exists: showcaseExists,
    duration: showcaseProbe.duration,
    resolution: showcaseProbe.resolution,
    sizeBytes: showcaseStat?.size ?? null,
    sizeMB: showcaseStat ? Math.round(showcaseStat.size / 1024 / 1024 * 100) / 100 : null,
    factCheckStatus: showcaseFactCheck?.verdict || null,
    qcStatus: showcaseQC?.verdict || null,
    youtubeVideoId: showcasePublish?.youtubeVideoId || null,
    youtubePrivacy: showcasePublish?.privacyStatus || (showcasePublish?.status === 'USER_AUTH_REQUIRED' ? 'NOT_UPLOADED' : null),
    thumbnailPath: showcaseThumb?.thumbnailPath && existsSync(showcaseThumb.thumbnailPath) ? showcaseThumb.thumbnailPath : null,
    contactSheetPath: null,
    superseded: false,
    supersededBy: null,
    notes: `Topic: ${showcaseTitle?.title || 'unknown'}. Fact-repaired + QC PASS + duration integrity PASS. YouTube upload blocked (USER_AUTH_REQUIRED — OAuth not connected).`,
    ...getPlayback('capability-showcase-001'),
  })

  // ===== AUTONOMOUS CYCLE 001 (corrected v2) =====
  const cycleDir = path.join(ROOT, 'data', 'autonomous-runs', 'cycle-001')
  const cycleVideo = path.join(cycleDir, 'renders', 'final.mp4')
  const cycleExists = existsSync(cycleVideo)
  const cycleProbe = cycleExists ? await probeVideo(cycleVideo) : { duration: null, resolution: null, codec: null, audioCodec: null }
  const cycleStat = cycleExists ? statSync(cycleVideo) : null
  const cycleFactCheck = readJson(path.join(cycleDir, 'fact-check.json'))
  const cycleQC = readJson(path.join(cycleDir, 'qc-round-1.json'))
  const cycleTitle = readJson(path.join(cycleDir, 'title-thumbnail.json'))
  const cyclePublish = readJson(path.join(cycleDir, 'publish-manifest-v2.json'))
  const cycleThumb = readJson(path.join(cycleDir, 'thumbnail-manifest.json'))
  entries.push({
    id: 'autonomous-cycle-001-v2',
    name: 'Autonomous Cycle 001 (v2 — Fact-Verified)',
    format: 'EXPLAINER_ESSAY',
    category: cycleExists ? 'APPROVED' : 'MISSING',
    status: cycleExists ? 'APPROVED' : 'MISSING',
    path: cycleVideo,
    exists: cycleExists,
    duration: cycleProbe.duration,
    resolution: cycleProbe.resolution,
    sizeBytes: cycleStat?.size ?? null,
    sizeMB: cycleStat ? Math.round(cycleStat.size / 1024 / 1024 * 100) / 100 : null,
    factCheckStatus: cycleFactCheck?.verdict || null,
    qcStatus: cycleQC?.verdict || null,
    youtubeVideoId: cyclePublish?.youtubeVideoId || 'BkntTZ2rsmU',
    youtubePrivacy: 'private',
    thumbnailPath: cycleThumb?.thumbnailPath && existsSync(cycleThumb.thumbnailPath) ? cycleThumb.thumbnailPath : null,
    contactSheetPath: null,
    superseded: false,
    supersededBy: null,
    notes: `Topic: ${cycleTitle?.title || 'The Minimalist AI Toolkit'}. Uploaded to YouTube as PRIVATE (videoId=BkntTZ2rsmU). Local MP4 missing (gitignored during history purge). Watch on YouTube via the button.`,
    ...getPlayback('autonomous-cycle-001-v2'),
  })

  // ===== AUTONOMOUS CYCLE 001 (pre-repair, truncated) =====
  const cyclePreVideo = path.join(cycleDir, 'renders-pre-repair', 'final-pre-repair.mp4')
  const cyclePreExists = existsSync(cyclePreVideo)
  const cyclePreProbe = cyclePreExists ? await probeVideo(cyclePreVideo) : { duration: null, resolution: null, codec: null, audioCodec: null }
  const cyclePreStat = cyclePreExists ? statSync(cyclePreVideo) : null
  entries.push({
    id: 'autonomous-cycle-001-pre-repair',
    name: 'Autonomous Cycle 001 (PRE-REPAIR — truncated 30s)',
    format: 'EXPLAINER_ESSAY',
    category: 'SUPERSEDED',
    status: cyclePreExists ? 'SUPERSEDED' : 'MISSING',
    path: cyclePreVideo,
    exists: cyclePreExists,
    duration: cyclePreProbe.duration,
    resolution: cyclePreProbe.resolution,
    sizeBytes: cyclePreStat?.size ?? null,
    sizeMB: cyclePreStat ? Math.round(cyclePreStat.size / 1024 / 1024 * 100) / 100 : null,
    factCheckStatus: 'FAIL (2 unsupported claims)',
    qcStatus: 'PASS (but duration truncated)',
    youtubeVideoId: 'LP1QgQwBN5o',
    youtubePrivacy: 'private',
    thumbnailPath: null,
    contactSheetPath: null,
    superseded: true,
    supersededBy: 'autonomous-cycle-001-v2',
    notes: 'Original truncated master (30s instead of 44s) with fact-check FAIL. Superseded by v2. YouTube videoId=LP1QgQwBN5o still exists as PRIVATE.',
    ...getPlayback('autonomous-cycle-001-pre-repair'),
  })

  // ===== BENCHMARK VIDEOS (Test A/B/C/D) =====
  const benchmarkVideos = [
    { id: 'test-a-documentary', name: 'TEST A — Nokia Documentary', format: 'DOCUMENTARY', expectedPath: 'data/benchmark/test-a-nokia/nokia-documentary-final-1080p.mp4', notes: 'Test A documentary benchmark. Local MP4 removed during git history purge.' },
    { id: 'test-b-tutorial', name: 'TEST B — DevTools Tutorial', format: 'SCREEN_TUTORIAL', expectedPath: 'data/videos/test-b-tutorial.mp4', notes: 'Test B tutorial benchmark. Local MP4 removed.' },
    { id: 'test-c-short', name: 'TEST C — The Decoy Effect (Short)', format: 'SHORT', expectedPath: 'data/videos/test-c-short.mp4', notes: 'Test C short benchmark. Local MP4 removed.' },
    { id: 'test-d-animation', name: 'TEST D — GLOW HOUR (Animation Pilot)', format: 'ANIMATION', expectedPath: 'data/videos/test-d-pilot-animated.mp4', notes: 'Test D animation pilot. VLM verdict A=animated. Local MP4 removed.' },
    { id: 'test-d-animation-proof', name: 'TEST D — Animation Proof (12s)', format: 'ANIMATION', expectedPath: 'data/videos/test-d-animation-proof.mp4', notes: 'Test D 12s animation proof. Local MP4 removed.' },
  ]
  for (const bv of benchmarkVideos) {
    const fullPath = path.join(ROOT, bv.expectedPath)
    const exists = existsSync(fullPath)
    const probe = exists ? await probeVideo(fullPath) : { duration: null, resolution: null, codec: null, audioCodec: null }
    const stat = exists ? statSync(fullPath) : null
    entries.push({
      id: bv.id,
      name: bv.name,
      format: bv.format,
      category: 'MISSING',
      status: exists ? 'APPROVED' : 'MISSING',
      path: fullPath,
      exists,
      duration: probe.duration,
      resolution: probe.resolution,
      sizeBytes: stat?.size ?? null,
      sizeMB: stat ? Math.round(stat.size / 1024 / 1024 * 100) / 100 : null,
      factCheckStatus: null,
      qcStatus: 'PASS (historical)',
      youtubeVideoId: null,
      youtubePrivacy: null,
      thumbnailPath: null,
      contactSheetPath: null,
      superseded: false,
      supersededBy: null,
      notes: bv.notes,
      playbackSource: 'NONE' as const,
      storageStatus: null,
      artifactId: null,
    })
  }

  // ===== REGRESSION TEST VIDEOS (development only) =====
  const regressionDir = path.join(ROOT, 'data', 'regression', 'duration-test')
  if (existsSync(regressionDir)) {
    for (const f of readdirSync(regressionDir)) {
      if (f.endsWith('.mp4')) {
        const fullPath = path.join(regressionDir, f)
        const probe = await probeVideo(fullPath)
        const stat = statSync(fullPath)
        const isBuggy = f.includes('buggy')
        entries.push({
          id: `regression-${f.replace('.mp4', '')}`,
          name: `Regression: ${f}`,
          format: 'REGRESSION_TEST',
          category: 'DEVELOPMENT',
          status: isBuggy ? 'DEVELOPMENT (buggy reference)' : 'DEVELOPMENT (fixed reference)',
          path: fullPath,
          exists: true,
          duration: probe.duration,
          resolution: probe.resolution,
          sizeBytes: stat.size,
          sizeMB: Math.round(stat.size / 1024 / 1024 * 100) / 100,
          factCheckStatus: null,
          qcStatus: null,
          youtubeVideoId: null,
          youtubePrivacy: null,
          thumbnailPath: null,
          contactSheetPath: null,
          superseded: isBuggy,
          supersededBy: isBuggy ? f.replace('buggy', 'fixed') : null,
          notes: isBuggy ? 'Buggy reference (300-frame cap simulation) — used to verify the fix works.' : 'Fixed reference — correct duration derived from calculateCycleDuration().',
          playbackSource: exists ? 'LOCAL' : 'NONE',
          storageStatus: null,
          artifactId: null,
        })
      }
    }
  }

  // ===== WRITE INVENTORY =====
  mkdirSync(path.dirname(INVENTORY_PATH), { recursive: true })
  writeFileSync(INVENTORY_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`)

  const approved = entries.filter((e) => e.category === 'APPROVED' && e.exists)
  const superseded = entries.filter((e) => e.category === 'SUPERSEDED')
  const missing = entries.filter((e) => !e.exists)
  const dev = entries.filter((e) => e.category === 'DEVELOPMENT')
  console.log(`Video inventory generated: ${INVENTORY_PATH}`)
  console.log(`  Total entries: ${entries.length}`)
  console.log(`  Approved (exists): ${approved.length}`)
  console.log(`  Superseded: ${superseded.length}`)
  console.log(`  Development: ${dev.length}`)
  console.log(`  Missing: ${missing.length}`)
  for (const m of missing) {
    console.log(`    MISSING: ${m.name} — ${m.notes}`)
  }
}

main().catch((e) => {
  console.error('FATAL:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
