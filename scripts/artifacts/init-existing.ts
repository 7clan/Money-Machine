/**
 * Initialize the artifact store with existing YouTube uploads.
 *
 * Registers the 2 existing private YouTube videos as UPLOAD_COMPLETE artifacts.
 * These are external copies — the local MP4s are gone, but YouTube has them.
 *
 * Run: bunx tsx scripts/artifacts/init-existing.ts
 */
import {
  registerYouTubeUpload,
  getManifest,
} from '../../src/engine/artifact-store'

function main() {
  console.log('=== Initializing artifact store with existing YouTube uploads ===')

  // Autonomous Cycle 001 — corrected v2 master
  registerYouTubeUpload({
    productionId: 'autonomous-cycle-001-v2',
    youtubeVideoId: 'BkntTZ2rsmU',
    privacyStatus: 'private',
    sourceMasterHash: 'ab74d0ba4e22a98b',
  })
  console.log('  ✓ Registered: autonomous-cycle-001-v2 → BkntTZ2rsmU (private)')

  // Autonomous Cycle 001 — pre-repair truncated (superseded)
  registerYouTubeUpload({
    productionId: 'autonomous-cycle-001-pre-repair',
    youtubeVideoId: 'LP1QgQwBN5o',
    privacyStatus: 'private',
    sourceMasterHash: 'pre-repair-truncated',
  })
  console.log('  ✓ Registered: autonomous-cycle-001-pre-repair → LP1QgQwBN5o (private)')

  const manifest = getManifest()
  console.log(`\nArtifact manifest: ${manifest.artifacts.length} artifacts`)
  for (const a of manifest.artifacts) {
    console.log(`  ${a.artifactId} | ${a.productionId} | ${a.type} | ${a.storageStatus} | ${a.backend}`)
  }
  console.log(`\nManifest path: data/artifacts/artifact-manifest.json`)
}

main()
