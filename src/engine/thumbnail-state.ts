/**
 * ThumbnailStateMachine — formal lifecycle for thumbnail production.
 *
 * States (strict progression):
 *   CONCEPT_READY    — concept artifact exists (visualSubject, composition, emotion, textIfAny, curiosityMechanism)
 *   FILE_READY       — actual PNG/JPG file exists on disk
 *   QC_PASS          — file passed QC (dimensions, size, no deceptive UI)
 *   UPLOAD_PASS      — file successfully uploaded to YouTube
 *   BLOCKED_PERMISSION — upload failed due to YouTube account/channel permission (e.g., 403 forbidden)
 *   FAIL             — any stage failed (creation error, QC fail, upload error other than permission)
 *
 * A concept ALONE must NEVER be reported as "thumbnail creation PASS".
 * Only FILE_READY or later with QC_PASS counts as creation success.
 */
import { existsSync, statSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

export type ThumbnailState =
  | 'CONCEPT_READY'
  | 'FILE_READY'
  | 'QC_PASS'
  | 'UPLOAD_PASS'
  | 'BLOCKED_PERMISSION'
  | 'FAIL'

export interface ThumbnailConcept {
  visualSubject: string
  composition: string
  emotion: string
  textIfAny: string
  curiosityMechanism: string
}

export interface ThumbnailQC {
  width: number
  height: number
  sizeBytes: number
  dimensionsOk: boolean
  sizeUnder2MB: boolean
  noDeceptiveProductUI: boolean
  verdict: 'PASS' | 'FAIL'
}

export interface ThumbnailStatus {
  state: ThumbnailState
  conceptReady: boolean
  fileReady: boolean
  qcPass: boolean
  uploadPass: boolean
  blockedPermission: boolean
  failed: boolean
  concept?: ThumbnailConcept
  filePath?: string
  qc?: ThumbnailQC
  videoId?: string
  uploadError?: string
  // Human-readable creation status — only TRUE if state >= FILE_READY && qcPass
  creationOk: boolean
  // Human-readable upload status
  uploadOk: boolean
}

export function isConceptValid(c: unknown): c is ThumbnailConcept {
  if (!c || typeof c !== 'object') return false
  const o = c as Record<string, unknown>
  return (
    typeof o.visualSubject === 'string' && o.visualSubject.length > 0 &&
    typeof o.composition === 'string' && o.composition.length > 0 &&
    typeof o.emotion === 'string' && o.emotion.length > 0 &&
    typeof o.curiosityMechanism === 'string' && o.curiosityMechanism.length > 0
  )
}

export function isQcPass(qc: unknown): qc is ThumbnailQC {
  if (!qc || typeof qc !== 'object') return false
  const o = qc as Record<string, unknown>
  return (
    typeof o.width === 'number' && o.width === 1280 &&
    typeof o.height === 'number' && o.height === 720 &&
    typeof o.sizeUnder2MB === 'boolean' && o.sizeUnder2MB === true &&
    typeof o.dimensionsOk === 'boolean' && o.dimensionsOk === true &&
    typeof o.noDeceptiveProductUI === 'boolean' && o.noDeceptiveProductUI === true &&
    (o.verdict === 'PASS' || o.verdict === 'FAIL') &&
    o.verdict === 'PASS'
  )
}

export function isFileReady(filePath: string): boolean {
  if (!filePath || !existsSync(filePath)) return false
  try {
    const stat = statSync(filePath)
    return stat.isFile() && stat.size > 1000 // at least 1KB
  } catch { return false }
}

export function buildThumbnailStatus(opts: {
  concept?: unknown
  filePath?: string
  qc?: unknown
  uploadStatus?: 'PASS' | 'BLOCKED_PERMISSION' | 'BLOCKED_ERROR' | 'SKIPPED' | 'NOT_ATTEMPTED'
  uploadError?: string
  videoId?: string
}): ThumbnailStatus {
  const conceptReady = isConceptValid(opts.concept)
  const fileReady = opts.filePath ? isFileReady(opts.filePath) : false
  const qcPass = isQcPass(opts.qc)
  const uploadPass = opts.uploadStatus === 'PASS'
  const blockedPermission = opts.uploadStatus === 'BLOCKED_PERMISSION'
  const failed = !conceptReady && !fileReady ? false : (!fileReady && conceptReady ? false : (opts.uploadStatus === 'BLOCKED_ERROR' || (opts.qc && !qcPass ? true : false)))

  let state: ThumbnailState
  if (uploadPass) state = 'UPLOAD_PASS'
  else if (blockedPermission) state = 'BLOCKED_PERMISSION'
  else if (qcPass) state = 'QC_PASS'
  else if (fileReady) state = 'FILE_READY'
  else if (conceptReady) state = 'CONCEPT_READY'
  else state = 'FAIL'

  // If QC ran and failed, that's a hard FAIL (overrides FILE_READY)
  if (opts.qc && !qcPass && !uploadPass && !blockedPermission) state = 'FAIL'

  return {
    state,
    conceptReady,
    fileReady,
    qcPass,
    uploadPass,
    blockedPermission,
    failed: state === 'FAIL',
    concept: conceptReady ? (opts.concept as ThumbnailConcept) : undefined,
    filePath: opts.filePath,
    qc: qcPass ? (opts.qc as ThumbnailQC) : undefined,
    videoId: opts.videoId,
    uploadError: opts.uploadError,
    // creationOk is TRUE only when file exists AND QC passed
    creationOk: fileReady && qcPass,
    uploadOk: uploadPass,
  }
}
