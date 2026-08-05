import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isYouTubeConnected } from '@/engine/youtube-client'

export async function GET() {
  const [channel, niches, pillars, ytConnected] = await Promise.all([
    db.channel.findFirst(),
    db.nicheAnalysis.findMany({ orderBy: { compositeScore: 'desc' }, take: 35 }),
    db.contentPillar.findMany({ orderBy: { priority: 'desc' } }),
    isYouTubeConnected(),
  ])

  return NextResponse.json({
    channel,
    youtubeConnected: ytConnected,
    niches,
    pillars,
  })
}
