/**
 * Autonomous Agent - The main decision and execution loop.
 * 
 * This is the brain that runs the entire YouTube operation:
 * 1. Research niches → Select niche → Create strategy
 * 2. Select topic → Research → Write script
 * 3. Generate narration → Generate visuals → Render video
 * 4. Quality review → Upload → Schedule
 * 5. Collect analytics → Optimise strategy → Repeat
 */

import { db } from '@/lib/db'
import { guardNotStopped, getOperatingMode, isStopped } from './emergency-stop'
import { researchNiches, getSelectedNiche } from './niche-research'
import { createChannelStrategy, getChannelStrategy } from './strategy'
import { researchTopic } from './research'
import { writeScript } from './script-writer'
import { renderVideo } from './video-renderer'
import { reviewVideo } from './quality-review'
import { uploadVideo, isYouTubeConnected } from './youtube-client'
import { llm } from './zai-provider'

export interface AgentStatus {
  state: string
  currentJob: string | null
  operatingMode: string
  emergencyStop: boolean
  niche: string | null
  channelName: string | null
  pipeline: {
    ideas: number
    researched: number
    scripted: number
    producing: number
    reviewing: number
    approved: number
    uploaded: number
  }
  lastAction: string | null
  lastError: string | null
  nextAction: string | null
}

/** Get current agent status */
export async function getAgentStatus(): Promise<AgentStatus> {
  const stopped = await isStopped()
  const mode = await getOperatingMode()
  const niche = await getSelectedNiche()
  const strategy = await getChannelStrategy()
  const channel = await db.channel.findFirst()

  const currentState = await db.agentState.findUnique({ where: { key: 'agent_state' } })
  const currentJob = await db.agentState.findUnique({ where: { key: 'current_job' } })
  const lastAction = await db.agentState.findUnique({ where: { key: 'last_action' } })
  const lastError = await db.agentState.findUnique({ where: { key: 'last_error' } })
  const nextAction = await db.agentState.findUnique({ where: { key: 'next_action' } })

  // Count pipeline items
  const ideas = await db.videoIdea.count({ where: { status: 'idea' } })
  const researched = await db.videoIdea.count({ where: { status: 'researched' } })
  const scripted = await db.videoIdea.count({ where: { status: 'scripted' } })
  const producing = await db.videoProject.count({ where: { status: { in: ['editing', 'rendering'] } } })
  const reviewing = await db.videoProject.count({ where: { status: 'review' } })
  const approved = await db.videoProject.count({ where: { status: 'approved' } })
  const uploaded = await db.upload.count({ where: { uploadStatus: 'completed' } })

  return {
    state: currentState?.value || 'idle',
    currentJob: currentJob?.value || null,
    operatingMode: mode,
    emergencyStop: stopped,
    niche: niche?.nicheName || null,
    channelName: channel?.name || strategy?.channelName || null,
    pipeline: { ideas, researched, scripted, producing, reviewing, approved, uploaded },
    lastAction: lastAction?.value || null,
    lastError: lastError?.value || null,
    nextAction: nextAction?.value || null,
  }
}

