/**
 * subagentChain — shared runtime for standalone agent invocations.
 *
 * Each invokeXxx.ts script is an ISOLATED subagent invocation:
 *   - reads its world from  <chainDir>/input.json   (nothing else)
 *   - reasons via z-ai CLI (LLM chat) and z-ai function (web_search)
 *   - writes its decision to <chainDir>/output.json (pure artifact)
 *   - NEVER mutates input.json (verified by hash before/after)
 *   - drops a telemetry record in <chainDir>/runs/
 *
 * chainDir defaults to data/pipeline-state/subagent-chain and can be
 * overridden with SUBAGENT_CHAIN_DIR (used for parallel worker isolation).
 */
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface SearchHit {
  url: string
  name: string
  snippet: string
  host_name: string
  rank: number
  date: string
}

export interface AgentRunRecord {
  agent: string
  role: string
  artifact: string
  flow: string
  batchId: string
  instanceId: string
  pid: number
  startedAt: string
  endedAt: string
  durationMs: number
  inputHash: string
  outputHash: string
  status: 'PASS' | 'FAIL'
  error?: string
  llmCalls: number
  searchCalls: number
  llmModel: string
  inputUnmodified: boolean
  chainDir: string
}

const ROOT = process.cwd()

export function chainDir(): string {
  const dir = process.env.SUBAGENT_CHAIN_DIR ?? 'data/pipeline-state/subagent-chain'
  return join(ROOT, dir)
}

export function ensureDir(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function readInput<T>(): T {
  const p = join(chainDir(), 'input.json')
  if (!existsSync(p)) throw new Error(`input.json not found at ${p}`)
  return JSON.parse(readFileSync(p, 'utf8')) as T
}

export function writeOutput(artifact: unknown): string {
  const p = join(ensureDir(chainDir()), 'output.json')
  writeFileSync(p, `${JSON.stringify(artifact, null, 2)}\n`)
  return p
}

/** Short sha256 of the canonical JSON form — artifact fingerprint. */
export function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

let llmCalls = 0
let searchCalls = 0
let llmModel = 'unknown'

export function toolCounts(): { llmCalls: number; searchCalls: number; llmModel: string } {
  return { llmCalls, searchCalls, llmModel }
}

/** Blocking sleep (no event loop needed — scripts are synchronous). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Run a z-ai CLI command with retry + linear backoff. Parallel subagent
 * batches can trip API rate limits (HTTP 429) — transient failures deserve
 * a retry, not a pipeline abort.
 */
function execZai(args: string[], maxAttempts = 4): void {
  let attempt = 0
  for (;;) {
    try {
      execFileSync('z-ai', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
        timeout: 180_000,
        maxBuffer: 16 * 1024 * 1024,
      })
      return
    } catch (e) {
      attempt += 1
      if (attempt >= maxAttempts) throw e
      sleepSync(2000 * attempt)
    }
  }
}

/** One LLM reasoning call via z-ai CLI. Returns raw assistant content. */
export function zaiChat(system: string, prompt: string, tag: string): string {
  const out = join(ensureDir(join(chainDir(), 'tmp')), `${tag}.json`)
  execZai(['chat', '-s', system, '-p', prompt, '-o', out])
  const parsed = JSON.parse(readFileSync(out, 'utf8')) as {
    model?: string
    choices?: Array<{ message?: { content?: string } }>
  }
  llmCalls += 1
  if (parsed.model) llmModel = parsed.model
  const content = parsed.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error(`z-ai chat returned no content (tag=${tag})`)
  }
  return content
}

/** One web research call via z-ai function CLI. */
export function zaiWebSearch(query: string, num = 5): SearchHit[] {
  const out = join(ensureDir(join(chainDir(), 'tmp')), `search-${searchCalls}.json`)
  execZai([
    'function',
    '--name',
    'web_search',
    '--args',
    JSON.stringify({ query, num }),
    '--output',
    out,
  ])
  searchCalls += 1
  const parsed = JSON.parse(readFileSync(out, 'utf8')) as unknown
  return Array.isArray(parsed) ? (parsed as SearchHit[]) : []
}

/**
 * Extract JSON from an LLM reply that may be wrapped in prose or
 * markdown code fences. Finds the outermost {...} or [...] span.
 */
