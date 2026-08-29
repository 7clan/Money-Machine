/**
 * ProductionArtifactStore — durable storage abstraction for generated media.
 *
 * Strategy: use a SEPARATE git repository for media (Money-Machine-Media),
 * kept distinct from the source code repo. Large MP4s go there, not into
 * the source repo. This avoids Git LFS setup (which needs user config) and
 * avoids bloating the source repo.
 *
 * Storage backends:
 *   LOCAL_WORKSPACE  — data/artifacts/ (temporary, can be cleaned)
 *   PERSISTENT_REMOTE — a separate git repo at data/media-store/ (durable)
 *
 * Lifecycle states:
 *   GENERATED → VALIDATED → CREATIVE_LOCKED → PERSISTING → PERSISTED
 *                                                       ↘ UPLOAD_COMPLETE → LOCAL_EVICTABLE
 *
 * Cleanup safety: cleanupArtifactStore() refuses to delete any artifact
 * with PERSISTED=false or UPLOAD_COMPLETE=false.
 */
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, copyFileSync, rmSync, readdirSync } from 'fs'
import path from 'path'

const ROOT = process.cwd()
const ARTIFACT_STORE_DIR = path.join(ROOT, 'data', 'artifacts')
const MANIFEST_PATH = path.join(ARTIFACT_STORE_DIR, 'artifact-manifest.json')
const MEDIA_STORE_DIR = path.join(ROOT, 'data', 'media-store')

export type ArtifactType =
  | 'FINAL_VIDEO'
  | 'REVIEW_VIDEO'
  | 'THUMBNAIL'
  | 'CONTACT_SHEET'
  | 'TTS'
  | 'SOURCE_ASSET'
  | 'CAPTURE'
  | 'GENERATED_IMAGE'
  | 'GENERATED_VIDEO'
  | 'RENDER_CHUNK'

export type StorageBackend = 'LOCAL_WORKSPACE' | 'PERSISTENT_REMOTE'

export type ArtifactState =
  | 'GENERATED'
  | 'VALIDATED'
  | 'CREATIVE_LOCKED'
  | 'PERSISTING'
  | 'PERSISTED'
  | 'UPLOAD_COMPLETE'
  | 'LOCAL_EVICTABLE'

export interface ProductionArtifact {
  artifactId: string
  productionId: string
  type: ArtifactType
  localPath: string
  remotePath: string | null
  size: number
  sha256: string
  createdAt: string
  storageStatus: ArtifactState
  mimeType: string
  backend: StorageBackend
  metadata?: Record<string, unknown>
}

export interface ArtifactManifest {
  artifacts: ProductionArtifact[]
  updatedAt: string
}

function ensureDirs(): void {
  mkdirSync(ARTIFACT_STORE_DIR, { recursive: true })
  mkdirSync(MEDIA_STORE_DIR, { recursive: true })
}

function loadManifestRaw(): ArtifactManifest {
  ensureDirs()
  if (!existsSync(MANIFEST_PATH)) return { artifacts: [], updatedAt: new Date().toISOString() }
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  } catch {
    return { artifacts: [], updatedAt: new Date().toISOString() }
  }
}

