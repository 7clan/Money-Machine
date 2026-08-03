import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const now = new Date()
    const jobs: Array<{ type: string; id: string }> = []

    // Schedule recurring production jobs
    // Weekly long-form video
    const existingLongform = await db.job.findFirst({
      where: { type: 'produce_video', status: 'pending' }
    })
    if (!existingLongform) {
      const id = await db.job.create({
        data: {
          type: 'produce_video',
          scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          priority: 5,
          data: JSON.stringify({ type: 'longform' }),
        }
      })
      jobs.push({ type: 'produce_video', id: id.id })
    }

    // Analytics collection (daily)
    const existingAnalytics = await db.job.findFirst({
      where: { type: 'analytics_collect', status: 'pending' }
    })
    if (!existingAnalytics) {
      const id = await db.job.create({
        data: {
          type: 'analytics_collect',
          scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          priority: 3,
        }
      })
      jobs.push({ type: 'analytics_collect', id: id.id })
    }

    // Strategy review (weekly)
    const existingStrategy = await db.job.findFirst({
      where: { type: 'strategy_review', status: 'pending' }
    })
    if (!existingStrategy) {
      const id = await db.job.create({
        data: {
          type: 'strategy_review',
          scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          priority: 3,
        }
      })
      jobs.push({ type: 'strategy_review', id: id.id })
    }

    // Token refresh (daily)
    const existingToken = await db.job.findFirst({
      where: { type: 'token_refresh', status: 'pending' }
    })
    if (!existingToken) {
      const id = await db.job.create({
        data: {
          type: 'token_refresh',
          scheduledAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          priority: 8,
        }
      })
      jobs.push({ type: 'token_refresh', id: id.id })
    }

    return NextResponse.json({ 
      ok: true, 
      message: `Scheduled ${jobs.length} recurring jobs`,
      jobs 
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 500 })
  }
}

export async function GET() {
  const jobs = await db.job.findMany({ 
    orderBy: { scheduledAt: 'asc' },
    take: 20 
  })
  return NextResponse.json(jobs)
}
