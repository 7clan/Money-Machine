/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * ProductionOrchestrator
 *
 * Runs a production DAG where specialized agents make decisions
 * and deterministic workers execute operations.
 *
 * AGENTS DECIDE. WORKERS EXECUTE.
 */

import { db } from '@/lib/db'

export type AgentRole =
  | 'CONTENT_CEO'
  | 'OPPORTUNITY_RESEARCHER'
  | 'IDEA_STRATEGIST'
  | 'FORMAT_DIRECTOR'
  | 'WRITER'
  | 'VISUAL_DIRECTOR'
  | 'ASSET_RESEARCHER'
  | 'EDITOR'
  | 'QUALITY_CRITIC'
  | 'FACT_CHECKER'
  | 'TITLE_THUMBNAIL_DIRECTOR'
  | 'ANALYTICS_STRATEGIST'

export type WorkerType =
  | 'FFMPEG'
  | 'REMOTION'
  | 'PLAYWRIGHT_CAPTURE'
  | 'TTS'
  | 'IMAGE_GENERATION'
  | 'VIDEO_GENERATION'
  | 'ASSET_DOWNLOAD'
  | 'YOUTUBE_UPLOAD'
  | 'FILE_VALIDATION'
  | 'CHECKPOINT'

export interface ProductionTask {
  taskId: string
  agentRole?: AgentRole
  workerType?: WorkerType
  inputHash: string
  goal: string
  input: any
  outputSchema: string
  maxAttempts: number
  timeout: number
  dependencies: string[]
  status: 'PENDING' | 'RUNNING' | 'COMPLETE' | 'FAILED' | 'BLOCKED'
  result?: any
  attempts: number
}

export interface ProductionDAG {
  productionId: string
  topic: string
  tasks: Map<string, ProductionTask>
  artifacts: Map<string, any>
  createdAt: Date
  status: 'PLANNING' | 'PRODUCING' | 'REVIEWING' | 'COMPLETE' | 'FAILED'
}

/**
 * Build a production DAG for a given topic.
 * Agents are invoked in dependency order.
 * Workers execute deterministic operations.
 */