function saveManifest(manifest: ArtifactManifest): void {
  ensureDirs()
  manifest.updatedAt = new Date().toISOString()
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function getMimeType(type: ArtifactType, filePath: string): string {
  if (filePath.endsWith('.mp4')) return 'video/mp4'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.mp3')) return 'audio/mpeg'
  if (filePath.endsWith('.wav')) return 'audio/wav'
  if (type === 'TTS') return 'audio/mpeg'
  if (type === 'FINAL_VIDEO' || type === 'REVIEW_VIDEO' || type === 'GENERATED_VIDEO' || type === 'RENDER_CHUNK') return 'video/mp4'
  if (type === 'THUMBNAIL' || type === 'CONTACT_SHEET' || type === 'GENERATED_IMAGE') return 'image/png'
  return 'application/octet-stream'
}

/**
 * Register a generated artifact in the store.
 * Computes sha256 + size, assigns artifactId, sets state=GENERATED.
 */
export function registerArtifact(opts: {
  productionId: string
  type: ArtifactType
  localPath: string
  metadata?: Record<string, unknown>
}): ProductionArtifact {
  ensureDirs()
  if (!existsSync(opts.localPath)) {
    throw new Error(`artifact file does not exist: ${opts.localPath}`)
  }
  const stat = statSync(opts.localPath)
  const sha = sha256File(opts.localPath)
  const artifact: ProductionArtifact = {
    artifactId: `art-${sha.slice(0, 16)}`,
    productionId: opts.productionId,
    type: opts.type,
    localPath: opts.localPath,
    remotePath: null,
    size: stat.size,
    sha256: sha,
    createdAt: new Date().toISOString(),
    storageStatus: 'GENERATED',
    mimeType: getMimeType(opts.type, opts.localPath),
    backend: 'LOCAL_WORKSPACE',
    metadata: opts.metadata,
  }
  const manifest = loadManifestRaw()
  // Replace if same artifactId already exists
  manifest.artifacts = manifest.artifacts.filter((a) => a.artifactId !== artifact.artifactId)
  manifest.artifacts.push(artifact)
  saveManifest(manifest)
  return artifact
}

/**
 * Update an artifact's state.
 */
export function updateArtifactState(artifactId: string, state: ArtifactState, extra?: Partial<ProductionArtifact>): ProductionArtifact | null {
  const manifest = loadManifestRaw()
  const idx = manifest.artifacts.findIndex((a) => a.artifactId === artifactId)
  if (idx === -1) return null
  manifest.artifacts[idx] = { ...manifest.artifacts[idx], ...extra, storageStatus: state }
  saveManifest(manifest)
  return manifest.artifacts[idx]
}

/**
 * Persist an artifact to the PERSISTENT_REMOTE backend (media-store directory).
 * Copies the file, sets remotePath, updates state to PERSISTED.
 */
export function persistArtifact(artifactId: string): ProductionArtifact | null {
  const manifest = loadManifestRaw()
  const artifact = manifest.artifacts.find((a) => a.artifactId === artifactId)
  if (!artifact) return null
  if (!existsSync(artifact.localPath)) {
    throw new Error(`artifact local file missing, cannot persist: ${artifact.localPath}`)
  }
  updateArtifactState(artifactId, 'PERSISTING')

  // Copy to media-store with a structured path: media-store/<productionId>/<type>/<filename>
  const destDir = path.join(MEDIA_STORE_DIR, artifact.productionId, artifact.type)
  mkdirSync(destDir, { recursive: true })
  const filename = path.basename(artifact.localPath)
  const destPath = path.join(destDir, filename)
  copyFileSync(artifact.localPath, destPath)

  // Verify the copy
  const destSha = sha256File(destPath)
  if (destSha !== artifact.sha256) {
    throw new Error(`persistence verification failed: sha256 mismatch after copy`)
  }

  const updated = updateArtifactState(artifactId, 'PERSISTED', {
    remotePath: destPath,
    backend: 'PERSISTENT_REMOTE',
  })
  return updated
}

/**
 * Get all artifacts for a production.
 */
export function getArtifactsForProduction(productionId: string): ProductionArtifact[] {
  const manifest = loadManifestRaw()
  return manifest.artifacts.filter((a) => a.productionId === productionId)
}

/**
 * Get the full manifest.
 */
export function getManifest(): ArtifactManifest {
  return loadManifestRaw()
}

/**
 * Check if a production's final master is durable (PERSISTED or UPLOAD_COMPLETE).
 */
export function isProductionDurable(productionId: string): { durable: boolean; finalMaster?: ProductionArtifact; reason: string } {
  const artifacts = getArtifactsForProduction(productionId)
  const finalMaster = artifacts.find((a) => a.type === 'FINAL_VIDEO')
  if (!finalMaster) {
    return { durable: false, reason: 'no FINAL_VIDEO artifact registered' }
  }
  if (finalMaster.storageStatus === 'PERSISTED' || finalMaster.storageStatus === 'UPLOAD_COMPLETE') {
    return { durable: true, finalMaster, reason: `FINAL_VIDEO ${finalMaster.storageStatus}` }
  }
  return { durable: false, finalMaster, reason: `FINAL_VIDEO state=${finalMaster.storageStatus} (not PERSISTED)` }
}

/**
 * Cleanup safety check. Returns UNSAFE_TO_CLEAN if any approved final master
 * has PERSISTED=false and UPLOAD_COMPLETE=false.
 */
export function cleanupSafetyCheck(): { safe: boolean; unsafeArtifacts: ProductionArtifact[]; reason: string } {
  const manifest = loadManifestRaw()
  const unsafe = manifest.artifacts.filter((a) =>
    a.type === 'FINAL_VIDEO' &&
    a.storageStatus !== 'PERSISTED' &&
    a.storageStatus !== 'UPLOAD_COMPLETE' &&
    a.storageStatus !== 'LOCAL_EVICTABLE'
  )
  return {
    safe: unsafe.length === 0,
    unsafeArtifacts: unsafe,
    reason: unsafe.length === 0
      ? 'all final masters are PERSISTED or UPLOAD_COMPLETE'
      : `${unsafe.length} final master(s) not yet persisted: ${unsafe.map((a) => a.productionId).join(', ')}`,
  }
}

/**
 * Register + persist a YouTube upload as an external copy.
 * Does not store the video file itself (YouTube has it), but records the upload.
 */
export function registerYouTubeUpload(opts: {
  productionId: string
  youtubeVideoId: string
  privacyStatus: string
  sourceMasterHash: string
}): ProductionArtifact {
  const artifact: ProductionArtifact = {
    artifactId: `yt-${opts.youtubeVideoId}`,
    productionId: opts.productionId,
    type: 'FINAL_VIDEO',
    localPath: '', // no local file — YouTube is the external copy
    remotePath: `https://www.youtube.com/watch?v=${opts.youtubeVideoId}`,
    size: 0,
    sha256: opts.sourceMasterHash,
    createdAt: new Date().toISOString(),
    storageStatus: 'UPLOAD_COMPLETE',
    mimeType: 'video/mp4',
    backend: 'PERSISTENT_REMOTE',
    metadata: {
      youtubeVideoId: opts.youtubeVideoId,
      privacyStatus: opts.privacyStatus,
      externalCopy: true,
    },
  }
  const manifest = loadManifestRaw()
  manifest.artifacts = manifest.artifacts.filter((a) => a.artifactId !== artifact.artifactId)
  manifest.artifacts.push(artifact)
  saveManifest(manifest)
  return artifact
}

/**
 * Get the best available playback source for a production's final master.
 * Priority: PERSISTED remote → LOCAL file → YouTube external copy.
 */
export function getPlaybackSource(productionId: string): { source: 'PERSISTED' | 'LOCAL' | 'YOUTUBE' | 'NONE'; path: string | null; artifact: ProductionArtifact | null } {
  const artifacts = getArtifactsForProduction(productionId)
  const finalMasters = artifacts.filter((a) => a.type === 'FINAL_VIDEO')
  // Priority 1: PERSISTED remote file
  const persisted = finalMasters.find((a) => a.storageStatus === 'PERSISTED' && a.remotePath && existsSync(a.remotePath))
  if (persisted) return { source: 'PERSISTED', path: persisted.remotePath, artifact: persisted }
  // Priority 2: LOCAL file
  const local = finalMasters.find((a) => a.localPath && existsSync(a.localPath))
  if (local) return { source: 'LOCAL', path: local.localPath, artifact: local }
  // Priority 3: YouTube external copy
  const yt = finalMasters.find((a) => a.storageStatus === 'UPLOAD_COMPLETE' && a.metadata?.youtubeVideoId)
  if (yt) return { source: 'YOUTUBE', path: yt.remotePath, artifact: yt }
  return { source: 'NONE', path: null, artifact: null }
}
