/**
 * AUTONOMOUS CYCLE 001 — Orchestrator
 *
 * Runs the FULL subagent chain end-to-end with ZERO human creative input:
 *   OpportunityResearcher (parallel x3, machine-picked topics)
 *   → IdeaStrategist → FormatDirector → Writer → VisualDirector
 *   → Production workers (TTS + Z.ai images + chunked Remotion render)
 *   → FactChecker (READ ONLY) → QualityCritic (READ ONLY) → repair if FAIL (max 2)
 *   → TitleThumbnailDirector → PublishingAgent (PRIVATE upload)
 *
 * Every stage writes a JSON artifact to data/autonomous-runs/capability-showcase-001-001/ (audit trail).
 * Each subagent runs as an ISOLATED PROCESS via `bunx tsx src/agents/invokeXxx.ts`
 * with its own SUBAGENT_CHAIN_DIR — real isolated agent invocations, not inlined.
 *
 * Run: bunx tsx scripts/capability-showcase/orchestrator.ts
 */
import { spawnSync, spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs'
import path from 'path'

// Survive parent shell exit — we are a long-running cycle.
process.on('SIGHUP', () => log('SIGHUP received — ignoring (cycle is detached)'))
process.on('SIGTERM', () => log('SIGTERM received — ignoring (cycle is detached)'))

const ROOT = process.cwd()
const CYCLE_DIR = path.join(ROOT, 'data', 'autonomous-runs', 'capability-showcase-001')
const CHAIN_BASE = path.join(CYCLE_DIR, 'subagent-chain')
const LOG_PATH = path.join(CYCLE_DIR, 'logs', 'orchestrator.log')
const RESEARCH_DIR = path.join(CYCLE_DIR, 'research')

for (const d of [CYCLE_DIR, path.join(CYCLE_DIR, 'logs'), RESEARCH_DIR, CHAIN_BASE, path.join(CYCLE_DIR, 'renders'), path.join(CYCLE_DIR, 'qc')]) {
  mkdirSync(d, { recursive: true })
}

function ts(): string {
  return new Date().toISOString()
}
function log(msg: string): void {
  const line = `[${ts()}] ${msg}`
  console.log(line)
  writeFileSync(LOG_PATH, `${line}\n`, { flag: 'a' })
}
function sha(v: unknown): string {
  return createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16)
}
function writeArtifact(name: string, data: unknown): void {
  writeFileSync(path.join(CYCLE_DIR, name), `${JSON.stringify(data, null, 2)}\n`)
  log(`artifact saved: ${name} (hash=${sha(data)})`)
}

function runSubagent(stage: string, agentFile: string, input: unknown, instance = 'default'): unknown {
  const chainDir = path.join(CHAIN_BASE, `${stage}-${instance}`)
  if (existsSync(chainDir)) rmSync(chainDir, { recursive: true, force: true })
  mkdirSync(chainDir, { recursive: true })
  mkdirSync(path.join(chainDir, 'runs'), { recursive: true })
  mkdirSync(path.join(chainDir, 'tmp'), { recursive: true })
  writeFileSync(path.join(chainDir, 'input.json'), `${JSON.stringify(input, null, 2)}\n`)
  log(`SUBAGENT START: ${agentFile} stage=${stage} instance=${instance}`)
  const startedAt = Date.now()
  const result = spawnSync('bunx', ['tsx', path.join('src', 'agents', `${agentFile}.ts`)], {
    env: { ...process.env, SUBAGENT_CHAIN_DIR: chainDir, SUBAGENT_FLOW: 'capability-showcase', SUBAGENT_BATCH: stage, SUBAGENT_INSTANCE: instance },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300_000,
    encoding: 'utf8',
  })
  const durationMs = Date.now() - startedAt
  if (result.stdout) writeFileSync(path.join(chainDir, 'stdout.log'), result.stdout)
  if (result.stderr) writeFileSync(path.join(chainDir, 'stderr.log'), result.stderr)
  if (result.status !== 0) {
    log(`SUBAGENT FAIL: ${agentFile} exit=${result.status} dur=${durationMs}ms`)
    log(`stderr tail: ${result.stderr?.slice(-400) ?? ''}`)
    throw new Error(`${agentFile} failed (exit ${result.status})`)
  }
  const out = JSON.parse(readFileSync(path.join(chainDir, 'output.json'), 'utf8'))
  log(`SUBAGENT PASS: ${agentFile} dur=${durationMs}ms hash=${sha(out)}`)
  return out
}

function runSubagentParallel(stage: string, agentFile: string, inputs: { instance: string; input: unknown }[]): Promise<unknown[]> {
  // Resilient parallel execution: uses allSettled + retries failed instances once.
  // A single Z.ai API hiccup should not kill the whole cycle.
  return runSubagentParallelResilient(stage, agentFile, inputs, 1)
}

