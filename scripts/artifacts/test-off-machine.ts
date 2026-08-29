import { registerArtifact, persistArtifactToLocalStore, persistArtifactOffMachine, getManifest } from '../../src/engine/artifact-store'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import path from 'path'

// Load .env manually (standalone script doesn't get Next.js env loading)
try {
  const envContent = readFileSync('.env', 'utf8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  }
} catch { /* ignore */ }

async function main() {
  // Create a small test file
  mkdirSync('data/artifacts', { recursive: true })
  const testPath = path.join('data', 'artifacts', 'test-upload.txt')
  writeFileSync(testPath, 'OFF_MACHINE_STORAGE_TEST — this file verifies GitHub Releases upload works.\nCreated: ' + new Date().toISOString() + '\n')

  // Register + persist locally + upload off-machine
  const art = registerArtifact({ productionId: 'test-upload', type: 'TTS' as any, localPath: testPath })
  console.log('registered:', art.artifactId)

  const local = persistArtifactToLocalStore(art.artifactId)
  console.log('local persisted:', local?.storageStatus)

  const offMachine = await persistArtifactOffMachine(art.artifactId)
  console.log('off-machine persisted:', offMachine?.storageStatus)
  console.log('download URL:', offMachine?.offMachinePath)
  console.log('backend:', offMachine?.backend)

  // Verify the manifest
  const manifest = getManifest()
  console.log('\nmanifest artifacts:', manifest.artifacts.length)
  for (const a of manifest.artifacts) {
    console.log('  ', a.artifactId, '|', a.productionId, '|', a.type, '|', a.storageStatus, '|', a.backend)
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
