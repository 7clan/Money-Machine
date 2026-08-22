import { produceVideoV3 } from './src/engine/v3/creative-director-v2'

async function main() {
  const projectId = 'cmt4yh4nf000bmajq976v6csn'
  console.log(`[TEST A] Starting V3 pipeline for Nokia documentary`)
  const start = Date.now()
  try {
    const result = await produceVideoV3(projectId, {
      enableVideoGeneration: true,
      maxVideoClips: 1, // conservative cost cap
    })
    const elapsed = ((Date.now() - start) / 1000).toFixed(0)
    console.log(`\n[TEST A] COMPLETE in ${elapsed}s`)
    console.log(`  Archetype: ${result.archetype}`)
    console.log(`  Duration: ${result.duration.toFixed(1)}s`)
    console.log(`  Video: ${result.videoPath}`)
    console.log(`  QC passed: ${result.qualityGate.passed}`)
    console.log(`  LUFS: ${result.qualityGate.audioLUFS}`)
    console.log(`  Black frames: ${result.qualityGate.blackFrameCount}`)
    console.log(`  Visual variety: ${result.qualityGate.visualVarietyScore}%`)
    console.log(`  Contact sheet: ${result.qualityGate.contactSheetPath}`)
    console.log(`\n  Scheduler stats:`)
    for (const [ep, stats] of Object.entries(result.schedulerStats)) {
      console.log(`    ${ep}: ${stats.successfulCalls} ok, ${stats.cachedHits} cached, ${stats.retriedCalls} retried, ${stats.failedCalls} failed`)
    }
    console.log(`\n  QC checks:`)
    for (const c of result.qualityGate.checks) {
      console.log(`    ${c.passed ? '✓' : '✗'} ${c.name}: ${c.details.slice(0, 80)}`)
    }
    if (result.qualityGate.recommendations.length > 0) {
      console.log(`\n  Recommendations:`)
      for (const r of result.qualityGate.recommendations) console.log(`    - ${r}`)
    }
  } catch (e: any) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(0)
    console.error(`\n[TEST A] FAILED after ${elapsed}s:`, e.message)
    // Check if it's a non-retryable Z.ai error
    if (e.classified) {
      console.error(`  Classified: ${e.classified.state} (code ${e.classified.businessCode})`)
      console.error(`  Reset at: ${e.classified.resetAt}`)
    }
    process.exit(1)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