async function runSubagentParallelResilient(stage: string, agentFile: string, inputs: { instance: string; input: unknown }[], maxRetries: number): Promise<unknown[]> {
  const tasks = inputs.map(({ instance, input }) => {
    const chainDir = path.join(CHAIN_BASE, `${stage}-${instance}`)
    if (existsSync(chainDir)) rmSync(chainDir, { recursive: true, force: true })
    mkdirSync(chainDir, { recursive: true })
    mkdirSync(path.join(chainDir, 'runs'), { recursive: true })
    mkdirSync(path.join(chainDir, 'tmp'), { recursive: true })
    writeFileSync(path.join(chainDir, 'input.json'), `${JSON.stringify(input, null, 2)}\n`)
    return { instance, chainDir, input }
  })
  log(`SUBAGENT PARALLEL START: ${agentFile} n=${tasks.length} stage=${stage}`)
  const startedAt = Date.now()

  const runOne = (task: { instance: string; chainDir: string; input: unknown }): Promise<unknown> => {
    return new Promise<unknown>((resolve, reject) => {
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      const child = spawn('bunx', ['tsx', path.join('src', 'agents', `${agentFile}.ts`)], {
        env: { ...process.env, SUBAGENT_CHAIN_DIR: task.chainDir, SUBAGENT_FLOW: 'capability-showcase', SUBAGENT_BATCH: stage, SUBAGENT_INSTANCE: task.instance },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.stdout.on('data', (c: Buffer) => { stdoutChunks.push(c); writeFileSync(path.join(task.chainDir, 'stdout.log'), Buffer.concat(stdoutChunks)) })
      child.stderr.on('data', (c: Buffer) => { stderrChunks.push(c); writeFileSync(path.join(task.chainDir, 'stderr.log'), Buffer.concat(stderrChunks)) })
      child.on('close', (code: number | null) => {
        const dur = Date.now() - startedAt
        if (code !== 0) {
          log(`SUBAGENT PARALLEL FAIL: ${agentFile} instance=${task.instance} exit=${code} dur=${dur}ms`)
          reject(new Error(`${agentFile}[${task.instance}] failed (exit ${code})`))
        } else {
          try {
            const out = JSON.parse(readFileSync(path.join(task.chainDir, 'output.json'), 'utf8'))
            log(`SUBAGENT PARALLEL PASS: ${agentFile} instance=${task.instance} dur=${dur}ms hash=${sha(out)}`)
            resolve(out)
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)))
          }
        }
      })
    })
  }

  const results = await Promise.allSettled(tasks.map((t) => runOne(t)))
  const failed: { task: typeof tasks[0]; index: number }[] = []
  const outputs: unknown[] = new Array(tasks.length)
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      outputs[i] = r.value
    } else {
      failed.push({ task: tasks[i], index: i })
    }
  })

  if (failed.length > 0 && maxRetries > 0) {
    log(`SUBAGENT PARALLEL: ${failed.length} failed, retrying once (instances: ${failed.map((f) => f.task.instance).join(', ')})`)
    // Wait 5s before retry to let API rate limits recover
    await new Promise((resolve) => setTimeout(resolve, 5000))
    const retryInputs = failed.map((f) => ({ instance: f.task.instance, input: f.task.input }))
    const retryResults = await runSubagentParallelResilient(stage, agentFile, retryInputs, maxRetries - 1)
    failed.forEach((f, i) => {
      outputs[f.index] = retryResults[i]
    })
  } else if (failed.length > 0) {
    throw new Error(`${agentFile} failed for instances ${failed.map((f) => f.task.instance).join(', ')} after ${maxRetries + 1} attempts`)
  }

  return outputs
}

interface RunSummary {
  cycleId: string
  mode: 'PRIVATE_ONLY'
  budget: 'DEVELOPMENT_TEST'
  risk: 'CONSERVATIVE'
  publicPublishing: false
  startedAt: string
  finishedAt?: string
  stages: Array<{ name: string; status: 'PASS' | 'FAIL' | 'SKIPPED' | 'PENDING_DATA'; durationMs?: number; artifactHash?: string; notes?: string }>
  selectedTopic?: string
  selectedFormat?: string
  scriptHash?: string
  visualShotHash?: string
  assetManifestHash?: string
  audioManifestHash?: string
  compositionHash?: string
  qcReportHash?: string
  factCheckHash?: string
  titleThumbnailHash?: string
  publishManifestHash?: string
  videoId?: string
  privacyStatus?: 'private'
  autonomy: { humanTopicSelections: 0; humanFormatSelections: 0; humanScriptEdits: 0; humanShotEdits: 0; humanRenderCommands: 0; humanQCCorrections: 0; humanPublishingCommands: 0 }
  analytics: 'USER_AUTH_REQUIRED' | 'PENDING_DATA' | 'PASS' | 'FAIL'
  overall: 'PASS' | 'FAIL' | 'BLOCKED'
}

const summary: RunSummary = {
  cycleId: 'CAPABILITY_SHOWCASE_001',
  mode: 'PRIVATE_ONLY',
  budget: 'DEVELOPMENT_TEST',
  risk: 'CONSERVATIVE',
  publicPublishing: false,
  startedAt: ts(),
  stages: [],
  autonomy: { humanTopicSelections: 0, humanFormatSelections: 0, humanScriptEdits: 0, humanShotEdits: 0, humanRenderCommands: 0, humanQCCorrections: 0, humanPublishingCommands: 0 },
  analytics: 'USER_AUTH_REQUIRED',
  overall: 'BLOCKED',
}

function recordStage(name: string, status: 'PASS' | 'FAIL' | 'SKIPPED' | 'PENDING_DATA', durationMs?: number, artifactHash?: string, notes?: string): void {
  summary.stages.push({ name, status, durationMs, artifactHash, notes })
  writeArtifact('run-summary.json', summary)
}

// ============================================================
// STAGE 0 — TOPIC DISCOVERY
// ============================================================
interface TopicSeed { topic: string; rationale: string; opportunityDomain: string }

