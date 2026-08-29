/**
 * PublishingSafetyGate — hard pre-publish verification.
 *
 * Cycle 001 lesson: QualityCritic PASS was incorrectly allowed to override
 * FactChecker FAIL. This module makes that impossible.
 *
 * Each gate is INDEPENDENT. ALL must pass for publishGate to return PASS.
 * No gate can override another.
 *
 * Gates:
 *   1. FactChecker      — verdict === 'PASS'
 *   2. QualityCritic    — verdict === 'PASS'
 *   3. DurationIntegrity — narrationSum ≈ timelineTotal ≈ finalVideoDuration ≈ finalAudioDuration
 *   4. CreativeLock     — CREATIVE_LOCK === true and all 6 hashes present
 *   5. PhysicalFile     — final.mp4 exists, ffprobe-valid, h264 video stream + aac audio stream
 *   6. PrivacyMode      — privacy === 'private' (in PRIVATE_ONLY mode)
 *   7. ModeGuard        — current OperatingMode allows publish_private
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { getOperatingMode, modeCapabilities, guardAction } from './operating-mode'

const exec = promisify(execFile)

export interface GateResult {
  gate: string
  passed: boolean
  reason: string
  evidence?: unknown
}

export interface PublishGateReport {
  overall: 'PASS' | 'FAIL'
  gates: GateResult[]
  blockingGates: string[]
  timestamp: string
}

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
    return parseFloat(stdout.trim()) || 0
  } catch { return 0 }
}

async function probeStreams(filePath: string): Promise<{ videoCodec: string; audioCodec: string; width: number; height: number; videoDuration: number; audioDuration: number }> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,duration', '-of', 'json', filePath])
    const data = JSON.parse(stdout)
    const video = data.streams?.find((s: any) => s.codec_type === 'video')
    const audio = data.streams?.find((s: any) => s.codec_type === 'audio')
    return {
      videoCodec: video?.codec_name || '',
      audioCodec: audio?.codec_name || '',
      width: Number(video?.width) || 0,
      height: Number(video?.height) || 0,
      videoDuration: Number(video?.duration) || 0,
      audioDuration: Number(audio?.duration) || 0,
    }
  } catch {
    return { videoCodec: '', audioCodec: '', width: 0, height: 0, videoDuration: 0, audioDuration: 0 }
  }
}

export interface PublishGateInput {
  factCheckReport: { verdict: 'PASS' | 'FAIL'; unsupportedCount: number }
  qcReport: { verdict: 'PASS' | 'FAIL'; failingShots: unknown[] }
  narrationSumSec: number
  timelineTotalSec: number
  finalVideoPath: string
  creativeLock: {
    CREATIVE_LOCK: boolean
    scriptHash?: string
    visualShotHash?: string
    assetManifestHash?: string
    audioManifestHash?: string
    compositionHash?: string
    QCReportHash?: string
  }
  privacyMode: 'private' | 'unlisted' | 'public'
}

export async function runPublishGates(input: PublishGateInput): Promise<PublishGateReport> {
  const gates: GateResult[] = []
  const blockingGates: string[] = []

  // Gate 1: FactChecker (INDEPENDENT — QC cannot override)
  const factOk = input.factCheckReport.verdict === 'PASS'
  gates.push({
    gate: 'FactChecker',
    passed: factOk,
    reason: factOk
      ? `verdict=PASS, unsupportedCount=${input.factCheckReport.unsupportedCount}`
      : `verdict=FAIL — ${input.factCheckReport.unsupportedCount} unsupported claims. QualityCritic CANNOT override this gate.`,
    evidence: input.factCheckReport,
  })
  if (!factOk) blockingGates.push('FactChecker')

  // Gate 2: QualityCritic
  const qcOk = input.qcReport.verdict === 'PASS'
  gates.push({
    gate: 'QualityCritic',
    passed: qcOk,
    reason: qcOk
      ? `verdict=PASS, failingShots=${input.qcReport.failingShots.length}`
      : `verdict=FAIL — ${input.qcReport.failingShots.length} failing shots`,
    evidence: input.qcReport,
  })
  if (!qcOk) blockingGates.push('QualityCritic')

  // Gate 3: Duration integrity
  const finalVideoDur = await probeDuration(input.finalVideoPath)
  const streams = await probeStreams(input.finalVideoPath)
  const narrationVsTimeline = Math.abs(input.narrationSumSec - input.timelineTotalSec)
  const timelineVsVideo = Math.abs(input.timelineTotalSec - finalVideoDur)
  const videoVsAudio = Math.abs(streams.videoDuration - streams.audioDuration)
  const TOL = 1.0 // 1 second tolerance for rounding/encoder padding
  const durationOk =
    narrationVsTimeline < TOL &&
    timelineVsVideo < TOL &&
    videoVsAudio < TOL &&
    finalVideoDur > 0
  gates.push({
    gate: 'DurationIntegrity',
    passed: durationOk,
    reason: durationOk
      ? `narration=${input.narrationSumSec}s timeline=${input.timelineTotalSec}s video=${finalVideoDur}s audio=${streams.audioDuration}s (all within ${TOL}s tolerance)`
      : `MISMATCH: narration=${input.narrationSumSec}s timeline=${input.timelineTotalSec}s video=${finalVideoDur}s audio=${streams.audioDuration}s (narrationVsTimeline=${narrationVsTimeline}s timelineVsVideo=${timelineVsVideo}s videoVsAudio=${videoVsAudio}s)`,
    evidence: { narrationSumSec: input.narrationSumSec, timelineTotalSec: input.timelineTotalSec, finalVideoDur, videoStreamDur: streams.videoDuration, audioStreamDur: streams.audioDuration },
  })
  if (!durationOk) blockingGates.push('DurationIntegrity')

  // Gate 4: Creative lock
  const lock = input.creativeLock
  const requiredHashes = ['scriptHash', 'visualShotHash', 'assetManifestHash', 'audioManifestHash', 'compositionHash', 'QCReportHash']
  const missingHashes = requiredHashes.filter((h) => !(lock as any)[h])
  const lockOk = lock.CREATIVE_LOCK === true && missingHashes.length === 0
  gates.push({
    gate: 'CreativeLock',
    passed: lockOk,
    reason: lockOk
      ? 'CREATIVE_LOCK=true, all 6 hashes present'
      : `CREATIVE_LOCK=${lock.CREATIVE_LOCK}, missing hashes: ${missingHashes.join(', ') || 'none'}`,
    evidence: lock,
  })
  if (!lockOk) blockingGates.push('CreativeLock')

  // Gate 5: Physical file validity
  const fileExists = existsSync(input.finalVideoPath)
  const ffprobeValid = fileExists && streams.videoCodec !== '' && streams.audioCodec !== ''
  const h264 = streams.videoCodec === 'h264'
  const aac = streams.audioCodec === 'aac'
  const resolutionOk = streams.width === 1920 && streams.height === 1080
  const fileOk = fileExists && ffprobeValid && h264 && aac && resolutionOk
  gates.push({
    gate: 'PhysicalFile',
    passed: fileOk,
    reason: fileOk
      ? `${input.finalVideoPath} exists, h264+aac, ${streams.width}x${streams.height}, video=${streams.videoDuration}s audio=${streams.audioDuration}s`
      : `file exists=${fileExists}, videoCodec=${streams.videoCodec || 'none'} (need h264), audioCodec=${streams.audioCodec || 'none'} (need aac), resolution=${streams.width}x${streams.height} (need 1920x1080)`,
    evidence: { path: input.finalVideoPath, exists: fileExists, ...streams },
  })
  if (!fileOk) blockingGates.push('PhysicalFile')

  // Gate 6: Privacy mode (PRIVATE_ONLY requires private)
  const mode = await getOperatingMode()
  const caps = modeCapabilities(mode)
  let privacyOk = true
  let privacyReason = `privacy=${input.privacyMode} (mode=${mode})`
  if (mode === 'PRIVATE_ONLY' && input.privacyMode !== 'private') {
    privacyOk = false
    privacyReason = `PRIVATE_ONLY mode requires privacy=private, got ${input.privacyMode}`
  } else if (mode === 'REVIEW_BEFORE_PUBLIC' && input.privacyMode === 'public') {
    privacyOk = false
    privacyReason = `REVIEW_BEFORE_PUBLIC mode requires human approval before public — privacy=public requested without approval`
  }
  gates.push({ gate: 'PrivacyMode', passed: privacyOk, reason: privacyReason, evidence: { privacyMode: input.privacyMode, mode } })
  if (!privacyOk) blockingGates.push('PrivacyMode')

  // Gate 7: Mode guard
  let modeOk = true
  let modeReason = `mode=${mode} allows publish_private=${caps.canPublishPrivate}`
  try {
    await guardAction('publish_private')
  } catch (e) {
    modeOk = false
    modeReason = e instanceof Error ? e.message : String(e)
  }
  gates.push({ gate: 'ModeGuard', passed: modeOk, reason: modeReason, evidence: { mode, caps } })
  if (!modeOk) blockingGates.push('ModeGuard')

  return {
    overall: blockingGates.length === 0 ? 'PASS' : 'FAIL',
    gates,
    blockingGates,
    timestamp: new Date().toISOString(),
  }
}
