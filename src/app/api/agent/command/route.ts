import { NextRequest, NextResponse } from 'next/server'
import { startAgent, pauseAgent, resumeAgent, produceNextVideo, runInitialSetup, runAutonomousCycle } from '@/engine/agent'
import { setStopped, setOperatingMode } from '@/engine/emergency-stop'
import { scheduleJob, processNextJob } from '@/engine/job-queue'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { command } = body

    switch (command) {
      case 'start':
        // Start the agent asynchronously
        startAgent().catch(e => console.error('Agent start error:', e))
        return NextResponse.json({ ok: true, message: 'Agent starting...' })

      case 'stop':
        await setStopped(true)
        return NextResponse.json({ ok: true, message: 'Emergency stop activated' })

      case 'resume':
        await setStopped(false)
        resumeAgent().catch(e => console.error('Agent resume error:', e))
        return NextResponse.json({ ok: true, message: 'Agent resumed' })

      case 'pause':
        await pauseAgent()
        return NextResponse.json({ ok: true, message: 'Agent paused' })

      case 'produce-next':
        produceNextVideo().catch(e => console.error('Produce error:', e))
        return NextResponse.json({ ok: true, message: 'Producing next video...' })

      case 'initial-setup':
        runInitialSetup().catch(e => console.error('Setup error:', e))
        return NextResponse.json({ ok: true, message: 'Running initial setup...' })

      case 'full-cycle':
        runAutonomousCycle().catch(e => console.error('Cycle error:', e))
        return NextResponse.json({ ok: true, message: 'Running full autonomous cycle...' })

      case 'set-mode': {
        const { mode } = body
        if (!['simulation', 'private_production', 'autonomous_publication'].includes(mode)) {
          return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
        }
        await setOperatingMode(mode)
        return NextResponse.json({ ok: true, message: `Mode set to ${mode}` })
      }

      case 'process-job':
        const processed = await processNextJob()
        return NextResponse.json({ ok: true, processed })

      case 'collect-analytics':
        // Trigger analytics collection
        fetch('/api/agent/collect-analytics', { method: 'POST' }).catch(() => {})
        return NextResponse.json({ ok: true, message: 'Collecting analytics...' })

      case 'schedule-jobs':
        // Schedule recurring jobs
        fetch('/api/agent/schedule-jobs', { method: 'POST' }).catch(() => {})
        return NextResponse.json({ ok: true, message: 'Scheduling recurring jobs...' })

      case 'review-strategy':
        // Strategy review - produce next with analysis
        produceNextVideo().catch(e => console.error('Strategy review error:', e))
        return NextResponse.json({ ok: true, message: 'Reviewing strategy and producing next...' })

      default:
        return NextResponse.json({ error: `Unknown command: ${command}` }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
