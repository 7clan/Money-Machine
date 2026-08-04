/**
 * Agent CLI - Command-line interface for the autonomous YouTube agent.
 * 
 * Usage: bun run src/engine/cli.ts <command>
 * 
 * Commands:
 *   start              - Start the autonomous agent (full cycle)
 *   status             - Show current agent status
 *   pause              - Pause the agent
 *   resume             - Resume from paused state
 *   stop               - Emergency stop (all actions suspended)
 *   produce-next       - Produce the next video in the pipeline
 *   upload-private     - Upload a completed video privately
 *   collect-analytics  - Collect analytics from YouTube
 *   review-strategy    - Review and adjust strategy based on data
 */

// This CLI runs directly against the engine modules
// It does not require the Next.js dev server to be running

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function getAgentState(key: string): Promise<string | null> {
  const state = await prisma.agentState.findUnique({ where: { key } })
  return state?.value || null
}

async function setAgentState(key: string, value: string): Promise<void> {
  await prisma.agentState.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

async function main() {
  const command = process.argv[2]

  if (!command) {
    console.log(`
YouTube Revenue Studio - Autonomous Agent CLI

Commands:
  start              Start the autonomous agent (full cycle)
  status             Show current agent status
  pause              Pause the agent
  resume             Resume from paused state
  stop               Emergency stop (all actions suspended)
  produce-next       Produce the next video in the pipeline
  upload-private     - Upload a completed video privately
  collect-analytics  Collect analytics from YouTube
  review-strategy    Review and adjust strategy based on data
`)
    return
  }

  console.log(`[Agent CLI] Executing: ${command}`)

  switch (command) {
    case 'status': {
      const state = await getAgentState('agent_state')
      const currentJob = await getAgentState('current_job')
      const lastAction = await getAgentState('last_action')
      const lastError = await getAgentState('last_error')
      const nextAction = await getAgentState('next_action')
      const niche = await getAgentState('selected_niche')
      const mode = await getAgentState('operating_mode')
      const stopped = await getAgentState('emergency_stop')

      const pipeline = {
        ideas: await prisma.videoIdea.count({ where: { status: 'idea' } }),
        researched: await prisma.videoIdea.count({ where: { status: 'researched' } }),
        scripted: await prisma.videoIdea.count({ where: { status: 'scripted' } }),
        producing: await prisma.videoProject.count({ where: { status: { in: ['editing', 'rendering'] } } }),
        reviewing: await prisma.videoProject.count({ where: { status: 'review' } }),
        approved: await prisma.videoProject.count({ where: { status: 'approved' } }),
        uploaded: await prisma.upload.count({ where: { uploadStatus: 'completed' } }),
      }

      console.log('\n=== Agent Status ===')
      console.log(`State:          ${state || 'idle'}`)
      console.log(`Current Job:    ${currentJob || 'none'}`)
      console.log(`Operating Mode: ${mode || 'private_production'}`)
      console.log(`Emergency Stop: ${stopped === 'true' ? 'ACTIVE' : 'inactive'}`)
      console.log(`Niche:          ${niche ? JSON.parse(niche).nicheName : 'not selected'}`)
      console.log(`Last Action:    ${lastAction || 'none'}`)
      console.log(`Next Action:    ${nextAction || 'none'}`)
      if (lastError) console.log(`Last Error:     ${lastError}`)
      console.log(`\nPipeline: ideas=${pipeline.ideas} researched=${pipeline.researched} scripted=${pipeline.scripted} producing=${pipeline.producing} reviewing=${pipeline.reviewing} approved=${pipeline.approved} uploaded=${pipeline.uploaded}`)
      break
    }

    case 'stop': {
      await setAgentState('emergency_stop', 'true')
      await setAgentState('agent_state', 'stopped')
      await prisma.auditLog.create({ data: { action: 'emergency_stop', actor: 'owner', details: 'Emergency stop via CLI' } })
      console.log('🛑 EMERGENCY STOP ACTIVATED - All autonomous actions suspended')
      break
    }

    case 'resume': {
      await setAgentState('emergency_stop', 'false')
      await setAgentState('agent_state', 'resuming')
      console.log('▶ Agent resumed - emergency stop deactivated')
      break
    }

    case 'pause': {
      await setAgentState('agent_state', 'paused')
      console.log('⏸ Agent paused')
      break
    }

    case 'start':
    case 'produce-next':
    case 'upload-private':
    case 'collect-analytics':
    case 'review-strategy': {
      // These commands need the full engine, which requires the Next.js server
      // Instead, trigger via the API
      const apiUrl = 'http://localhost:3000/api/agent/command'
      const commandMap: Record<string, string> = {
        'start': 'full-cycle',
        'produce-next': 'produce-next',
        'upload-private': 'upload-private',
        'collect-analytics': 'collect-analytics',
        'review-strategy': 'review-strategy',
      }
      
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: commandMap[command] || command }),
        })
        const data = await res.json()
        console.log('Response:', JSON.stringify(data, null, 2))
      } catch {
        console.log('⚠ Could not connect to the agent API. Is the Next.js server running?')
        console.log('  Start it with: bun run dev')
        console.log('  Then run this command again.')
      }
      break
    }

    default:
      console.log(`Unknown command: ${command}`)
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('CLI Error:', e)
  prisma.$disconnect()
  process.exit(1)
})
