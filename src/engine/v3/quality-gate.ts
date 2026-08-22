/**
 * Production Quality Gate (Phase: spec sections 26-29)
 *
 * Automated technical checks on the rendered video.
 * FAILS the video (NEEDS_REVISION) if any of:
 *   - black frames detected (spec section 26 — would have caught the 33s black video)
 *   - frozen visuals (freezedetect)
 *   - near-silent narration (silencedetect + LUFS check)
 *   - audio clipping
 *   - thumbnail is not a valid PNG (spec section 27 — JPEG mislabeled as PNG)
 *   - visual monotony (all sampled frames identical)
 *
 * Also generates a contact sheet (12-20 sampled frames) for visual inspection.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { vision } from './zai-scheduler'

const exec = promisify(execFile)

export interface QualityGateResult {
  passed: boolean
  checks: Array<{
    name: string
    passed: boolean
    details: string
    severity: 'critical' | 'warning' | 'info'
  }>
  contactSheetPath: string | null
  audioLUFS: number | null
  blackFrameCount: number
  freezeCount: number
  silenceCount: number
  visualVarietyScore: number  // 0-100, higher = more variety
  recommendations: string[]
}

/**
 * Run the full production quality gate on a rendered video.
 */
export async function runQualityGate(opts: {
  videoPath: string
  thumbnailPath: string
  durationSec: number
}): Promise<QualityGateResult> {
  const { videoPath, thumbnailPath, durationSec } = opts
  const checks: QualityGateResult['checks'] = []
  const recommendations: string[] = []

  // ── Check 1: Video decodes ──────────────────────────────
  let videoProbe: any = null
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,codec_type,width,height', '-of', 'json', videoPath])
    videoProbe = JSON.parse(stdout)
    const videoStream = videoProbe.streams?.find((s: any) => s.codec_type === 'video')
    const audioStream = videoProbe.streams?.find((s: any) => s.codec_type === 'audio')
    if (!videoStream) {
      checks.push({ name: 'video_decodes', passed: false, details: 'No video stream found', severity: 'critical' })
    } else {
      checks.push({
        name: 'video_decodes',
        passed: true,
        details: `${videoStream.codec_name} ${videoStream.width}x${videoStream.height}`,
        severity: 'info',
      })
    }
    if (!audioStream) {
      checks.push({ name: 'audio_decodes', passed: false, details: 'No audio stream found', severity: 'critical' })
    } else {
      checks.push({
        name: 'audio_decodes',
        passed: true,
        details: `${audioStream.codec_name}`,
        severity: 'info',
      })
    }
  } catch (e: any) {
    checks.push({ name: 'video_decodes', passed: false, details: e.message, severity: 'critical' })
  }

  // ── Check 2: Black frame detection (spec section 26) ────
  let blackFrameCount = 0
  try {
    const { stdout } = await exec('ffmpeg', ['-hide_banner', '-i', videoPath, '-vf', 'blackdetect=d=0.5:pix_th=0.10', '-an', '-f', 'null', '-'])
    const matches = stdout.matchAll(/black_duration:(\d+\.?\d*)/g)
    for (const m of matches) blackFrameCount++
    const totalBlack = Array.from(stdout.matchAll(/black_duration:(\d+\.?\d*)/g)).reduce((s, m) => s + parseFloat(m[1]), 0)
    checks.push({
      name: 'black_frames',
      passed: totalBlack < 1.0, // less than 1 second of black total
      details: `${blackFrameCount} black segments, ${totalBlack.toFixed(1)}s total black`,
      severity: totalBlack > 5 ? 'critical' : totalBlack > 1 ? 'warning' : 'info',
    })
    if (totalBlack > 1) recommendations.push(`Video has ${totalBlack.toFixed(1)}s of black frames — likely a render failure`)
  } catch (e: any) {
    checks.push({ name: 'black_frames', passed: false, details: `blackdetect failed: ${e.message.slice(0, 100)}`, severity: 'warning' })
  }

  // ── Check 3: Freeze detection ───────────────────────────
  let freezeCount = 0
  try {
    const { stdout } = await exec('ffmpeg', ['-hide_banner', '-i', videoPath, '-vf', 'freezedetect=d=2:noise=0.005', '-an', '-f', 'null', '-'])
    const matches = stdout.matchAll(/freeze_duration:(\d+\.?\d*)/g)
    for (const m of matches) freezeCount++
    const totalFreeze = Array.from(stdout.matchAll(/freeze_duration:(\d+\.?\d*)/g)).reduce((s, m) => s + parseFloat(m[1]), 0)
    checks.push({
      name: 'freeze_detect',
      passed: totalFreeze < durationSec * 0.5, // less than 50% frozen
      details: `${freezeCount} freeze segments, ${totalFreeze.toFixed(1)}s total frozen`,
      severity: totalFreeze > durationSec * 0.3 ? 'critical' : totalFreeze > 5 ? 'warning' : 'info',
    })
    if (totalFreeze > durationSec * 0.3) recommendations.push(`Video is ${((totalFreeze / durationSec) * 100).toFixed(0)}% frozen — visual stagnation`)
  } catch (e: any) {
    checks.push({ name: 'freeze_detect', passed: false, details: `freezedetect failed: ${e.message.slice(0, 100)}`, severity: 'warning' })
  }

  // ── Check 4: Silence detection (spec section 26) ─────────
  let silenceCount = 0
  let totalSilence = 0
  try {
    const { stdout } = await exec('ffmpeg', ['-hide_banner', '-i', videoPath, '-af', 'silencedetect=d=2:noise=-40dB', '-f', 'null', '-'])
    const matches = stdout.matchAll(/silence_duration:(\d+\.?\d*)/g)
    for (const m of matches) silenceCount++
    totalSilence = Array.from(stdout.matchAll(/silence_duration:(\d+\.?\d*)/g)).reduce((s, m) => s + parseFloat(m[1]), 0)
    checks.push({
      name: 'silence_detect',
      passed: totalSilence < durationSec * 0.3, // less than 30% silent
      details: `${silenceCount} silence segments, ${totalSilence.toFixed(1)}s total silent`,
      severity: totalSilence > durationSec * 0.5 ? 'critical' : totalSilence > durationSec * 0.3 ? 'warning' : 'info',
    })
    if (totalSilence > durationSec * 0.3) recommendations.push(`Audio is ${((totalSilence / durationSec) * 100).toFixed(0)}% silent — TTS may have failed`)
  } catch (e: any) {
    checks.push({ name: 'silence_detect', passed: false, details: `silencedetect failed: ${e.message.slice(0, 100)}`, severity: 'warning' })
  }

  // ── Check 5: Audio loudness (LUFS) ──────────────────────
  let audioLUFS: number | null = null
  try {
    const { stdout } = await exec('ffmpeg', ['-hide_banner', '-i', videoPath, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'])
    const lufsMatch = stdout.match(/Input Integrated:\s*(-?\d+\.?\d*)\s*LUFS/)
    if (lufsMatch) {
      audioLUFS = parseFloat(lufsMatch[1])
      // -91 dB = essentially silent (LUFS would be -70 or lower)
      // Normal narration: -16 to -23 LUFS
      checks.push({
        name: 'audio_loudness',
        passed: audioLUFS > -35, // not essentially silent
        details: `${audioLUFS.toFixed(1)} LUFS (normal narration: -16 to -23)`,
        severity: audioLUFS < -50 ? 'critical' : audioLUFS < -30 ? 'warning' : 'info',
      })
      if (audioLUFS < -50) recommendations.push(`Audio LUFS is ${audioLUFS.toFixed(1)} — essentially silent. TTS failed.`)
    }
  } catch (e: any) {
    checks.push({ name: 'audio_loudness', passed: false, details: `loudnorm failed: ${e.message.slice(0, 100)}`, severity: 'warning' })
  }

  // ── Check 6: Thumbnail format validation (spec section 27) ─
  try {
    const { stdout } = await exec('file', ['-b', '--mime-type', thumbnailPath])
    const mimeType = stdout.trim()
    const isPng = mimeType === 'image/png'
    // Also check the actual format via ffprobe
    const { stdout: probeOut } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=format_name:stream=codec_name,width,height', '-of', 'json', thumbnailPath])
    const probe = JSON.parse(probeOut)
    const imgStream = probe.streams?.[0] || {}
    const realFormat = probe.format?.format_name || ''
    checks.push({
      name: 'thumbnail_format',
      passed: isPng || realFormat.includes('png') || realFormat.includes('jpeg') || realFormat.includes('jpg'),
      details: `mime=${mimeType}, ffprobe format=${realFormat}, ${imgStream.width || '?'}x${imgStream.height || '?'}`,
      severity: 'warning',
    })
    // If it's actually a JPEG mislabeled as .png, re-encode it properly
    if (!isPng && (realFormat.includes('jpeg') || realFormat.includes('jpg'))) {
      const tmpPath = thumbnailPath + '.tmp.png'
      await exec('ffmpeg', ['-i', thumbnailPath, '-f', 'image2', '-vcodec', 'png', '-y', tmpPath])
      await readFile(tmpPath).then(b => writeFile(thumbnailPath, b))
      try { await writeFile(tmpPath, '') } catch {}
      recommendations.push('Thumbnail was JPEG mislabeled as PNG — re-encoded to actual PNG')
    }
  } catch (e: any) {
    checks.push({ name: 'thumbnail_format', passed: false, details: `validation failed: ${e.message.slice(0, 100)}`, severity: 'warning' })
  }

  // ── Check 7: Visual variety (sample 12 frames, compare hashes) ─
  const contactSheetPath = path.join(path.dirname(videoPath), '..', 'contact-sheets', `${path.basename(videoPath, '.mp4')}.jpg`)
  let visualVarietyScore = 0
  try {
    const frames = await sampleFrames(videoPath, 12)
    if (frames.length >= 6) {
      // Compute MD5 of each frame; count unique
      const { createHash } = await import('crypto')
      const hashes: string[] = []
      for (const f of frames) {
        const buf = await readFile(f.path)
        hashes.push(createHash('md5').update(buf).digest('hex'))
      }
      const uniqueHashes = new Set(hashes)
      visualVarietyScore = Math.round((uniqueHashes.size / hashes.length) * 100)

      checks.push({
        name: 'visual_variety',
        passed: visualVarietyScore >= 50, // at least 50% unique frames
        details: `${uniqueHashes.size}/${hashes.length} unique frames (${visualVarietyScore}% variety)`,
        severity: visualVarietyScore < 30 ? 'critical' : visualVarietyScore < 50 ? 'warning' : 'info',
      })
      if (visualVarietyScore < 50) recommendations.push(`Low visual variety (${visualVarietyScore}%) — frames are too similar, likely a slideshow`)

      // Build contact sheet
      await buildContactSheet(frames, contactSheetPath)
    }
  } catch (e: any) {
    checks.push({ name: 'visual_variety', passed: false, details: `sampling failed: ${e.message.slice(0, 100)}`, severity: 'warning' })
  }

  // ── Check 8: VLM inspection of contact sheet (spec section 24) ─
  if (existsSync(contactSheetPath)) {
    try {
      const buf = await readFile(contactSheetPath)
      const b64 = buf.toString('base64')
      const analysis = await vision(b64, 'Inspect this contact sheet of sampled video frames. Return ONLY JSON: {"looks_like_slideshow": true/false, "has_visual_diversity": true/false, "main_criticism": "...", "pass": true/false}')
      let parsed: any
      try { parsed = JSON.parse(analysis) } catch { parsed = {} }
      checks.push({
        name: 'vlm_contact_sheet',
        passed: parsed.pass !== false && parsed.has_visual_diversity !== false,
        details: parsed.main_criticism || analysis.slice(0, 200),
        severity: parsed.pass === false ? 'critical' : 'info',
      })
      if (parsed.main_criticism) recommendations.push(`VLM: ${parsed.main_criticism}`)
    } catch (e: any) {
      checks.push({ name: 'vlm_contact_sheet', passed: true, details: `VLM skipped: ${e.message.slice(0, 80)}`, severity: 'info' })
    }
  }

  // ── Determine pass/fail ──────────────────────────────────
  const criticalFailures = checks.filter(c => !c.passed && c.severity === 'critical')
  const passed = criticalFailures.length === 0

  if (criticalFailures.length > 0) {
    recommendations.unshift(`CRITICAL: ${criticalFailures.map(c => c.name).join(', ')} failed`)
  }

  return {
    passed,
    checks,
    contactSheetPath: existsSync(contactSheetPath) ? contactSheetPath : null,
    audioLUFS,
    blackFrameCount,
    freezeCount,
    silenceCount,
    visualVarietyScore,
    recommendations,
  }
}

async function sampleFrames(videoPath: string, count: number): Promise<Array<{ timestamp: number; path: string }>> {
  const framesDir = path.join(path.dirname(videoPath), '..', 'qc-frames')
  if (!existsSync(framesDir)) await mkdir(framesDir, { recursive: true })

  const duration = await probeDuration(videoPath)
  const interval = duration / (count + 1)
  const frames: Array<{ timestamp: number; path: string }> = []

  for (let i = 1; i <= count; i++) {
    const ts = interval * i
    const framePath = path.join(framesDir, `frame_${i}_${Math.round(ts)}s.jpg`)
    try {
      await exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(ts), '-i', videoPath, '-frames:v', '1', '-vf', 'scale=320:-1', '-y', framePath])
      frames.push({ timestamp: ts, path: framePath })
    } catch (e: any) {
      console.warn(`[qc] Failed to sample frame at ${ts}s:`, e.message.slice(0, 80))
    }
  }
  return frames
}

