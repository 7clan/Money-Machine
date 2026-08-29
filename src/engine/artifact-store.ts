/**
 * ProductionArtifactStore — storage abstraction for generated media.
 *
 * HONEST CLASSIFICATION (corrected per user feedback):
 *
 * Storage backends:
 *   LOCAL_WORKSPACE    — data/artifacts/ (temporary, same Z.ai workspace)
 *   LOCAL_MEDIA_STORE  — data/media-store/ (local durable copy, survives app-level
 *                        cleanup but NOT workspace/container/machine loss)
 *   OFF_MACHINE        — GitHub Releases / S3 / separate media repo (TRUE external
 *                        durability — survives full environment loss)
 *
 * Until OFF_MACHINE storage is configured, FINAL_MASTER_DURABLE = false
 * even if LOCAL_MEDIA_STORE copy exists. A local copy alone is NOT durable.
 *
 * Lifecycle states:
 *   GENERATED → VALIDATED → CREATIVE_LOCKED → LOCAL_PERSISTED → OFF_MACHINE_PERSISTED
 *                                                       ↘ UPLOAD_COMPLETE (YouTube) → LOCAL_EVICTABLE
 *
 * Cleanup safety: cleanupSafetyCheck() refuses to delete any artifact
 * with LOCAL_PERSISTED=false AND UPLOAD_COMPLETE=false.
 * NOTE: LOCAL_PERSISTED protects against app-level cleanup only.
 *       OFF_MACHINE_PERSISTED is required for true durability.
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

export type StorageBackend = 'LOCAL_WORKSPACE' | 'LOCAL_MEDIA_STORE' | 'OFF_MACHINE' | 'YOUTUBE_EXTERNAL'

export type ArtifactState =
  | 'GENERATED'
  | 'VALIDATED'
  | 'CREATIVE_LOCKED'
  | 'LOCAL_PERSISTING'
  | 'LOCAL_PERSISTED'
  | 'OFF_MACHINE_PERSISTING'
  | 'OFF_MACHINE_PERSISTED'
  | 'UPLOAD_COMPLETE'
  | 'LOCAL_EVICTABLE'

export interface ProductionArtifact {
  artifactId: string
  productionId: string
  type: ArtifactType
  localPath: string          // LOCAL_WORKSPACE path
  mediaStorePath: string | null  // LOCAL_MEDIA_STORE path (data/media-store/)
  offMachinePath: string | null  // OFF_MACHINE URL/URI (GitHub Releases asset URL, S3 URL, etc.)
  size: number
  sha256: string
  createdAt: string
  storageStatus: ArtifactState
  mimeType: string
  backend: StorageBackend    // highest backend achieved
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
    mediaStorePath: null,
    offMachinePath: null,
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
 * Persist an artifact to LOCAL_MEDIA_STORE (data/media-store/).
 * Copies the file, verifies sha256, sets state to LOCAL_PERSISTED.
 *
 * IMPORTANT: This is NOT off-machine durability. The file is still inside
 * the Z.ai workspace. For true durability, call persistOffMachine() after this.
 */
export function persistArtifactToLocalStore(artifactId: string): ProductionArtifact | null {
  const manifest = loadManifestRaw()
  const artifact = manifest.artifacts.find((a) => a.artifactId === artifactId)
  if (!artifact) return null
  if (!existsSync(artifact.localPath)) {
    throw new Error(`artifact local file missing, cannot persist: ${artifact.localPath}`)
  }
  updateArtifactState(artifactId, 'LOCAL_PERSISTING')

  // Copy to media-store with a structured path: media-store/<productionId>/<type>/<filename>
  const destDir = path.join(MEDIA_STORE_DIR, artifact.productionId, artifact.type)
  mkdirSync(destDir, { recursive: true })
  const filename = path.basename(artifact.localPath)
  const destPath = path.join(destDir, filename)
  copyFileSync(artifact.localPath, destPath)

  // Verify the copy
  const destSha = sha256File(destPath)
  if (destSha !== artifact.sha256) {
    throw new Error(`local persistence verification failed: sha256 mismatch after copy`)
  }

  const updated = updateArtifactState(artifactId, 'LOCAL_PERSISTED', {
    mediaStorePath: destPath,
    backend: 'LOCAL_MEDIA_STORE',
  })
  return updated
}

/**
 * Persist an artifact to OFF_MACHINE storage via GitHub Releases.
 * This is the ONLY path that achieves FINAL_MASTER_DURABLE = true.
 *
 * Flow:
 *   1. Find or create a GitHub Release tagged `media-<productionId>`
 *   2. Upload the artifact file as a release asset
 *   3. Get the browser_download_url
 *   4. Verify via HEAD request (HTTP 200 + content-length matches)
 *   5. Set offMachinePath + state = OFF_MACHINE_PERSISTED
 *
 * Requires GITHUB_TOKEN env var (PAT with repo scope).
 * Requires the artifact to be LOCAL_PERSISTED first (file must exist on disk).
 */