export function extractJson<T>(raw: string): T {
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const firstObj = text.indexOf('{')
  const firstArr = text.indexOf('[')
  let start: number
  if (firstObj === -1 && firstArr === -1) throw new Error('no JSON found in LLM reply')
  else if (firstObj === -1) start = firstArr
  else if (firstArr === -1) start = firstObj
  else start = Math.min(firstObj, firstArr)
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  const end = text.lastIndexOf(close)
  if (end <= start) throw new Error('unbalanced JSON in LLM reply')
  return JSON.parse(text.slice(start, end + 1)) as T
}

/**
 * LLM call that must return schema-valid JSON. Retries with an explicit
 * correction instruction when parsing/validation fails.
 */
export function zaiChatJson<T>(opts: {
  system: string
  prompt: string
  tag: string
  validate?: (value: unknown) => boolean
  attempts?: number
}): T {
  const attempts = opts.attempts ?? 2
  let lastError = 'unknown'
  let prompt = opts.prompt
  for (let i = 1; i <= attempts; i++) {
    const raw = zaiChat(opts.system, prompt, `${opts.tag}-attempt${i}`)
    try {
      const parsed = extractJson<T>(raw)
      if (opts.validate && !opts.validate(parsed)) {
        throw new Error('schema validation failed')
      }
      return parsed
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      prompt =
        `${opts.prompt}\n\nYour previous reply was rejected (${lastError}). ` +
        'Respond again with ONLY the raw JSON object — no prose, no markdown fences.'
    }
  }
  throw new Error(`LLM failed to produce valid JSON after ${attempts} attempts: ${lastError}`)
}

/**
 * Wrap a whole subagent invocation: read input → execute → write output →
 * verify input untouched → drop telemetry record. Exits non-zero on failure.
 */
export function runAgent(cfg: {
  agent: string
  role: string
  artifact: string
  execute: (input: never) => unknown
}): void {
  const startedAt = new Date()
  const dir = ensureDir(chainDir())
  const inputPath = join(dir, 'input.json')
  const meta = {
    flow: process.env.SUBAGENT_FLOW ?? 'adhoc',
    batchId: process.env.SUBAGENT_BATCH ?? 'none',
    instanceId: process.env.SUBAGENT_INSTANCE ?? 'default',
  }

  let inputHash = 'none'
  let outputHash = 'none'
  let status: 'PASS' | 'FAIL' = 'PASS'
  let error: string | undefined
  let inputUnmodified = false
  let output: unknown = null

  try {
    if (!existsSync(inputPath)) throw new Error(`input.json not found at ${inputPath}`)
    const input = JSON.parse(readFileSync(inputPath, 'utf8')) as unknown
    inputHash = sha256(input)
    output = cfg.execute(input as never)
    outputHash = sha256(output)
    writeOutput(output)
    // READ-ONLY guarantee: input artifact must be bit-identical after the run
    inputUnmodified = sha256(JSON.parse(readFileSync(inputPath, 'utf8'))) === inputHash
  } catch (e) {
    status = 'FAIL'
    error = e instanceof Error ? e.message : String(e)
  }

  const endedAt = new Date()
  const record: AgentRunRecord = {
    agent: cfg.agent,
    role: cfg.role,
    artifact: cfg.artifact,
    flow: meta.flow,
    batchId: meta.batchId,
    instanceId: meta.instanceId,
    pid: process.pid,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    inputHash,
    outputHash,
    status,
    error,
    ...toolCounts(),
    inputUnmodified,
    chainDir: dir,
  }
  const runsDir = ensureDir(join(dir, 'runs'))
  writeFileSync(
    join(runsDir, `${cfg.agent}-${meta.instanceId}-${startedAt.getTime()}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
  )

  const summary = {
    agent: cfg.agent,
    status,
    durationMs: record.durationMs,
    inputHash,
    outputHash,
    llmCalls: record.llmCalls,
    searchCalls: record.searchCalls,
    inputUnmodified,
    error,
  }
  console.log(`[SUBAGENT:${cfg.agent}] ${JSON.stringify(summary)}`)
  if (status === 'FAIL') process.exit(1)
}