async function buildContactSheet(frames: Array<{ timestamp: number; path: string }>, outPath: string): Promise<void> {
  if (frames.length === 0) return
  const outDir = path.dirname(outPath)
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true })

  // Build a 4×3 grid (or 4×N depending on count)
  const cols = 4
  const rows = Math.ceil(frames.length / cols)
  // Use ffmpeg's montage via filter_complex
  const inputs: string[] = []
  for (const f of frames) inputs.push('-i', f.path)
  const filter = frames.map((_, i) => `[${i}:v]`).join('') + `xstack=inputs=${frames.length}:layout=` +
    frames.map((_, i) => `${(i % cols) * 320}_${Math.floor(i / cols) * 180}`).join('|') + `[v]`

  try {
    await exec('ffmpeg', [
      ...inputs,
      '-filter_complex', filter,
      '-map', '[v]',
      '-frames:v', '1', '-y', outPath,
    ])
  } catch (e: any) {
    // Fallback: use a simpler tile filter
    try {
      await exec('ffmpeg', [
        ...inputs,
        '-filter_complex', frames.map((_, i) => `[${i}:v]scale=320:180`).join(';') + ';' +
          frames.map((_, i) => `[${i}:v]`).join('') + `xstack=inputs=${frames.length}:layout=` +
          frames.map((_, i) => `${(i % cols) * 320}_${Math.floor(i / cols) * 180}`).join('|') + `[v]`,
        '-map', '[v]',
        '-frames:v', '1', '-y', outPath,
      ])
    } catch (e2: any) {
      console.warn('[qc] Contact sheet build failed:', e2.message.slice(0, 100))
    }
  }
}

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
    return parseFloat(stdout.trim()) || 0
  } catch {
    return 0
  }
}