/** Set agent state values */
async function setAgentState(key: string, value: string) {
  await db.agentState.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

/** Log an agent action */
async function logAction(action: string, details?: string) {
  await setAgentState('last_action', `${new Date().toISOString()}: ${action}`)
  await db.auditLog.create({
    data: {
      action: 'strategy_change',
      actor: 'agent',
      details: details || action,
    },
  })
}

// ============================================
// PHASE 1: Initial Setup
// ============================================

/** Run the initial niche research phase */
export async function phase1_nicheResearch(): Promise<void> {
  await guardNotStopped()
  await setAgentState('agent_state', 'researching_niches')
  await setAgentState('current_job', 'niche_research')
  await setAgentState('next_action', 'Analyzing 30+ YouTube niches...')

  try {
    logAction('Starting niche research')
    const niches = await researchNiches()
    const best = niches[0]
    
    logAction(`Niche research complete. Selected: ${best.nicheName} (score: ${best.compositeScore.toFixed(2)})`)
    await setAgentState('next_action', 'Create channel strategy')
  } catch (e: any) {
    await setAgentState('last_error', e.message)
    throw e
  }
}

/** Run the strategy creation phase */
export async function phase2_createStrategy(): Promise<void> {
  await guardNotStopped()
  await setAgentState('agent_state', 'creating_strategy')
  await setAgentState('current_job', 'strategy_creation')

  try {
    logAction('Creating channel strategy')
    const strategy = await createChannelStrategy()
    
    logAction(`Strategy created: "${strategy.channelName}" with ${strategy.contentPillars.length} pillars, ${strategy.first30VideoIdeas.length} video ideas, ${strategy.first60ShortIdeas.length} short ideas`)
    await setAgentState('next_action', 'Select and research first topic')
  } catch (e: any) {
    await setAgentState('last_error', e.message)
    throw e
  }
}

// ============================================
// PHASE 2: Content Production Cycle
// ============================================

/** Select the next best topic to produce */
async function selectNextTopic(): Promise<string | null> {
  // Priority: researched > ideas, longform first, best composite score
  const researched = await db.videoIdea.findFirst({
    where: { status: 'researched' },
    orderBy: { compositeScore: 'desc' },
  })
  if (researched) return researched.id

  // Pick the best idea that hasn't been worked on
  const idea = await db.videoIdea.findFirst({
    where: { status: 'idea' },
    orderBy: [
      { type: 'desc' }, // longform first
      { compositeScore: 'desc' },
    ],
  })
  return idea?.id || null
}

/** Research a topic */
export async function phase3_researchTopic(videoIdeaId?: string): Promise<string> {
  await guardNotStopped()
  await setAgentState('agent_state', 'researching_topic')
  await setAgentState('current_job', `research:${videoIdeaId || 'next'}`)

  const ideaId = videoIdeaId || await selectNextTopic()
  if (!ideaId) throw new Error('No video ideas available. Run strategy creation first.')

  try {
    logAction(`Researching topic: ${ideaId}`)
    await researchTopic(ideaId)
    logAction(`Topic research complete: ${ideaId}`)
    await setAgentState('next_action', 'Write script')
    return ideaId
  } catch (e: any) {
    await setAgentState('last_error', e.message)
    throw e
  }
}

/** Write a script for a topic */
export async function phase4_writeScript(videoIdeaId: string): Promise<string> {
  await guardNotStopped()
  await setAgentState('agent_state', 'writing_script')
  await setAgentState('current_job', `script:${videoIdeaId}`)

  try {
    logAction(`Writing script for: ${videoIdeaId}`)
    const result = await writeScript(videoIdeaId)
    logAction(`Script written: ${result.wordCount} words, ~${result.estimatedMinutes.toFixed(1)} minutes`)
    await setAgentState('next_action', 'Produce video')
    return videoIdeaId
  } catch (e: any) {
    await setAgentState('last_error', e.message)
    throw e
  }
}

/** Produce a complete video (render) */
export async function phase5_produceVideo(videoIdeaId: string): Promise<string> {
  await guardNotStopped()
  await setAgentState('agent_state', 'producing_video')
  await setAgentState('current_job', `produce:${videoIdeaId}`)

  const idea = await db.videoIdea.findUnique({
    where: { id: videoIdeaId },
    include: { scripts: true },
  })
  if (!idea) throw new Error(`Idea ${videoIdeaId} not found`)

  // Create video project if not exists
  let project = await db.videoProject.findFirst({
    where: { videoIdeaId, status: { in: ['planning', 'editing', 'rendering'] } },
  })

  if (!project) {
    project = await db.videoProject.create({
      data: {
        videoIdeaId,
        title: idea.title,
        status: 'planning',
      },
    })
  }

  // Update idea status
  await db.videoIdea.update({
    where: { id: videoIdeaId },
    data: { status: 'producing' },
  })

  try {
    logAction(`Rendering video: ${idea.title}`)
    const result = await renderVideo(project.id)
    logAction(`Video rendered: ${result.duration.toFixed(1)}s, ${(result.fileSize / 1024 / 1024).toFixed(1)}MB`)
    await setAgentState('next_action', 'Quality review')
    return project.id
  } catch (e: any) {
    await setAgentState('last_error', e.message)
    await db.videoProject.update({
      where: { id: project.id },
      data: { status: 'failed' },
    })
    throw e
  }
}

/** Run quality review */
export async function phase6_qualityReview(videoProjectId: string): Promise<string> {
  await guardNotStopped()
  await setAgentState('agent_state', 'reviewing')
  await setAgentState('current_job', `review:${videoProjectId}`)

  try {
    logAction(`Quality review: ${videoProjectId}`)
    const result = await reviewVideo(videoProjectId)
    
    if (result.overallPassed) {
      logAction(`Quality review PASSED for ${videoProjectId}`)
      await setAgentState('next_action', 'Upload to YouTube')
    } else {
      logAction(`Quality review FAILED: ${result.issues.join(', ')}`)
      await setAgentState('next_action', `Fix issues: ${result.issues[0]}`)
    }
    return videoProjectId
  } catch (e: any) {
    await setAgentState('last_error', e.message)
    throw e
  }
}

/** Upload video to YouTube */
export async function phase7_upload(videoProjectId: string): Promise<string> {
  await guardNotStopped()
  const mode = await getOperatingMode()
  
  if (mode === 'simulation') {
    logAction('Simulation mode - skipping upload')
    await setAgentState('next_action', 'Select next topic')
    return videoProjectId
  }

  await setAgentState('agent_state', 'uploading')
  await setAgentState('current_job', `upload:${videoProjectId}`)

  const project = await db.videoProject.findUnique({
    where: { id: videoProjectId },
    include: { videoIdea: true },
  })
  if (!project) throw new Error(`Project ${videoProjectId} not found`)

  const ytConnected = await isYouTubeConnected()
  
  if (!ytConnected) {
    logAction('YouTube not connected - video approved but awaiting YouTube connection')
    await setAgentState('last_error', 'YouTube not connected. Complete OAuth setup to upload.')
    await setAgentState('next_action', 'Connect YouTube account, or produce next video')
    await setAgentState('agent_state', 'ready')
    await setAgentState('current_job', '')
    return videoProjectId
  }

  try {
    logAction(`Uploading: ${project.title}`)
    
    const niche = await getSelectedNiche()
    const result = await uploadVideo(
      videoProjectId,
      project.videoFilePath!,
      {
        title: project.title,
        description: `An original educational video about ${project.title}. ${niche?.nicheName || ''}`,
        tags: [niche?.nicheName || 'education', 'tutorial', project.videoIdea.type],
        privacy: 'private', // Always private first
      }
    )

    logAction(`Uploaded: YouTube ID ${result.youtubeVideoId}`)
    
    // Upload thumbnail
    if (project.thumbnailPath) {
      try {
        const { uploadThumbnail } = await import('./youtube-client')
        await uploadThumbnail(result.youtubeVideoId, project.thumbnailPath)
        logAction('Thumbnail uploaded')
      } catch (e: any) {
        logAction(`Thumbnail upload failed: ${e.message}`)
      }
    }

    await setAgentState('next_action', 'Select next topic')
    return videoProjectId
  } catch (e: any) {
    await setAgentState('last_error', e.message)
    throw e
  }
}

// ============================================
// FULL AUTONOMOUS CYCLE
// ============================================

/** Run the complete initial setup (niche research + strategy) */
export async function runInitialSetup(): Promise<void> {
  await guardNotStopped()
  
  // Check if already done
  const niche = await getSelectedNiche()
  const strategy = await getChannelStrategy()

  if (!niche) {
    await phase1_nicheResearch()
  }
  
  if (!strategy) {
    await phase2_createStrategy()
  }

  await setAgentState('agent_state', 'ready')
  await setAgentState('next_action', 'Produce first video')
}

/** Produce the next video (full pipeline) */
export async function produceNextVideo(): Promise<string | null> {
  await guardNotStopped()
  
  // Ensure setup is done
  const niche = await getSelectedNiche()
  if (!niche) {
    await runInitialSetup()
  }

  // Find work in progress or select new topic
  // Check for items at each pipeline stage
  const needsResearch = await db.videoIdea.findFirst({ where: { status: 'idea' } })
  const needsScript = await db.videoIdea.findFirst({ where: { status: 'researched' } })
  const needsProduction = await db.videoIdea.findFirst({ where: { status: 'scripted' } })
  const needsReview = await db.videoProject.findFirst({ where: { status: 'review' } })
  const needsUpload = await db.videoProject.findFirst({ where: { status: 'approved' } })

  try {
    // Continue the pipeline from wherever it's needed
    if (needsUpload) {
      return await phase7_upload(needsUpload.id)
    }
    
    if (needsReview) {
      return await phase6_qualityReview(needsReview.id)
    }

    if (needsProduction) {
      const projectId = await phase5_produceVideo(needsProduction.id)
      await phase6_qualityReview(projectId)
      const project = await db.videoProject.findUnique({ where: { id: projectId } })
      if (project?.isApproved) {
        return await phase7_upload(projectId)
      }
      return projectId
    }

    if (needsScript) {
      await phase4_writeScript(needsScript.id)
      const projectId = await phase5_produceVideo(needsScript.id)
      await phase6_qualityReview(projectId)
      const project = await db.videoProject.findUnique({ where: { id: projectId } })
      if (project?.isApproved) {
        return await phase7_upload(projectId)
      }
      return projectId
    }

    if (needsResearch) {
      await phase3_researchTopic(needsResearch.id)
      await phase4_writeScript(needsResearch.id)
      const projectId = await phase5_produceVideo(needsResearch.id)
      await phase6_qualityReview(projectId)
      const project = await db.videoProject.findUnique({ where: { id: projectId } })
      if (project?.isApproved) {
        return await phase7_upload(projectId)
      }
      return projectId
    }

    // No work available
    await setAgentState('agent_state', 'ready')
    await setAgentState('current_job', '')
    await setAgentState('next_action', 'All pipeline items processed. Click "Produce Next" to continue.')
    return null
  } catch (e: any) {
    await setAgentState('agent_state', 'error')
    await setAgentState('last_error', e.message)
    throw e
  }
}

/** Run the full autonomous cycle (setup + first video) */
export async function runAutonomousCycle(): Promise<void> {
  await guardNotStopped()
  await setAgentState('agent_state', 'running')
  
  try {
    // Phase 1: Setup if needed
    await runInitialSetup()
    
    // Phase 2: Produce first video
    await produceNextVideo()
    
    await setAgentState('agent_state', 'cycle_complete')
    logAction('Autonomous cycle complete')
  } catch (e: any) {
    await setAgentState('agent_state', 'error')
    await setAgentState('last_error', e.message)
    throw e
  }
}

/** Start the autonomous agent */
export async function startAgent(): Promise<void> {
  await guardNotStopped()
  await setAgentState('agent_state', 'starting')
  logAction('Agent starting')
  await runAutonomousCycle()
}

/** Pause the agent */
export async function pauseAgent(): Promise<void> {
  await setAgentState('agent_state', 'paused')
  logAction('Agent paused')
}

/** Resume the agent */
export async function resumeAgent(): Promise<void> {
  await setAgentState('agent_state', 'resuming')
  logAction('Agent resuming')
  await produceNextVideo()
}
