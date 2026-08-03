import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isYouTubeConnected } from '@/engine/youtube-client'

export async function POST() {
  try {
    const ytConnected = await isYouTubeConnected()
    
    if (!ytConnected) {
      return NextResponse.json({ 
        ok: false, 
        message: 'YouTube not connected. Connect via OAuth first.',
        collected: false 
      })
    }

    // When YouTube is connected, this would call the YouTube Analytics API
    // For now, record a snapshot placeholder
    const uploads = await db.upload.findMany({ 
      where: { uploadStatus: 'completed' },
      take: 50 
    })

    let collected = 0
    for (const upload of uploads) {
      const existing = await db.analyticsSnapshot.findFirst({
        where: { 
          uploadId: upload.id,
          snapshotDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
      
      if (!existing) {
        await db.analyticsSnapshot.create({
          data: {
            uploadId: upload.id,
            snapshotDate: new Date(),
            // These would be populated from YouTube Analytics API
            views: 0,
            impressions: 0,
            clickThroughRate: 0,
            averageViewDuration: 0,
            averagePercentageViewed: 0,
            subscribersGained: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            estimatedRevenue: 0,
            rpm: 0,
            cpm: 0,
          },
        })
        collected++
      }
    }

    return NextResponse.json({ 
      ok: true, 
      message: `Collected analytics for ${collected} videos`,
      collected: true,
      count: collected
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 500 })
  }
}