export async function persistArtifactOffMachine(artifactId: string): Promise<ProductionArtifact | null> {
  const manifest = loadManifestRaw()
  const artifact = manifest.artifacts.find((a) => a.artifactId === artifactId)
  if (!artifact) return null

  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (!githubToken) {
    throw new Error('OFF_MACHINE_STORAGE_NOT_CONFIGURED: Set GITHUB_TOKEN env var to enable GitHub Releases upload.')
  }

  // Determine the physical file to upload (prefer mediaStorePath, fallback localPath)
  const filePath = artifact.mediaStorePath && existsSync(artifact.mediaStorePath)
    ? artifact.mediaStorePath
    : artifact.localPath && existsSync(artifact.localPath)
      ? artifact.localPath
      : null
  if (!filePath) {
    throw new Error(`artifact file not found on disk (localPath=${artifact.localPath}, mediaStorePath=${artifact.mediaStorePath}). Call persistArtifactToLocalStore() first.`)
  }

  updateArtifactState(artifactId, 'OFF_MACHINE_PERSISTING')

  const GITHUB_OWNER = '7clan'
  const GITHUB_REPO = 'Money-Machine'
  const releaseTag = `media-${artifact.productionId}`
  const assetName = `${artifact.type}-${path.basename(filePath)}`

  try {
    // Step 1: Find or create the release
    let releaseId: number
    let uploadUrl: string
    const findRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${releaseTag}`, {
      headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github+json' },
    })
    if (findRes.status === 200) {
      const release = await findRes.json()
      releaseId = release.id
      uploadUrl = release.upload_url.replace('{?name,label}', '')
    } else if (findRes.status === 404) {
      // Create the release
      const createRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`, {
        method: 'POST',
        headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: releaseTag,
          name: `Media: ${artifact.productionId}`,
          body: `Off-machine media artifacts for production ${artifact.productionId}.\nArtifact: ${artifact.artifactId}\nType: ${artifact.type}\nSHA256: ${artifact.sha256}\nSize: ${artifact.size} bytes`,
          draft: false,
          prerelease: true,
        }),
      })
      if (!createRes.ok) {
        const errBody = await createRes.text()
        throw new Error(`GitHub create release failed (${createRes.status}): ${errBody.slice(0, 300)}`)
      }
      const release = await createRes.json()
      releaseId = release.id
      uploadUrl = release.upload_url.replace('{?name,label}', '')
    } else {
      const errBody = await findRes.text()
      throw new Error(`GitHub find release failed (${findRes.status}): ${errBody.slice(0, 300)}`)
    }

    // Step 2: Check if asset already exists on this release (delete if so — we're re-uploading)
    const assetsRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/${releaseId}/assets`, {
      headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github+json' },
    })
    if (assetsRes.ok) {
      const assets = await assetsRes.json()
      const existing = (assets as any[]).find((a) => a.name === assetName)
      if (existing) {
        await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/assets/${existing.id}`, {
          method: 'DELETE',
          headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github+json' },
        })
      }
    }

    // Step 3: Upload the asset
    const fileBuffer = readFileSync(filePath)
    const uploadRes = await fetch(`${uploadUrl}?name=${encodeURIComponent(assetName)}`, {
      method: 'POST',
      headers: {
        Authorization: `token ${githubToken}`,
        'Content-Type': artifact.mimeType,
        'Content-Length': String(fileBuffer.length),
      },
      body: fileBuffer,
    })
    if (!uploadRes.ok) {
      const errBody = await uploadRes.text()
      throw new Error(`GitHub asset upload failed (${uploadRes.status}): ${errBody.slice(0, 300)}`)
    }
    const uploadedAsset = await uploadRes.json()
    const downloadUrl = uploadedAsset.browser_download_url

    // Step 4: Verify via HEAD request
    const verifyRes = await fetch(downloadUrl, { method: 'HEAD' })
    if (!verifyRes.ok) {
      throw new Error(`off-machine verification failed: HEAD ${downloadUrl} returned ${verifyRes.status}`)
    }
    const contentLength = Number(verifyRes.headers.get('content-length') || 0)
    if (contentLength !== artifact.size) {
      throw new Error(`off-machine verification failed: content-length ${contentLength} != expected ${artifact.size}`)
    }

    // Step 5: Update artifact state
    const updated = updateArtifactState(artifactId, 'OFF_MACHINE_PERSISTED', {
      offMachinePath: downloadUrl,
      backend: 'OFF_MACHINE',
    })
    return updated
  } catch (e) {
    // Revert state on failure
    updateArtifactState(artifactId, 'LOCAL_PERSISTED')
    throw e
  }
}

/** Backward-compat alias for persistArtifactToLocalStore */
export const persistArtifact = persistArtifactToLocalStore

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
 * Check if a production's final master is TRULY durable (off-machine or YouTube).
 * LOCAL_PERSISTED alone is NOT durable — the Z.ai workspace can be reset.
 */