function discoverTopics(): TopicSeed[] {
  log('STAGE 0: TopicDiscovery — machine picks 3 research domains')
  const start = Date.now()
  const tmpOut = path.join(CYCLE_DIR, 'logs', 'topic-discovery.json')
  const system = 'You are an autonomous YouTube opportunity researcher. You pick 3 DISTINCT research topics that have genuine audience interest, real evidence available, and are produceable on a Linux machine with browser capture + image generation + TTS but NO Windows/macOS capture and NO Z.ai video. Reply with ONLY raw JSON, no prose.'
  const prompt = `Generate 3 distinct research topics for a YouTube video opportunity scan.
Each topic should be:
- A real, evergreen or currently-rising subject with audience interest
- Verifiable through public web sources
- Visual-friendly (can be illustrated with generated images, motion graphics, charts, or browser captures)
- Produceable WITHOUT Windows/macOS screen capture and WITHOUT Z.ai video generation

Output JSON: an array of 3 items:
{ "topic": "<specific topic, 4-10 words>", "rationale": "<1 sentence why this has opportunity>", "opportunityDomain": "<PSYCHOLOGY|TECHNOLOGY|HISTORY|SCIENCE|BUSINESS|CULTURE>" }

Avoid: Nokia, DevTools tutorial, Decoy Effect, GLOW HOUR (those were prior benchmarks).
Reply with ONLY the JSON array.`
  const r = spawnSync('z-ai', ['chat', '-s', system, '-p', prompt, '-o', tmpOut], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`topic discovery z-ai chat failed: ${r.stderr?.slice(-300)}`)
  const parsed = JSON.parse(readFileSync(tmpOut, 'utf8'))
  const content: string = parsed.choices?.[0]?.message?.content ?? ''
  let arr: unknown
  try {
    const s = content.indexOf('[')
    const e = content.lastIndexOf(']')
    arr = JSON.parse(content.slice(s, e + 1))
  } catch (e) {
    throw new Error(`could not parse topic discovery JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
  const topics = (arr as TopicSeed[]).slice(0, 3).map((t, i) => ({
    topic: String(t.topic ?? `topic-${i + 1}`),
    rationale: String(t.rationale ?? ''),
    opportunityDomain: String(t.opportunityDomain ?? 'GENERAL'),
  }))
  if (topics.length < 3) throw new Error(`topic discovery returned only ${topics.length} topics`)
  writeArtifact('research/topic-seeds.json', topics)
  recordStage('TopicDiscovery', 'PASS', Date.now() - start, sha(topics), `${topics.length} topics`)
  log(`STAGE 0 DONE: topics=[${topics.map((t) => t.topic).join(' | ')}]`)
  return topics
}

// ============================================================
// STAGE 1 — PARALLEL OPPORTUNITY_RESEARCHER
// ============================================================
async function runParallelResearch(topics: TopicSeed[]): Promise<unknown[]> {
  log('STAGE 1: OpportunityResearcher (parallel x3)')
  const start = Date.now()
  const inputs = topics.map((t, i) => ({ instance: `r${i + 1}`, input: { topic: t.topic, rationale: t.rationale, opportunityDomain: t.opportunityDomain } }))
  const briefs = await runSubagentParallel('research', 'invokeResearcher', inputs)
  writeArtifact('research/parallel-briefs.json', briefs)
  recordStage('OpportunityResearcher', 'PASS', Date.now() - start, sha(briefs), `${briefs.length} parallel briefs`)
  return briefs
}

// ============================================================
// STAGE 2 — MERGE BRIEFS
// ============================================================
function mergeBriefs(briefs: unknown[]): unknown {
  log('STAGE 2: Merge briefs → OpportunityBrief (deterministic)')
  const start = Date.now()
  const refs: unknown[] = []
  const srcs: unknown[] = []
  const qs: string[] = []
  const breakouts: unknown[] = []
  const topics: string[] = []
  for (const b of briefs as any[]) {
    if (typeof b.topic === 'string') topics.push(b.topic)
    if (Array.isArray(b.references)) refs.push(...b.references)
    if (Array.isArray(b.sources)) srcs.push(...b.sources)
    if (Array.isArray(b.audienceQuestions)) qs.push(...b.audienceQuestions)
    if (Array.isArray(b.breakoutVideos)) breakouts.push(...b.breakoutVideos)
  }
  const seenUrls = new Set<string>()
  const dedupedSources = srcs.filter((s: any) => { if (!s?.url || seenUrls.has(s.url)) return false; seenUrls.add(s.url); return true })
  const merged = {
    topic: topics.join(' / '),
    references: refs.slice(0, 8),
    sources: dedupedSources.slice(0, 10),
    audienceQuestions: Array.from(new Set(qs)).slice(0, 6),
    breakoutVideos: breakouts.slice(0, 6),
  }
  writeArtifact('research/merged-brief.json', merged)
  recordStage('BriefMerge', 'PASS', Date.now() - start, sha(merged), `${merged.references.length} refs, ${merged.sources.length} sources`)
  return merged
}

// ============================================================
// STAGE 3-6 — IdeaStrategist → FormatDirector → Writer → VisualDirector
// ============================================================
function runIdeaStrategist(mergedBrief: unknown): unknown {
  log('STAGE 3: IdeaStrategist')
  const start = Date.now()
  const ideas = runSubagent('idea-strategy', 'invokeIdeaStrategist', mergedBrief)
  writeArtifact('idea-selection.json', ideas)
  recordStage('IdeaStrategist', 'PASS', Date.now() - start, sha(ideas), `${(ideas as any[]).length} candidates`)
  return ideas
}
function runFormatDirector(ideas: unknown): unknown {
  log('STAGE 4: FormatDirector')
  const start = Date.now()
  const format = runSubagent('format', 'invokeFormatDirector', { ideas }) as any
  if (format.blocked) throw new Error(`FormatDirector blocked: ${format.blockedReason}`)
  writeArtifact('format-selection.json', format)
  summary.selectedFormat = format.archetype
  recordStage('FormatDirector', 'PASS', Date.now() - start, sha(format), `archetype=${format.archetype} idea=${format.selectedIdeaId}`)
  return format
}
function runWriter(ideas: unknown, format: unknown): unknown {
  log('STAGE 5: Writer')
  const start = Date.now()
  const script = runSubagent('writer', 'invokeWriter', { ideas, format })
  writeArtifact('script.json', script)
  summary.scriptHash = sha(script)
  summary.selectedTopic = (script as any).id
  recordStage('Writer', 'PASS', Date.now() - start, summary.scriptHash, `${(script as any).segments.length} segments, target=${(script as any).targetDuration}s`)
  return script
}
function runVisualDirector(script: unknown, format: unknown): unknown {
  log('STAGE 6: VisualDirector')
  const start = Date.now()
  const shots = runSubagent('visual', 'invokeVisualDirector', { script, format })
  writeArtifact('visual-shots.json', shots)
  summary.visualShotHash = sha(shots)
  recordStage('VisualDirector', 'PASS', Date.now() - start, summary.visualShotHash, `${(shots as any[]).length} shots`)
  return shots
}

// ============================================================
// STAGE 7 — PRODUCTION
// ============================================================
function runProduction(script: any, shots: any[]): { videoPath: string; assetManifest: any; audioManifest: any; compositionHash: string; durationSec: number } {
  log('STAGE 7: Production (TTS + assets + chunked Remotion render)')
  const start = Date.now()
  const result = spawnSync('bunx', ['tsx', path.join('scripts', 'capability-showcase', 'produce.ts')], {
    env: { ...process.env, CAPABILITY_SHOWCASE_SCRIPT_PATH: path.join(CYCLE_DIR, 'script.json'), CAPABILITY_SHOWCASE_SHOTS_PATH: path.join(CYCLE_DIR, 'visual-shots.json'), CAPABILITY_SHOWCASE_OUT_DIR: path.join(CYCLE_DIR, 'renders') },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600_000,
    encoding: 'utf8',
  })
  if (result.stdout) writeFileSync(path.join(CYCLE_DIR, 'logs', 'produce.stdout.log'), result.stdout)
  if (result.stderr) writeFileSync(path.join(CYCLE_DIR, 'logs', 'produce.stderr.log'), result.stderr)
  if (result.status !== 0) {
    log(`STAGE 7 FAIL: produce.ts exit=${result.status}`)
    log(`stderr tail: ${result.stderr?.slice(-600)}`)
    recordStage('Production', 'FAIL', Date.now() - start)
    throw new Error(`production worker failed (exit ${result.status})`)
  }
  const manifest = JSON.parse(readFileSync(path.join(CYCLE_DIR, 'renders', 'production-manifest.json'), 'utf8'))
  writeArtifact('assets.json', manifest.assetManifest)
  summary.assetManifestHash = sha(manifest.assetManifest)
  summary.audioManifestHash = sha(manifest.audioManifest)
  summary.compositionHash = manifest.compositionHash
  recordStage('Production', 'PASS', Date.now() - start, manifest.compositionHash, `video=${manifest.videoPath} dur=${manifest.durationSec}s`)
  return { videoPath: manifest.videoPath, assetManifest: manifest.assetManifest, audioManifest: manifest.audioManifest, compositionHash: manifest.compositionHash, durationSec: manifest.durationSec }
}

// ============================================================
// STAGE 8 — FACT CHECKER (READ ONLY)
// ============================================================
function runFactChecker(script: any): unknown {
  log('STAGE 8: FactChecker (READ ONLY)')
  const start = Date.now()
  const report = runSubagent('fact-check', 'invokeFactChecker', { script })
  writeArtifact('fact-check.json', report)
  summary.factCheckHash = sha(report)
  recordStage('FactChecker', 'PASS', Date.now() - start, summary.factCheckHash, `verdict=${(report as any).verdict} unsupported=${(report as any).unsupportedCount}`)
  return report
}

// ============================================================
// STAGE 9 — QUALITY CRITIC (READ ONLY)
// ============================================================
function runQualityCritic(script: any, shots: any[], videoPath: string, round = 1): unknown {
  log(`STAGE 9: QualityCritic (READ ONLY) round ${round}`)
  const start = Date.now()
  const report = runSubagent(`qc-round-${round}`, 'invokeQualityCritic', { script, shots, videoPath })
  writeArtifact(round === 1 ? 'qc-round-1.json' : `qc-round-${round}.json`, report)
  summary.qcReportHash = sha(report)
  recordStage(`QualityCritic`, 'PASS', Date.now() - start, summary.qcReportHash, `verdict=${(report as any).verdict} failingShots=${(report as any).failingShots?.length ?? 0}`)
  return report
}

// ============================================================
// STAGE 10 — TARGETED REPAIR (max 2 rounds)
// ============================================================
function runRepairLoop(script: any, shots: any[], qcReport: any, videoPath: string): { videoPath: string; qcReport: any; script: any; shots: any[] } {
  let currentScript = script
  let currentShots = shots
  let currentVideo = videoPath
  let currentQc: any = qcReport
  for (let round = 1; round <= 2; round++) {
    if (currentQc.verdict === 'PASS') break
    log(`STAGE 10.${round}: Targeted repair round ${round}`)
    const start = Date.now()
    const editorInput = { script: currentScript, shots: currentShots, qcReport: currentQc, repairScope: 'failing-shots-only' as const }
    const repaired = runSubagent(`repair-${round}`, 'invokeEditorAgent', editorInput) as any
    writeArtifact(`qc-repair-${round}.json`, repaired)
    currentScript = repaired.script ?? currentScript
    currentShots = repaired.shots ?? currentShots
    const newProd = runProduction(currentScript, currentShots)
    currentVideo = newProd.videoPath
    const newQc = runQualityCritic(currentScript, currentShots, currentVideo, round + 1) as any
    currentQc = newQc
    summary.qcReportHash = sha(newQc)
    recordStage(`RepairRound${round}`, newQc.verdict === 'PASS' ? 'PASS' : 'FAIL', Date.now() - start, sha(newQc), `verdict=${newQc.verdict}`)
    if (newQc.verdict === 'PASS') break
  }
  return { videoPath: currentVideo, qcReport: currentQc, script: currentScript, shots: currentShots }
}

// ============================================================
// STAGE 11 — CREATIVE LOCK + TITLE/THUMBNAIL
// ============================================================
function runCreativeLock(script: any, shots: any[], assetManifest: any, audioManifest: any, compositionHash: string, qcReport: any): void {
  log('STAGE 11a: Creative Lock')
  const lock = {
    lockedAt: ts(),
    scriptHash: sha(script),
    visualShotHash: sha(shots),
    assetManifestHash: sha(assetManifest),
    audioManifestHash: sha(audioManifest),
    compositionHash,
    QCReportHash: sha(qcReport),
    CREATIVE_LOCK: true,
  }
  writeArtifact('creative-lock.json', lock)
  recordStage('CreativeLock', 'PASS', undefined, sha(lock), 'CREATIVE_LOCK=true')
}
function runTitleThumbnail(script: any, format: any, idea: any): unknown {
  log('STAGE 11b: TitleThumbnailDirector')
  const start = Date.now()
  const pair = runSubagent('title-thumb', 'invokeTitleThumbnail', { script, format, idea })
  writeArtifact('title-thumbnail.json', pair)
  summary.titleThumbnailHash = sha(pair)
  recordStage('TitleThumbnailDirector', 'PASS', Date.now() - start, summary.titleThumbnailHash, `title="${(pair as any).title}"`)
  return pair
}

// ============================================================
// STAGE 12 — PRIVATE PUBLISHING
// ============================================================
async function runPublishing(videoPath: string, titleThumb: any, script: any): Promise<{ youtubeVideoId: string; uploadStatus: string }> {
  log('STAGE 12: PublishingAgent (PRIVATE upload)')
  const start = Date.now()
  const meta = {
    title: titleThumb.title,
    description: buildDescription(script, titleThumb),
    tags: extractTags(script, titleThumb),
    category: '27',
    privacy: 'private' as const,
    language: 'en-US',
    madeForKids: false,
    isAiGenerated: true,
  }
  writeFileSync(path.join(CYCLE_DIR, 'publish-manifest.json'), `${JSON.stringify({ videoPath, metadata: meta, startedAt: ts() }, null, 2)}\n`)
  const r = spawnSync('bunx', ['tsx', path.join('scripts', 'capability-showcase', 'publish.ts')], {
    env: { ...process.env, CAPABILITY_SHOWCASE_VIDEO_PATH: videoPath, CAPABILITY_SHOWCASE_TITLE: meta.title, CAPABILITY_SHOWCASE_DESCRIPTION: meta.description, CAPABILITY_SHOWCASE_TAGS: JSON.stringify(meta.tags), CAPABILITY_SHOWCASE_CATEGORY: meta.category, CAPABILITY_SHOWCASE_PRIVACY: meta.privacy, CAPABILITY_SHOWCASE_MANIFEST: path.join(CYCLE_DIR, 'publish-manifest.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300_000,
    encoding: 'utf8',
  })
  if (r.stdout) writeFileSync(path.join(CYCLE_DIR, 'logs', 'publish.stdout.log'), r.stdout)
  if (r.stderr) writeFileSync(path.join(CYCLE_DIR, 'logs', 'publish.stderr.log'), r.stderr)
  if (r.status !== 0) {
    log(`STAGE 12 FAIL: publish.ts exit=${r.status}`)
    log(`stderr tail: ${r.stderr?.slice(-600)}`)
    // Include stderr in error so catch block can detect USER_AUTH_REQUIRED
    const stderrContent = r.stderr || ''
    if (stderrContent.includes('YouTube not connected') || stderrContent.includes('OAuth required')) {
      throw new Error('YouTube not connected — OAuth required before publishing')
    }
    throw new Error(`publishing worker failed (exit ${r.status}): ${stderrContent.slice(-300)}`)
  }
  const publishResult = JSON.parse(readFileSync(path.join(CYCLE_DIR, 'publish-manifest.json'), 'utf8'))
  summary.videoId = publishResult.youtubeVideoId
  summary.privacyStatus = 'private'
  summary.publishManifestHash = sha(publishResult)
  writeArtifact('publish-manifest.json', publishResult)
  recordStage('PublishingAgent', 'PASS', Date.now() - start, summary.publishManifestHash, `videoId=${publishResult.youtubeVideoId} privacy=private`)
  return { youtubeVideoId: publishResult.youtubeVideoId, uploadStatus: publishResult.uploadStatus ?? 'uploaded' }
}

function buildDescription(script: any, titleThumb: any): string {
  const segs = (script.segments as any[]).map((s, i) => `${i + 1}. ${s.narration}`).join('\n')
  return `${titleThumb.title}\n\nAn autonomously-produced YouTube video. Generated end-to-end by MONEY MACHINE Cycle 001 (PRIVATE_ONLY, DEVELOPMENT_TEST).\n\nChapters:\n${segs}\n\n#autonomous #aiGenerated`
}
function extractTags(script: any, titleThumb: any): string[] {
  const words = `${titleThumb.title} ${script.segments.map((s: any) => s.narration).join(' ')}`
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 4)
  const freq: Record<string, number> = {}
  for (const w of words) freq[w] = (freq[w] ?? 0) + 1
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w)
}

