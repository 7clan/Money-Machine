import { readFile, writeFile, mkdir, stat, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const exec = promisify(execFile)
const DATA_DIR = path.join(process.cwd(), 'data')

async function probeDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
    return parseFloat(stdout.trim()) || 0
  } catch { return 0 }
}

async function main() {
  const projectId = 'cmt4yh4nf000bmajq976v6csn'
  const cp = JSON.parse(await readFile(path.join(DATA_DIR, 'pipeline-state', `${projectId}.json`), 'utf-8'))

  // Pick the 8 most important beats for a complete story arc:
  // beat 0 (HOOK), 1 (SETUP), 3 (iPhone), 5 (Elop), 7 (market share chart),
  // 11 (Lumia), 13 (Microsoft deal), 17 (ENDING)
  const selectedBeatIndices = [0, 1, 3, 5, 7, 11, 13, 17]
  const selectedBeats = selectedBeatIndices.map(i => cp.beats[i])
  const selectedAudio = selectedBeatIndices.map(i => cp.perBeatAudio[i])

  // Load real assets
  const realManifest = JSON.parse(await readFile(path.join(DATA_DIR, 'pipeline-state', 'real-assets-manifest.json'), 'utf-8'))
  
  // Build assets for selected beats — use real assets where available
  const finalAssets = selectedBeats.map(beat => {
    const realAsset = realManifest.assets.find(a => a.beatId === beat.id)
    if (realAsset && realAsset.localPath && existsSync(realAsset.localPath)) {
      return {
        id: `real_${beat.id}`,
        type: 'PUBLIC_DOMAIN_IMAGE',
        storyBeatId: beat.id,
        localPath: realAsset.localPath,
        sourceUrl: realAsset.sourceUrl || 'Wikimedia Commons',
        creator: realAsset.artist || 'Unknown',
        license: realAsset.license || 'See source',
        commercialUse: true,
        attributionRequired: realAsset.license !== 'Public domain',
        retrievalDate: new Date().toISOString(),
        metadata: {},
      }
    }
    // For chart/timeline/typography beats — no external asset (Remotion renders them)
    const narration = (beat.narration || '').toLowerCase()
    if (/\b(percent|market share|billion|\$|revenue)\b/.test(narration)) {
      return { id: `chart_${beat.id}`, type: 'ORIGINAL_CHART', storyBeatId: beat.id, localPath: '', creator: 'Remotion', license: 'Original', commercialUse: true, attributionRequired: false, retrievalDate: new Date().toISOString(), metadata: {} }
    }
    if (/\b(2007|2010|2011|2013|timeline)\b/.test(narration)) {
      return { id: `timeline_${beat.id}`, type: 'ORIGINAL_MAP', storyBeatId: beat.id, localPath: '', creator: 'Remotion', license: 'Original', commercialUse: true, attributionRequired: false, retrievalDate: new Date().toISOString(), metadata: {} }
    }
    return { id: `text_${beat.id}`, type: 'ORIGINAL_GRAPHIC', storyBeatId: beat.id, localPath: '', creator: 'Remotion', license: 'Original', commercialUse: true, attributionRequired: false, retrievalDate: new Date().toISOString(), metadata: {} }
  })

  // Build EDL for selected beats
  let cursor = 0
  const edl = selectedBeats.map((beat, i) => {
    const dur = selectedAudio[i].duration
    const e = {
      id: `edl_${i+1}`,
      start: cursor,
      end: cursor + dur,
      narrationText: beat.narration,
      assetId: finalAssets[i].localPath || '',
      visualPurpose: beat.visualIntent,
      movement: ['static', 'ken_burns_in', 'static', 'pan_right', 'static', 'ken_burns_out', 'static', 'static'][i] || 'static',
      overlay: beat.title,
      transitionIn: i === 0 ? 'fade_in' : 'hard_cut',
      transitionOut: i === selectedBeats.length - 1 ? 'fade_out' : 'hard_cut',
      reason: beat.visualIntent.slice(0, 80),
    }
    cursor += dur
    return e
  })

  const totalDur = cursor
  console.log(`=== FINAL DOCUMENTARY (8 beats, ${totalDur.toFixed(1)}s) ===`)
  console.log(`Beats: ${selectedBeats.map(b => b.id).join(', ')}`)
  console.log(`Real assets: ${finalAssets.filter(a => a.sourceUrl?.includes('wikimedia') || a.sourceUrl?.includes('upload.wikimedia')).length}`)
  console.log(`Remotion components: ${finalAssets.filter(a => a.localPath === '').length}`)
  console.log()

  // Concatenate audio
  const narrationPath = path.join(DATA_DIR, 'audio', `${projectId}_final8_narration.mp3`)
  const listPath = narrationPath + '.txt'
  await writeFile(listPath, selectedAudio.map(a => `file '${a.audioPath}'`).join('\n'))
  await exec('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', narrationPath, '-y'])
  try { await unlink(listPath) } catch {}

  // Normalize
  const finalAudioPath = path.join(DATA_DIR, 'audio', `${projectId}_final8_audio.aac`)
  await exec('ffmpeg', ['-i', narrationPath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', finalAudioPath, '-y'])

  // Render via Remotion at 720p for speed
  console.log('[render] Rendering via Remotion @ 720p...')
  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, selectComposition } = await import('@remotion/renderer')

  // Copy assets to public
  const publicDir = path.join(process.cwd(), 'public', 'remotion-assets', projectId + '_final8')
  if (!existsSync(publicDir)) await mkdir(publicDir, { recursive: true })
  const assetUrlMap: Record<string, string> = {}
  for (const asset of finalAssets) {
    if (!asset.localPath || !existsSync(asset.localPath)) continue
    const ext = path.extname(asset.localPath)
    const destName = `${asset.id}${ext}`
    const destPath = path.join(publicDir, destName)
    if (!existsSync(destPath)) {
      const { readFile: rf, writeFile: wf } = await import('fs/promises')
      await wf(destPath, await rf(asset.localPath))
    }
    assetUrlMap[asset.id] = `/remotion-assets/${projectId}_final8/${destName}`
  }

  const inputProps = {
    edl,
    beats: selectedBeats.map(b => ({ ...b, narration: String(b.narration || '') })),
    assets: finalAssets.map(a => ({ ...a, localPath: assetUrlMap[a.id] || undefined })),
    channelName: '',
    totalScenes: edl.length,
  }

  console.log('[render] Bundling...')
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), 'src', 'video', 'index.ts'),
    webpackOverride: (config: any) => config,
  })

  console.log('[render] Selecting composition...')
  const composition = await selectComposition({
    serveUrl,
    id: 'documentary',
    inputProps,
  })

  // Override to 720p for faster render
  const fps = 30
  const durationInFrames = Math.max(30, Math.round(totalDur * fps))
  composition.durationInFrames = durationInFrames
  composition.fps = fps
  composition.width = 1280
  composition.height = 720

  const outputPath = path.join(DATA_DIR, 'videos', 'nokia-documentary-final.mp4')
  console.log(`[render] Rendering ${durationInFrames} frames at 1280x720 ${fps}fps...`)
  
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100)
      if (pct % 10 === 0) process.stdout.write(`\r[render] ${pct}%`)
    },
    chromiumOptions: { enableMultiProcessOnLinux: true },
  })
  console.log('')

  // Mux video + audio
  const muxedPath = path.join(DATA_DIR, 'videos', 'nokia-documentary-final-muxed.mp4')
  await exec('ffmpeg', [
    '-i', outputPath, '-i', finalAudioPath,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-movflags', '+faststart',
    muxedPath, '-y',
  ])
  // Replace the original with the muxed version
  const { copyFile, unlink: unlink2 } = await import('fs/promises')
  await copyFile(muxedPath, outputPath)
  try { await unlink2(muxedPath) } catch {}

  const dur = await probeDuration(outputPath)
  const size = (await stat(outputPath)).size
  console.log(`\n=== FINAL DOCUMENTARY ===`)
  console.log(`Path: ${outputPath}`)
  console.log(`Duration: ${dur.toFixed(1)}s`)
  console.log(`Size: ${(size / 1024 / 1024).toFixed(1)}MB`)

  // QC
  console.log(`\n=== QUALITY GATE ===`)
  const { runQualityGate } = await import('./src/engine/v3/quality-gate')
  const qg = await runQualityGate({
    videoPath: outputPath,
    thumbnailPath: path.join(DATA_DIR, 'thumbnails', `${projectId}.png`),
    durationSec: dur,
  })
  console.log(`QC: ${qg.passed ? 'PASS' : 'FAIL'}`)
  console.log(`LUFS: ${qg.audioLUFS}`)
  console.log(`Black frames: ${qg.blackFrameCount}`)
  console.log(`Freeze: ${qg.freezeCount}`)
  console.log(`Silence: ${qg.silenceCount}`)
  console.log(`Visual variety: ${qg.visualVarietyScore}%`)
  console.log(`Contact sheet: ${qg.contactSheetPath}`)
  console.log('Checks:')
  for (const c of qg.checks) console.log(`  ${c.passed ? '✓' : '✗'} ${c.name}: ${c.details.slice(0, 80)}`)

  // SlopScore
  console.log(`\n=== SLOP SCORE ===`)
  const { computeSlopScore } = await import('./src/engine/v3/quality-critic')
  const slop = computeSlopScore(edl, selectedBeats, finalAssets, { archetype: 'DOCUMENTARY' } as any)
  console.log(`SlopScore: ${slop.total} (threshold ${slop.threshold}, passed: ${slop.passed})`)
  if (slop.penalties.length > 0) {
    console.log('Penalties:')
    for (const p of slop.penalties) console.log(`  ${p.rule}: +${p.points} (${p.occurrences}x)`)
  }

  // Save full report
  const report = {
    videoPath: outputPath,
    duration: dur,
    size,
    qc: qg,
    slopScore: slop,
    beats: selectedBeats.length,
    realAssets: finalAssets.filter(a => a.sourceUrl?.includes('wikimedia') || a.sourceUrl?.includes('upload.wikimedia')).length,
    remotionComponents: finalAssets.filter(a => a.localPath === '').length,
  }
  await writeFile(path.join(DATA_DIR, 'pipeline-state', 'final-report.json'), JSON.stringify(report, null, 2))
  console.log(`\nReport saved to data/pipeline-state/final-report.json`)
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e.message); process.exit(1) })
