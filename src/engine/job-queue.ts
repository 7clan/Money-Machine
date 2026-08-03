/**
 * Job Queue - Persistent scheduler that survives restarts.
 * 
 * Uses the database to store jobs. A runner process checks
 * for pending jobs and executes them.
 */

import { db } from '@/lib/db'
import { guardNotStopped } from './emergency-stop'

export type JobType =
  | 'initial_setup'
  | 'niche_research'
  | 'topic_research'
  | 'script_write'
  | 'produce_video'
  | 'quality_review'
  | 'upload'
  | 'publish'
  | 'analytics_collect'
  | 'strategy_review'
  | 'revenue_review'
  | 'token_refresh'

export interface JobPayload {
  videoIdeaId?: string
  videoProjectId?: string
  [key: string]: any
}

/** Schedule a new job */
export async function scheduleJob(
  type: JobType,
  scheduledAt: Date,
  data?: JobPayload,
  priority: number = 5
): Promise<string> {
  const job = await db.job.create({
    data: {
      type,
      scheduledAt,
      priority,
      data: data ? JSON.stringify(data) : null,
    },
  })
  return job.id
}

/** Get the next pending job */
export async function getNextJob(): Promise<string | null> {
  const job = await db.job.findFirst({
    where: {
      status: 'pending',
      scheduledAt: { lte: new Date() },
    },
    orderBy: [
      { priority: 'desc' },
      { scheduledAt: 'asc' },
    ],
  })
  return job?.id || null
}

/** Mark a job as running */
export async function startJob(jobId: string): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date() },
  })
}

/** Mark a job as completed */
export async function completeJob(jobId: string, result?: any): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      result: result ? JSON.stringify(result) : null,
    },
  })
}

/** Mark a job as failed */
export async function failJob(jobId: string, error: string): Promise<void> {
  const job = await db.job.findUnique({ where: { id: jobId } })
  const retryCount = (job?.retryCount || 0) + 1

  if (retryCount >= (job?.maxRetries || 3)) {
    await db.job.update({
      where: { id: jobId },
      data: { status: 'failed', error, retryCount },
    })
  } else {
    // Retry with exponential backoff
    const backoffMs = Math.pow(2, retryCount) * 60000 // 1min, 2min, 4min
    await db.job.update({
      where: { id: jobId },
      data: {
        status: 'pending',
        error,
        retryCount,
        scheduledAt: new Date(Date.now() + backoffMs),
      },
    })
  }
}

/** Process a single job */
export async function processJob(jobId: string): Promise<void> {
  await guardNotStopped()
  
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'pending') return

  await startJob(jobId)
  const data = job.data ? JSON.parse(job.data) : {}

  // Dynamic imports to avoid circular deps
  const { phase1_nicheResearch, phase2_createStrategy, phase3_researchTopic, phase4_writeScript, phase5_produceVideo, phase6_qualityReview, phase7_upload, runInitialSetup } = await import('./agent')

  try {
    let result: any

    switch (job.type) {
      case 'initial_setup':
        await runInitialSetup()
        result = { done: true }
        break

      case 'niche_research':
        await phase1_nicheResearch()
        result = { done: true }
        break

      case 'topic_research':
        await phase3_researchTopic(data.videoIdeaId)
        result = { videoIdeaId: data.videoIdeaId }
        break

      case 'script_write':
        await phase4_writeScript(data.videoIdeaId)
        result = { videoIdeaId: data.videoIdeaId }
        break

      case 'produce_video':
        await phase5_produceVideo(data.videoIdeaId)
        result = { videoIdeaId: data.videoIdeaId }
        break

      case 'quality_review':
        await phase6_qualityReview(data.videoProjectId)
        result = { videoProjectId: data.videoProjectId }
        break

      case 'upload':
        await phase7_upload(data.videoProjectId)
        result = { videoProjectId: data.videoProjectId }
        break

      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }

    await completeJob(jobId, result)
  } catch (e: any) {
    await failJob(jobId, e.message)
  }
}

/** Run the job queue processor (call this periodically) */
export async function processNextJob(): Promise<boolean> {
  const jobId = await getNextJob()
  if (!jobId) return false
  
  await processJob(jobId)
  return true
}

/** Schedule recurring jobs */
export async function scheduleRecurringJobs(): Promise<void> {
  // Check if recurring jobs already exist
  const existingStrategyReview = await db.job.findFirst({
    where: { type: 'strategy_review', status: 'pending' },
  })
  
  if (!existingStrategyReview) {
    // Weekly strategy review
    await scheduleJob('strategy_review', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), undefined, 3)
  }
}

/** Get all jobs for display */
export async function getJobs(status?: string) {
  return db.job.findMany({
    where: status ? { status } : undefined,
    orderBy: { scheduledAt: 'desc' },
    take: 50,
  })
}