// ============================================================
// MAIN
// ============================================================
function loadArtifact(name: string): unknown | null {
  const p = path.join(CYCLE_DIR, name)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

async function main() {
  log('==================================================')
  log('AUTONOMOUS CYCLE 001 — START')
  log('mode=PRIVATE_ONLY budget=DEVELOPMENT_TEST risk=CONSERVATIVE')
  log('==================================================')
  try {
    // RESUME SUPPORT: if script.json + visual-shots.json already exist, skip Stages 0-6
    let script: any = loadArtifact('script.json')
    let shots: any = loadArtifact('visual-shots.json')
    let ideas: any = loadArtifact('idea-selection.json')
    let format: any = loadArtifact('format-selection.json')
    const resuming = !!(script && shots && ideas && format)
    if (resuming) {
      log(`RESUME: skipping Stages 0-6 — artifacts already present (script hash=${sha(script)}, shots hash=${sha(shots)})`)
      summary.scriptHash = sha(script)
      summary.visualShotHash = sha(shots)
      summary.selectedFormat = format.archetype
      summary.selectedTopic = script.id
    } else {
      const topics = discoverTopics()
      const briefs = await runParallelResearch(topics)
      const mergedBrief = mergeBriefs(briefs)
      ideas = runIdeaStrategist(mergedBrief)
      format = runFormatDirector(ideas)
      script = runWriter(ideas, format)
      shots = runVisualDirector(script, format)
    }
    // RESUME for Stage 7+: if production-manifest.json exists, reuse it
    let prod: { videoPath: string; assetManifest: any; audioManifest: any; compositionHash: string; durationSec: number }
    const existingProdManifest = loadArtifact('renders/production-manifest.json') as any
    if (existingProdManifest && existingProdManifest.videoPath && existsSync(existingProdManifest.videoPath)) {
      log(`RESUME: reusing existing production manifest (video=${existingProdManifest.videoPath}, dur=${existingProdManifest.durationSec}s)`)
      writeArtifact('assets.json', existingProdManifest.assetManifest)
      summary.assetManifestHash = sha(existingProdManifest.assetManifest)
      summary.audioManifestHash = sha(existingProdManifest.audioManifest)
      summary.compositionHash = existingProdManifest.compositionHash
      prod = { videoPath: existingProdManifest.videoPath, assetManifest: existingProdManifest.assetManifest, audioManifest: existingProdManifest.audioManifest, compositionHash: existingProdManifest.compositionHash, durationSec: existingProdManifest.durationSec }
      recordStage('Production', 'PASS', undefined, existingProdManifest.compositionHash, `RESUMED video=${prod.videoPath} dur=${prod.durationSec}s`)
    } else {
      prod = runProduction(script as any, shots as any[])
    }
    // HARD FACT CHECKER GATE — must PASS before QC (Cycle 001 lesson)
    // If FAIL → WriterRepair + EditorAgent match-script-repair → re-run FactChecker (max 2 rounds)
    let factCheck: any = loadArtifact('fact-check.json')
    if (factCheck && factCheck.verdict === 'PASS') {
      log(`RESUME: reusing fact-check.json (verdict=PASS)`)
      summary.factCheckHash = sha(factCheck)
      recordStage('FactChecker', 'PASS', undefined, summary.factCheckHash, `RESUMED verdict=PASS`)
    } else {
      factCheck = runFactChecker(script as any)
      let factRepairRound = 0
      while (factCheck.verdict === 'FAIL' && factRepairRound < 2) {
        factRepairRound++
        log(`HARD GATE: FactChecker FAIL (round ${factRepairRound}) — running WriterRepair + EditorAgent match-script-repair before proceeding`)
        const repairInput = { script, factCheckReport: factCheck, repairScope: 'fact-failures-only' as const }
        const repaired = runSubagent(`fact-repair-${factRepairRound}`, 'invokeWriterRepair', repairInput) as any
        const repairedScript = { ...repaired }
        delete repairedScript.repairSummary
        writeArtifact(`script-repaired-fact-${factRepairRound}.json`, repairedScript)
        // EditorAgent: match shot purpose/animation to repaired narration
        const editorResult = runSubagent(`fact-editor-${factRepairRound}`, 'invokeEditorAgent', { script: repairedScript, shots, repairScope: 'match-script-repair' as const }) as any
        const repairedShots = editorResult.shots
        writeArtifact(`visual-shots-repaired-fact-${factRepairRound}.json`, repairedShots)
        // Update active artifacts
        script = repairedScript
        shots = repairedShots
        writeArtifact('script.json', script)
        writeArtifact('visual-shots.json', shots)
        // Re-run FactChecker
        factCheck = runFactChecker(script as any)
        writeArtifact(`fact-check-r${factRepairRound + 1}.json`, factCheck)
        log(`FactChecker re-run round ${factRepairRound}: verdict=${factCheck.verdict}`)
      }
      if (factCheck.verdict !== 'PASS') {
        log('HARD GATE: FactChecker still FAIL after 2 repair rounds — BLOCKING production')
        summary.overall = 'FAIL'
        summary.finishedAt = ts()
        writeArtifact('run-summary.json', summary)
        process.exit(2)
      }
      // Save final fact-check as fact-check.json
      writeArtifact('fact-check.json', factCheck)
    }
    // QUALITY CRITIC GATE
    let qcReport: any = loadArtifact('qc-round-1.json')
    let finalVideo = prod.videoPath
    let finalQc = qcReport
    let finalScript = script
    let finalShots = shots
    if (qcReport && qcReport.verdict === 'PASS') {
      log(`RESUME: reusing qc-round-1.json (verdict=PASS)`)
      summary.qcReportHash = sha(qcReport)
      recordStage('QualityCritic', 'PASS', undefined, summary.qcReportHash, `RESUMED verdict=PASS`)
    } else {
      qcReport = runQualityCritic(script as any, shots as any[], prod.videoPath)
      finalQc = qcReport
      if (qcReport.verdict !== 'PASS') {
        const repaired = runRepairLoop(script as any, shots as any[], qcReport, prod.videoPath)
        finalVideo = repaired.videoPath
        finalQc = repaired.qcReport
        finalScript = repaired.script
        finalShots = repaired.shots
      }
    }
    if (finalQc.verdict !== 'PASS') {
      log('QC still FAIL after max repair rounds — marking cycle FAIL')
      summary.overall = 'FAIL'
      summary.finishedAt = ts()
      writeArtifact('run-summary.json', summary)
      process.exit(2)
    }
    // DURATION INTEGRITY GATE (Cycle 001 lesson — hard check)
    log('DURATION INTEGRITY GATE: verifying narration ≈ timeline ≈ video ≈ audio')
    const execDur = promisify(execFile)
    async function probeDur(filePath: string): Promise<number> {
      try {
        const { stdout } = await execDur('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
        return parseFloat(stdout.trim()) || 0
      } catch { return 0 }
    }
    let narrationSum = 0
    for (const seg of (script as any).segments) {
      const p = path.join(CYCLE_DIR, 'renders', 'audio', `${seg.id}.mp3`)
      if (existsSync(p)) narrationSum += await probeDur(p)
    }
    const finalVideoDur = await probeDur(finalVideo)
    const timelineTotal = (prod as any).durationSec || finalVideoDur
    const durationIntegrity = {
      narrationSum: Math.round(narrationSum * 1000) / 1000,
      timelineTotal: Math.round(timelineTotal * 1000) / 1000,
      finalVideoDur: Math.round(finalVideoDur * 1000) / 1000,
      verdict: (Math.abs(narrationSum - timelineTotal) < 1.0 && Math.abs(timelineTotal - finalVideoDur) < 1.0 && finalVideoDur > 0) ? 'PASS' as const : 'FAIL' as const,
    }
    writeArtifact('duration-integrity.json', durationIntegrity)
    log(`Duration: narration=${durationIntegrity.narrationSum}s timeline=${durationIntegrity.timelineTotal}s video=${durationIntegrity.finalVideoDur}s verdict=${durationIntegrity.verdict}`)
    if (durationIntegrity.verdict !== 'PASS') {
      log('HARD GATE: Duration integrity FAIL — BLOCKING production')
      summary.overall = 'FAIL'
      summary.finishedAt = ts()
      writeArtifact('run-summary.json', summary)
      process.exit(2)
    }
    recordStage('DurationIntegrity', 'PASS', undefined, sha(durationIntegrity), `narration=${narrationSum}s video=${finalVideoDur}s`)
    // CREATIVE LOCK
    let lockInfo = loadArtifact('creative-lock.json')
    if (lockInfo) {
      log(`RESUME: reusing creative-lock.json`)
      recordStage('CreativeLock', 'PASS', undefined, sha(lockInfo), 'RESUMED CREATIVE_LOCK=true')
    } else {
      runCreativeLock(finalScript as any, finalShots as any[], prod.assetManifest, prod.audioManifest, prod.compositionHash, finalQc)
    }
    // TITLE + THUMBNAIL
    let titleThumb: any = loadArtifact('title-thumbnail.json')
    if (titleThumb) {
      log(`RESUME: reusing title-thumbnail.json (title="${titleThumb.title}")`)
      summary.titleThumbnailHash = sha(titleThumb)
      recordStage('TitleThumbnailDirector', 'PASS', undefined, summary.titleThumbnailHash, `RESUMED title="${titleThumb.title}"`)
    } else {
      const selectedIdea = (ideas as any[]).find((i) => i.id === (format as any).selectedIdeaId) ?? (ideas as any[])[0]
      titleThumb = runTitleThumbnail(script as any, format, selectedIdea)
    }
    // THUMBNAIL FILE CREATION + QC (Cycle 001 lesson — concept alone is not enough)
    let thumbManifest: any = loadArtifact('thumbnail-manifest.json')
    if (!thumbManifest || thumbManifest.creationStatus !== 'PASS' || thumbManifest.qcStatus !== 'PASS') {
      log('THUMBNAIL: creating actual PNG file + QC')
      const thumbResult = spawnSync('bunx', ['tsx', path.join('scripts', 'capability-showcase', 'thumbnail.ts')], {
        env: { ...process.env, CAPABILITY_SHOWCASE_MANIFEST: path.join(CYCLE_DIR, 'publish-manifest.json'), CAPABILITY_SHOWCASE_TITLE_THUMB: path.join(CYCLE_DIR, 'title-thumbnail.json'), CAPABILITY_SHOWCASE_OUT_DIR: path.join(CYCLE_DIR, 'renders') },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 180_000,
        encoding: 'utf8',
      })
      if (thumbResult.stdout) writeFileSync(path.join(CYCLE_DIR, 'logs', 'thumbnail.stdout.log'), thumbResult.stdout)
      if (thumbResult.stderr) writeFileSync(path.join(CYCLE_DIR, 'logs', 'thumbnail.stderr.log'), thumbResult.stderr)
      thumbManifest = existsSync(path.join(CYCLE_DIR, 'thumbnail-manifest.json')) ? JSON.parse(readFileSync(path.join(CYCLE_DIR, 'thumbnail-manifest.json'), 'utf8')) : { creationStatus: 'FAIL', qcStatus: 'FAIL' }
      writeArtifact('thumbnail-manifest.json', thumbManifest)
      log(`THUMBNAIL: creation=${thumbManifest.creationStatus} qc=${thumbManifest.qcStatus}`)
    } else {
      log(`RESUME: reusing thumbnail-manifest.json (creation=${thumbManifest.creationStatus} qc=${thumbManifest.qcStatus})`)
    }
    // PUBLISHING — handle missing OAuth gracefully
    let publish: { youtubeVideoId?: string; uploadStatus?: string } = {}
    let publishStatus: 'PASS' | 'USER_AUTH_REQUIRED' | 'FAIL' = 'FAIL'
    try {
      publish = await runPublishing(finalVideo, titleThumb as any, script as any)
      log(`PUBLISHED: videoId=${publish.youtubeVideoId} privacy=private`)
      publishStatus = 'PASS'
      summary.videoId = publish.youtubeVideoId
      summary.privacyStatus = 'private'
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('YouTube not connected') || msg.includes('OAuth required')) {
        log('PUBLISHING: USER_AUTH_REQUIRED — YouTube OAuth not connected (DB was corrupted). Production complete except upload.')
        publishStatus = 'USER_AUTH_REQUIRED'
        writeArtifact('publish-manifest.json', { status: 'USER_AUTH_REQUIRED', reason: 'YouTube OAuth not connected. Visit /api/youtube/auth to reconnect. Video rendered + thumbnail created — only upload blocked.', videoPath: finalVideo, titleThumb })
      } else {
        log(`PUBLISHING FAIL: ${msg}`)
        publishStatus = 'FAIL'
      }
    }
    recordStage('PublishingAgent', publishStatus === 'PASS' ? 'PASS' : publishStatus === 'USER_AUTH_REQUIRED' ? 'SKIPPED' : 'FAIL', undefined, undefined, publishStatus === 'PASS' ? `videoId=${publish.youtubeVideoId}` : publishStatus)
    // ANALYTICS — PENDING_DATA (brand-new video) or USER_AUTH_REQUIRED
    summary.analytics = publishStatus === 'PASS' ? 'PENDING_DATA' : 'USER_AUTH_REQUIRED'
    recordStage('AnalyticsAgent', summary.analytics === 'PENDING_DATA' ? 'PENDING_DATA' : 'SKIPPED', undefined, undefined, summary.analytics)
    // FINAL VERDICT
    summary.overall = (factCheck.verdict === 'PASS' && finalQc.verdict === 'PASS' && durationIntegrity.verdict === 'PASS' && thumbManifest.creationStatus === 'PASS' && thumbManifest.qcStatus === 'PASS' && (publishStatus === 'PASS' || publishStatus === 'USER_AUTH_REQUIRED')) ? 'PASS' : 'FAIL'
    summary.finishedAt = ts()
    writeArtifact('run-summary.json', summary)
    writeArtifact('analytics-status.json', { status: summary.analytics, reason: publishStatus === 'USER_AUTH_REQUIRED' ? 'YouTube OAuth not connected — visit /api/youtube/auth' : 'Brand-new private video — no analytics data yet.', videoId: summary.videoId })
    log('==================================================')
    log(`CAPABILITY SHOWCASE 001 — ${summary.overall}`)
    log(`  FactChecker: ${factCheck.verdict}`)
    log(`  QualityCritic: ${finalQc.verdict}`)
    log(`  DurationIntegrity: ${durationIntegrity.verdict}`)
    log(`  Thumbnail: creation=${thumbManifest.creationStatus} qc=${thumbManifest.qcStatus}`)
    log(`  Publishing: ${publishStatus}`)
    log(`  Video: ${finalVideo} (${finalVideoDur}s)`)
    if (summary.videoId) log(`  videoId=${summary.videoId} privacy=private`)
    log('==================================================')
  } catch (e) {
    log(`CYCLE FAILED: ${e instanceof Error ? e.message : String(e)}`)
    log(`stack: ${e instanceof Error ? e.stack ?? '' : ''}`)
    summary.overall = 'FAIL'
    summary.finishedAt = ts()
    writeArtifact('run-summary.json', summary)
    process.exit(1)
  }
}

main().catch((e) => { log(`UNCAUGHT: ${e instanceof Error ? e.message : String(e)}`); process.exit(1) })
