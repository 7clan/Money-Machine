import { NextRequest, NextResponse } from 'next/server'
import {
  startAgent, pauseAgent, resumeAgent, produceNextVideo, runInitialSetup, runAutonomousCycle,
  phase3_researchTopic, phase4_writeScript, phase5_produceVideo, phase6_qualityReview, phase7_upload,
} from '@/engine/agent'
import { researchNiches } from '@/engine/niche-research'
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
        // Persist an important agent notification so the operator is alerted
        // in the NotificationCenter even after a page reload.
        try {
          await db.notification.create({
            data: {
              type: 'error',
              category: 'agent',
              title: 'Emergency stop activated',
              description:
                'The autonomous agent has been halted. Resume from the dashboard when ready.',
              isImportant: true,
              actionLabel: 'Open overview',
              actionTab: 'overview',
            },
          })
        } catch (notifErr) {
          console.error('[agent.command.stop] failed to persist notification:', notifErr)
        }
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

      // ═══════════════════════════════════════════════════════════════════
      // Pipeline-stage commands — wired to the 6 buttons in pipeline-progress.tsx
      // (Generate More, Research Next, Write Script, Start Production, Start Review, Upload All)
      // Each picks the next eligible item and runs the matching phase function fire-and-forget.
      // ═══════════════════════════════════════════════════════════════════

      case 'niche-research': {
        // "Generate More" button — runs niche research + strategy creation to refill ideas
        researchNiches()
          .then(async () => {
            // After niches are picked, create strategy + 90 ideas automatically
            const { createChannelStrategy } = await import('@/engine/strategy')
            await createChannelStrategy()
          })
          .catch(e => console.error('Niche research error:', e))
        return NextResponse.json({ ok: true, message: 'Generating new video ideas via niche research...' })
      }

      case 'research': {
        // "Research Next" button — pick the highest-scoring un-researched idea
        ;(async () => {
          const idea = await db.videoIdea.findFirst({
            where: { status: 'idea' },
            orderBy: [{ compositeScore: 'desc' }, { createdAt: 'asc' }],
          })
          if (!idea) {
            return { ok: true, message: 'No ideas to research — click Generate More first.' }
          }
          await phase3_researchTopic(idea.id)
        })().catch(e => console.error('Topic research error:', e))
        return NextResponse.json({ ok: true, message: 'Researching the next topic...' })
      }

      case 'write-script': {
        // "Write Script" button — pick the highest-scoring researched idea
        ;(async () => {
          const idea = await db.videoIdea.findFirst({
            where: { status: 'researched' },
            orderBy: [{ compositeScore: 'desc' }, { updatedAt: 'asc' }],
          })
          if (!idea) {
            return { ok: true, message: 'No researched topics — click Research Next first.' }
          }
          await phase4_writeScript(idea.id)
        })().catch(e => console.error('Script write error:', e))
        return NextResponse.json({ ok: true, message: 'Writing a script for the next topic...' })
      }

      case 'produce': {
        // "Start Production" button — pick the highest-scoring scripted idea, render the video
        ;(async () => {
          const idea = await db.videoIdea.findFirst({
            where: { status: 'scripted' },
            orderBy: [{ compositeScore: 'desc' }, { updatedAt: 'asc' }],
          })
          if (!idea) {
            return { ok: true, message: 'No scripts ready — click Write Script first.' }
          }
          await phase5_produceVideo(idea.id)
        })().catch(e => console.error('Produce error:', e))
        return NextResponse.json({ ok: true, message: 'Producing the next video...' })
      }

      case 'review': {
        // "Start Review" button — pick the next project in 'review' status
        ;(async () => {
          const project = await db.videoProject.findFirst({
            where: { status: 'review' },
            orderBy: { updatedAt: 'desc' },
          })
          if (!project) {
            return { ok: true, message: 'No videos to review — click Start Production first.' }
          }
          await phase6_qualityReview(project.id)
        })().catch(e => console.error('Quality review error:', e))
        return NextResponse.json({ ok: true, message: 'Running quality review...' })
      }

      case 'upload': {
        // "Upload All" button — loop over every approved project and upload each to YouTube
        ;(async () => {
          const projects = await db.videoProject.findMany({
            where: { status: 'approved', isApproved: true },
            orderBy: { updatedAt: 'asc' },
          })
          if (projects.length === 0) {
            return { ok: true, message: 'No approved videos to upload.' }
          }
          for (const p of projects) {
            try {
              await phase7_upload(p.id)
            } catch (e) {
              console.error(`Upload failed for project ${p.id}:`, e)
              // continue to the next project
            }
          }
        })().catch(e => console.error('Upload-all error:', e))
        return NextResponse.json({ ok: true, message: 'Uploading all approved videos to YouTube...' })
      }

      default:
        return NextResponse.json({ error: `Unknown command: ${command}` }, { status: 400 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
