import { db } from './src/lib/db'
import { unlink, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

async function main() {
  await db.videoProject.update({
    where: { id: 'cmt4yh4nf000bmajq976v6csn' },
    data: {
      status: 'planning', renderProgress: 0,
      editorNotes: null, reviewResult: null,
      videoFilePath: null, thumbnailPath: null, captionPath: null,
      duration: null, fileSize: null,
    },
  })
  // Delete stale checkpoint
  const cpPath = 'data/pipeline-state/cmt4yh4nf000bmajq976v6csn.json'
  if (existsSync(cpPath)) await unlink(cpPath)
  // Delete stale audio files for this project's script
  const audioDir = 'data/audio'
  if (existsSync(audioDir)) {
    const { readdir } = await import('fs/promises')
    const files = await readdir(audioDir)
    for (const f of files) {
      if (f.includes('cmt4yh4nc') || f.includes('cmt4yh4nf')) {
        try { await unlink(path.join(audioDir, f)) } catch {}
      }
    }
  }
  // Delete stale Z.ai cache (force fresh)
  const cacheDir = 'data/zai-cache'
  if (existsSync(cacheDir)) await rm(cacheDir, { recursive: true })
  console.log('Reset complete')
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
