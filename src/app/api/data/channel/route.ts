import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [channel, oauth, niches, pillars] = await Promise.all([
    db.channel.findFirst(),
    db.oAuthConnection.findFirst({ where: { provider: 'google' } }),
    db.nicheAnalysis.findMany({ orderBy: { compositeScore: 'desc' }, take: 35 }),
    db.contentPillar.findMany({ orderBy: { priority: 'desc' } }),
  ])

  return NextResponse.json({
    channel,
    youtubeConnected: oauth?.isConnected || false,
    niches,
    pillars,
  })
}
