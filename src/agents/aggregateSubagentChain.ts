#!/usr/bin/env tsx
/**
 * aggregateSubagentChain — builds chain-log.json from subagent run records.
 *
 * Scans:
 *   data/pipeline-state/subagent-chain/runs/ (flow=chain)
 *   data/pipeline-state/subagent-chain/parallel/wN/runs/ (flow=parallel, one dir per worker)
 *   data/pipeline-state/subagent-chain/parallel/parallel-orchestrator.json (optional wall clock)
 *
 * Produces data/pipeline-state/subagent-chain/chain-log.json with the
 * sequential chain, the parallel batch, and mathematical proof of
 * concurrency (overlapping [startedAt, endedAt] intervals).
 *
 * Run: bunx tsx src/agents/aggregateSubagentChain.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AgentRunRecord } from './subagentChain'

const CHAIN_ROOT = join(process.cwd(), 'data/pipeline-state/subagent-chain')

function loadRecords(dir: string): AgentRunRecord[] {
  const runsDir = join(dir, 'runs')
  if (!existsSync(runsDir)) return []
  return readdirSync(runsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(runsDir, f), 'utf8')) as AgentRunRecord)
}

function humanDuration(ms: number): string {
  return `${Math.round(ms / 100) / 10}s`
}

function main(): void {
  const chainRecords = loadRecords(CHAIN_ROOT)
    .filter((r) => r.flow === 'chain')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  const chain = chainRecords.map((r) => ({
    agent: r.agent,
    role: r.role,
    artifact: r.artifact,
    inputHash: r.inputHash,
    outputHash: r.outputHash,
    duration: humanDuration(r.durationMs),
    durationMs: r.durationMs,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    llmCalls: r.llmCalls,
    searchCalls: r.searchCalls,
    inputUnmodified: r.inputUnmodified,
    status: r.status,
    error: r.error ?? null,
  }))

  // Parallel batch: one record per worker under parallel/w*/
  const parallelDir = join(CHAIN_ROOT, 'parallel')
  const workers: AgentRunRecord[] = []
  if (existsSync(parallelDir)) {
    for (const entry of readdirSync(parallelDir)) {
      const workerDir = join(parallelDir, entry)
      workers.push(...loadRecords(workerDir).filter((r) => r.flow === 'parallel'))
    }
  }
  workers.sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  const parallel: Array<Record<string, unknown>> = []
  const batchIds = new Set(workers.map((w) => w.batchId))
  for (const batchId of batchIds) {
    const batch = workers.filter((w) => w.batchId === batchId)
    const starts = batch.map((w) => Date.parse(w.startedAt))
    const ends = batch.map((w) => Date.parse(w.endedAt))
    const batchStart = Math.min(...starts)
    const batchEnd = Math.max(...ends)
    const overlapStart = Math.max(...starts)
    const overlapEnd = Math.min(...ends)
    const overlapMs = overlapEnd - overlapStart
    const sumDurationMs = batch.reduce((a, w) => a + w.durationMs, 0)
    const wallClockMs = batchEnd - batchStart

    const orchestratorPath = join(parallelDir, 'parallel-orchestrator.json')
    const orchestrator = existsSync(orchestratorPath)
      ? (JSON.parse(readFileSync(orchestratorPath, 'utf8')) as Record<string, unknown>)
      : {}

    parallel.push({
      batchId,
      agents: batch.map((w) => `${w.agent}-${w.instanceId}`),
      topics: batch.map((w) => w.instanceId),
      startedAt: new Date(batchStart).toISOString(),
      endedAt: new Date(batchEnd).toISOString(),
      concurrent: overlapMs > 0 && batch.length > 1,
      proof: {
        overlapWindowMs: overlapMs,
        overlapWindow: `${new Date(overlapStart).toISOString()} → ${new Date(overlapEnd).toISOString()}`,
        wallClockMs,
        sumOfDurationsMs: sumDurationMs,
        wallClockLtSum: wallClockMs < sumDurationMs,
        workerIntervals: batch.map((w) => ({
          instanceId: w.instanceId,
          pid: w.pid,
          startedAt: w.startedAt,
          endedAt: w.endedAt,
          durationMs: w.durationMs,
          status: w.status,
        })),
      },
      ...(orchestrator.orchestratorStartedAt ? { orchestrator } : {}),
    })
  }

  const allRecords = [...chainRecords, ...workers]
  const log = {
    generatedAt: new Date().toISOString(),
    topic: 'Why do people procrastinate?',
    llmModel: allRecords.find((r) => r.llmModel !== 'unknown')?.llmModel ?? 'unknown',
    agentInvocations: allRecords.length,
    chain,
    parallel,
  }
  const outPath = join(CHAIN_ROOT, 'chain-log.json')
  writeFileSync(outPath, `${JSON.stringify(log, null, 2)}\n`)
  console.log(
    `[AGGREGATOR] chain=${chain.length} invocations, parallel=${parallel.length} batch(es), ` +
      `total=${allRecords.length} invocations → ${outPath}`,
  )
}

main()