export function buildProductionDAG(topic: string, format: string): ProductionDAG {
  const dag: ProductionDAG = {
    productionId: `prod_${Date.now()}`,
    topic,
    tasks: new Map(),
    artifacts: new Map(),
    createdAt: new Date(),
    status: 'PLANNING',
  }

  // Research phase (parallel)
  dag.tasks.set('research', {
    taskId: 'research',
    agentRole: 'OPPORTUNITY_RESEARCHER',
    inputHash: hash(topic),
    goal: 'Research topic, find references, collect evidence',
    input: { topic },
    outputSchema: 'OpportunityBrief',
    maxAttempts: 3,
    timeout: 120000,
    dependencies: [],
    status: 'PENDING',
    attempts: 0,
  })

  // Idea strategy (depends on research)
  dag.tasks.set('ideas', {
    taskId: 'ideas',
    agentRole: 'IDEA_STRATEGIST',
    inputHash: hash(topic + '_ideas'),
    goal: 'Generate candidate ideas with angles',
    input: { topic, researchArtifact: 'research' },
    outputSchema: 'CandidateIdea[]',
    maxAttempts: 3,
    timeout: 60000,
    dependencies: ['research'],
    status: 'PENDING',
    attempts: 0,
  })

  // Format selection (depends on ideas)
  dag.tasks.set('format', {
    taskId: 'format',
    agentRole: 'FORMAT_DIRECTOR',
    inputHash: hash(topic + '_format'),
    goal: 'Select production archetype based on capabilities',
    input: { topic, ideasArtifact: 'ideas' },
    outputSchema: 'FormatSelection',
    maxAttempts: 3,
    timeout: 30000,
    dependencies: ['ideas'],
    status: 'PENDING',
    attempts: 0,
  })

  // Writing + Asset research (parallel, depend on format)
  dag.tasks.set('script', {
    taskId: 'script',
    agentRole: 'WRITER',
    inputHash: hash(topic + '_script'),
    goal: 'Write action-led script for selected format',
    input: { topic, formatArtifact: 'format', researchArtifact: 'research' },
    outputSchema: 'Script',
    maxAttempts: 3,
    timeout: 120000,
    dependencies: ['format'],
    status: 'PENDING',
    attempts: 0,
  })

  dag.tasks.set('assets', {
    taskId: 'assets',
    agentRole: 'ASSET_RESEARCHER',
    inputHash: hash(topic + '_assets'),
    goal: 'Source real media with provenance',
    input: { topic, formatArtifact: 'format', researchArtifact: 'research' },
    outputSchema: 'AssetManifest',
    maxAttempts: 3,
    timeout: 120000,
    dependencies: ['format'],
    status: 'PENDING',
    attempts: 0,
  })

  // Visual planning (depends on script)
  dag.tasks.set('visuals', {
    taskId: 'visuals',
    agentRole: 'VISUAL_DIRECTOR',
    inputHash: hash(topic + '_visuals'),
    goal: 'Build VisualShot timeline from script',
    input: { scriptArtifact: 'script', assetsArtifact: 'assets' },
    outputSchema: 'VisualShot[]',
    maxAttempts: 3,
    timeout: 60000,
    dependencies: ['script', 'assets'],
    status: 'PENDING',
    attempts: 0,
  })

  // TTS (worker, depends on script)
  dag.tasks.set('tts', {
    taskId: 'tts',
    workerType: 'TTS',
    inputHash: hash(topic + '_tts'),
    goal: 'Generate TTS narration',
    input: { scriptArtifact: 'script' },
    outputSchema: 'AudioManifest',
    maxAttempts: 3,
    timeout: 120000,
    dependencies: ['script'],
    status: 'PENDING',
    attempts: 0,
  })

  // Editing (depends on visuals + TTS)
  dag.tasks.set('edit', {
    taskId: 'edit',
    agentRole: 'EDITOR',
    inputHash: hash(topic + '_edit'),
    goal: 'Build Remotion composition from VisualShots + assets + audio',
    input: { visualsArtifact: 'visuals', ttsArtifact: 'tts', assetsArtifact: 'assets' },
    outputSchema: 'Composition',
    maxAttempts: 3,
    timeout: 120000,
    dependencies: ['visuals', 'tts'],
    status: 'PENDING',
    attempts: 0,
  })

  // Render (worker, depends on edit)
  dag.tasks.set('render', {
    taskId: 'render',
    workerType: 'REMOTION',
    inputHash: hash(topic + '_render'),
    goal: 'Render 720p review master',
    input: { editArtifact: 'edit' },
    outputSchema: 'VideoFile',
    maxAttempts: 2,
    timeout: 600000,
    dependencies: ['edit'],
    status: 'PENDING',
    attempts: 0,
  })

  // Quality review (depends on render)
  dag.tasks.set('qc', {
    taskId: 'qc',
    agentRole: 'QUALITY_CRITIC',
    inputHash: hash(topic + '_qc'),
    goal: 'Inspect rendered video + timeline + narration alignment',
    input: { renderArtifact: 'render', visualsArtifact: 'visuals' },
    outputSchema: 'QCReport',
    maxAttempts: 2,
    timeout: 60000,
    dependencies: ['render'],
    status: 'PENDING',
    attempts: 0,
  })

  // Fact check (depends on script + assets, parallel with render)
  dag.tasks.set('facts', {
    taskId: 'facts',
    agentRole: 'FACT_CHECKER',
    inputHash: hash(topic + '_facts'),
    goal: 'Verify all claims, data, citations',
    input: { scriptArtifact: 'script', assetsArtifact: 'assets' },
    outputSchema: 'FactCheckReport',
    maxAttempts: 2,
    timeout: 60000,
    dependencies: ['script', 'assets'],
    status: 'PENDING',
    attempts: 0,
  })

  return dag
}

function hash(s: string): string {
  const { createHash } = require('crypto')
  return createHash('sha256').update(s).digest('hex').slice(0, 16)
}

/**
 * Get tasks that are ready to run (all dependencies complete).
 */
export function getReadyTasks(dag: ProductionDAG): ProductionTask[] {
  const ready: ProductionTask[] = []
  for (const [id, task] of dag.tasks) {
    if (task.status !== 'PENDING') continue
    const depsComplete = task.dependencies.every(dep => {
      const depTask = dag.tasks.get(dep)
      return depTask && depTask.status === 'COMPLETE'
    })
    if (depsComplete) ready.push(task)
  }
  return ready
}

/**
 * Loop guard — detect if an agent is repeating the same request.
 */
const attemptTracker = new Map<string, { inputHash: string; timestamp: number }[]>()

export function checkLoopGuard(taskId: string, inputHash: string): boolean {
  const attempts = attemptTracker.get(taskId) || []
  const recent = attempts.filter(a => Date.now() - a.timestamp < 60000)
  if (recent.length >= 3 && recent.every(a => a.inputHash === inputHash)) {
    return true // LOOP DETECTED
  }
  recent.push({ inputHash, timestamp: Date.now() })
  attemptTracker.set(taskId, recent)
  return false
}
