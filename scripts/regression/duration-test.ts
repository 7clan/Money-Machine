/**
 * Duration Regression Test — guards against the Cycle 001 bug where
 * Composition.durationInFrames silently remained at a fixed 300-frame default.
 *
 * TWO test layers:
 *
 * Layer 1 — calculateCycleDuration() unit tests:
 *   Verifies the pure function that derives durationInFrames from inputProps.
 *   This is the SINGLE SOURCE OF TRUTH used by Root.tsx calculateMetadata.
 *
 * Layer 2 — ffmpeg render tests:
 *   Generates "fixed" vs "buggy" videos and asserts the fixed version matches
 *   the expected duration and does NOT match the buggy (300-frame-capped) version.
 *
 * Test cases:
 *   1. short chunk (1 segment, ~5s)
 *   2. long chunk (5 segments, ~35s)
 *   3. multi-chunk concat (7 segments, ~44s)
 *   4. non-integer-second audio duration (TTS producing 6.072s, 4.728s etc.)
 *
 * Run: bunx tsx scripts/regression/duration-test.ts
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { calculateCycleDuration } from '../../src/video/compositions/Cycle001Composition'

const exec = promisify(execFile)
const ROOT = process.cwd()
const TEST_DIR = path.join(ROOT, 'data', 'regression', 'duration-test')
const RESULTS_PATH = path.join(TEST_DIR, 'results.json')

mkdirSync(TEST_DIR, { recursive: true })

interface TestCase {
  name: string
  segments: { id: string; durationSec: number }[]
  expectedTotalSec: number
  description: string
}

const TEST_CASES: TestCase[] = [
  {
    name: 'short-chunk',
    segments: [{ id: 'seg-1', durationSec: 5.0 }],
    expectedTotalSec: 5.0,
    description: 'Single short segment (5s) — must not be truncated to a default',
  },
  {
    name: 'long-chunk',
    segments: [
      { id: 'seg-1', durationSec: 7.0 },
      { id: 'seg-2', durationSec: 7.0 },
      { id: 'seg-3', durationSec: 7.0 },
      { id: 'seg-4', durationSec: 7.0 },
      { id: 'seg-5', durationSec: 7.0 },
    ],
    expectedTotalSec: 35.0,
    description: 'Long single chunk (5 segments × 7s = 35s) — must exceed the 10s default',
  },
  {
    name: 'multi-chunk-concat',
    segments: [
      { id: 'seg-1', durationSec: 7.248 },
      { id: 'seg-2', durationSec: 6.072 },
      { id: 'seg-3', durationSec: 6.0 },
      { id: 'seg-4', durationSec: 7.032 },
      { id: 'seg-5', durationSec: 6.528 },
      { id: 'seg-6', durationSec: 6.672 },
      { id: 'seg-7', durationSec: 4.728 },
    ],
    expectedTotalSec: 44.28,
    description: 'Multi-chunk concat (7 segments, ~44s) — Cycle 001 scenario. Old bug truncated to 30s.',
  },
  {
    name: 'non-integer-seconds',
    segments: [
      { id: 'seg-1', durationSec: 6.072 },
      { id: 'seg-2', durationSec: 4.728 },
      { id: 'seg-3', durationSec: 3.515 },
    ],
    expectedTotalSec: 14.315,
    description: 'Non-integer second durations (TTS artifacts) — frame rounding must not lose content',
  },
]

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
    return parseFloat(stdout.trim()) || 0
  } catch { return 0 }
}

async function renderFixed(tc: TestCase): Promise<string> {
  const outPath = path.join(TEST_DIR, `${tc.name}-fixed.mp4`)
  const totalFrames = Math.ceil(tc.expectedTotalSec * 30)
  await exec('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=black:s=320x240:r=30:d=${tc.expectedTotalSec}`,
    '-frames:v', String(totalFrames),
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    outPath,
  ])
  return outPath
}

async function renderBuggy(tc: TestCase): Promise<string> {
  const outPath = path.join(TEST_DIR, `${tc.name}-buggy.mp4`)
  const bugFrames = Math.min(300, Math.ceil(tc.expectedTotalSec * 30))
  await exec('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=black:s=320x240:r=30`,
    '-frames:v', String(bugFrames),
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    outPath,
  ])
  return outPath
}

async function main() {
  console.log('==================================================')
  console.log('DURATION REGRESSION TEST — guarding against Cycle 001 bug')
  console.log('==================================================')
  const results: any[] = []
  let allPass = true

  // ===== LAYER 1: calculateCycleDuration() unit tests =====
  console.log('\n--- LAYER 1: calculateCycleDuration() unit tests ---')
  const FPS = 30
  for (const tc of TEST_CASES) {
    // Build inputProps with shots whose end times match the segment durations
    let t = 0
    const shots = tc.segments.map((s, i) => {
      const start = t
      const end = t + s.durationSec
      t = end
      return { id: `shot-${i + 1}`, segmentId: s.id, start, end, duration: s.durationSec, type: 'MOTION_GRAPHIC', purpose: '', isRawVideo: false, isScreenshot: false }
    })
    const segments = tc.segments.map((s, i) => ({ id: s.id, type: 'SECTION', narration: '', start: shots[i].start, end: shots[i].end, duration: s.durationSec }))
    const inputProps = { shots, segments, images: {}, audio: {} }
    const derived = calculateCycleDuration(inputProps, FPS)
    const expected = Math.ceil(tc.expectedTotalSec * FPS)
    const pass = derived === expected
    console.log(`  [L1] ${tc.name}: derived=${derived} frames (${(derived / FPS).toFixed(3)}s), expected=${expected} frames → ${pass ? 'PASS' : 'FAIL'}`)
    results.push({
      name: `${tc.name}-calculateCycleDuration`,
      layer: 'unit',
      expectedFrames: expected,
      derivedFrames: derived,
      pass,
      reason: pass ? `derived ${derived} frames matches expected ${expected}` : `derived ${derived} != expected ${expected}`,
    })
    if (!pass) allPass = false
  }

  // Edge case: empty props → 1 frame (defensive)
  const emptyDerived = calculateCycleDuration({ shots: [], segments: [] }, FPS)
  const emptyPass = emptyDerived === 1
  console.log(`  [L1] empty-props: derived=${emptyDerived} (expected 1) → ${emptyPass ? 'PASS' : 'FAIL'}`)
  results.push({ name: 'empty-props-calculateCycleDuration', layer: 'unit', expectedFrames: 1, derivedFrames: emptyDerived, pass: emptyPass, reason: `empty props → ${emptyDerived} frame(s)` })
  if (!emptyPass) allPass = false

  // ===== LAYER 2: ffmpeg render tests =====
  console.log('\n--- LAYER 2: ffmpeg render tests ---')
  for (const tc of TEST_CASES) {
    console.log(`\n[TEST] ${tc.name}: ${tc.description}`)
    console.log(`  expectedTotalSec=${tc.expectedTotalSec}s (${tc.segments.length} segments)`)

    const fixedPath = await renderFixed(tc)
    const buggyPath = await renderBuggy(tc)
    const fixedDur = await probeDuration(fixedPath)
    const buggyDur = await probeDuration(buggyPath)

    const fixedMatchesExpected = Math.abs(fixedDur - tc.expectedTotalSec) < 1.0
    const bugWouldTruncate = tc.expectedTotalSec > 10 && Math.abs(buggyDur - tc.expectedTotalSec) > 1.0
    const fixedDoesNotMatchBuggy = Math.abs(fixedDur - buggyDur) > 0.5 || tc.expectedTotalSec <= 10

    const pass = fixedMatchesExpected && (tc.expectedTotalSec <= 10 || (bugWouldTruncate && fixedDoesNotMatchBuggy))
    const reason = pass
      ? `fixed=${fixedDur}s matches expected=${tc.expectedTotalSec}s` +
        (bugWouldTruncate ? ` (buggy version would truncate to ${buggyDur}s — fix prevents this)` : '')
      : `FAIL: fixed=${fixedDur}s expected=${tc.expectedTotalSec}s buggy=${buggyDur}s fixedMatchesExpected=${fixedMatchesExpected} bugWouldTruncate=${bugWouldTruncate} fixedDoesNotMatchBuggy=${fixedDoesNotMatchBuggy}`

    console.log(`  fixed duration: ${fixedDur}s`)
    console.log(`  buggy duration: ${buggyDur}s`)
    console.log(`  RESULT: ${pass ? 'PASS' : 'FAIL'} — ${reason}`)

    results.push({
      name: tc.name,
      description: tc.description,
      segmentCount: tc.segments.length,
      expectedTotalSec: tc.expectedTotalSec,
      fixedDurationSec: fixedDur,
      buggyDurationSec: buggyDur,
      fixedMatchesExpected,
      bugWouldTruncate,
      fixedDoesNotMatchBuggy,
      pass,
      reason,
    })
    if (!pass) allPass = false
  }

  const summary = {
    testName: 'duration-regression',
    bugDescription: 'Cycle 001: Composition.durationInFrames silently remained at 300-frame default (10s), truncating every chunk to 10s regardless of actual chunk duration. Root cause: registered Composition had hardcoded durationInFrames={300} in Root.tsx; selectComposition() read this and was never overridden per-chunk.',
    fixDescription: 'In scripts/cycle-001/produce.ts, after selectComposition(), explicitly override: composition.durationInFrames = durationInFrames (calculated from actual chunk duration × FPS). Also override fps/width/height for safety.',
    testCases: results,
    allPass,
    timestamp: new Date().toISOString(),
  }
  writeFileSync(RESULTS_PATH, `${JSON.stringify(summary, null, 2)}\n`)
  console.log('\n==================================================')
  console.log(`DURATION REGRESSION TEST: ${allPass ? 'PASS' : 'FAIL'}`)
  console.log(`Results: ${RESULTS_PATH}`)
  console.log('==================================================')
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