export function isProductionDurable(productionId: string): { durable: boolean; finalMaster?: ProductionArtifact; reason: string } {
  const artifacts = getArtifactsForProduction(productionId)
  const finalMaster = artifacts.find((a) => a.type === 'FINAL_VIDEO')
  if (!finalMaster) {
    return { durable: false, reason: 'no FINAL_VIDEO artifact registered' }
  }
  // Truly durable = OFF_MACHINE_PERSISTED or UPLOAD_COMPLETE (YouTube)
  if (finalMaster.storageStatus === 'OFF_MACHINE_PERSISTED') {
    return { durable: true, finalMaster, reason: 'FINAL_VIDEO OFF_MACHINE_PERSISTED' }
  }
  if (finalMaster.storageStatus === 'UPLOAD_COMPLETE') {
    return { durable: true, finalMaster, reason: 'FINAL_VIDEO UPLOAD_COMPLETE (YouTube external copy)' }
  }
  // LOCAL_PERSISTED is NOT durable
  if (finalMaster.storageStatus === 'LOCAL_PERSISTED') {
    return { durable: false, finalMaster, reason: 'FINAL_VIDEO LOCAL_PERSISTED only — NOT off-machine durable. Workspace reset would lose this file.' }
  }
  return { durable: false, finalMaster, reason: `FINAL_VIDEO state=${finalMaster.storageStatus}` }
}

/**
 * Cleanup safety check. Returns UNSAFE_TO_CLEAN if any approved final master
 * has not been persisted to LOCAL_MEDIA_STORE AND is not UPLOAD_COMPLETE.
 *
 * NOTE: This protects against app-level cleanup only.
 * For true durability, OFF_MACHINE_PERSISTED is required.
 */
export function cleanupSafetyCheck(): { safe: boolean; unsafeArtifacts: ProductionArtifact[]; reason: string } {
  const manifest = loadManifestRaw()
  const unsafe = manifest.artifacts.filter((a) =>
    a.type === 'FINAL_VIDEO' &&
    a.storageStatus !== 'LOCAL_PERSISTED' &&
    a.storageStatus !== 'OFF_MACHINE_PERSISTED' &&
    a.storageStatus !== 'UPLOAD_COMPLETE' &&
    a.storageStatus !== 'LOCAL_EVICTABLE'
  )
  return {
    safe: unsafe.length === 0,
    unsafeArtifacts: unsafe,
    reason: unsafe.length === 0
      ? 'all final masters are LOCAL_PERSISTED or UPLOAD_COMPLETE (NOTE: LOCAL_PERSISTED is not off-machine durable)'
      : `${unsafe.length} final master(s) not yet locally persisted: ${unsafe.map((a) => a.productionId).join(', ')}`,
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
    localPath: '',
    mediaStorePath: null,
    offMachinePath: `https://www.youtube.com/watch?v=${opts.youtubeVideoId}`,
    size: 0,
    sha256: opts.sourceMasterHash,
    createdAt: new Date().toISOString(),
    storageStatus: 'UPLOAD_COMPLETE',
    mimeType: 'video/mp4',
    backend: 'YOUTUBE_EXTERNAL',
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
 * Priority: OFF_MACHINE_PERSISTED → LOCAL_MEDIA_STORE → LOCAL_WORKSPACE → YouTube external.
 */
export function getPlaybackSource(productionId: string): { source: 'OFF_MACHINE' | 'LOCAL_STORE' | 'LOCAL' | 'YOUTUBE' | 'NONE'; path: string | null; artifact: ProductionArtifact | null } {
  const artifacts = getArtifactsForProduction(productionId)
  const finalMasters = artifacts.filter((a) => a.type === 'FINAL_VIDEO')
  // Priority 1: OFF_MACHINE persisted file
  const offMachine = finalMasters.find((a) => a.storageStatus === 'OFF_MACHINE_PERSISTED' && a.offMachinePath)
  if (offMachine) return { source: 'OFF_MACHINE', path: offMachine.offMachinePath, artifact: offMachine }
  // Priority 2: LOCAL_MEDIA_STORE file
  const localStore = finalMasters.find((a) => a.mediaStorePath && existsSync(a.mediaStorePath))
  if (localStore) return { source: 'LOCAL_STORE', path: localStore.mediaStorePath, artifact: localStore }
  // Priority 3: LOCAL_WORKSPACE file
  const local = finalMasters.find((a) => a.localPath && existsSync(a.localPath))
  if (local) return { source: 'LOCAL', path: local.localPath, artifact: local }
  // Priority 4: YouTube external copy
  const yt = finalMasters.find((a) => a.storageStatus === 'UPLOAD_COMPLETE' && a.metadata?.youtubeVideoId)
  if (yt) return { source: 'YOUTUBE', path: yt.offMachinePath, artifact: yt }
  return { source: 'NONE', path: null, artifact: null }
}
