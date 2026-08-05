import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isYouTubeConnected, getYouTubeConnectionStatus } from '@/engine/youtube-client'

export async function GET() {
  const [channel, niches, pillars, ytConnected, ytStatus] = await Promise.all([
    db.channel.findFirst(),
    db.nicheAnalysis.findMany({ orderBy: { compositeScore: 'desc' }, take: 35 }),
    db.contentPillar.findMany({ orderBy: { priority: 'desc' } }),
    isYouTubeConnected(),
    getYouTubeConnectionStatus(),
  ])

  return NextResponse.json({
    channel,
    youtubeConnected: ytConnected,
    youtubeStatus: ytStatus,
    niches,
    pillars,
  })
}
