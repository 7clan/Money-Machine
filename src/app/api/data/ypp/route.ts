import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  // YPP eligibility thresholds (from official YouTube sources, last checked date)
  const YPP_CRITERIA = {
    longForm: {
      subscribers: 1000,
      watchHours: 4000,
      lastCheckedAt: '2025-01-01',
      source: 'YouTube Partner Program overview - support.google.com',
    },
    shorts: {
      subscribers: 1000,
      shortsViews: 10000000,
      lastCheckedAt: '2025-01-01',
      source: 'YouTube Partner Program overview - support.google.com',
    },
  }

  const ypp = await db.yPPProgress.findFirst()
  const channel = await db.channel.findFirst()
  const uploads = await db.upload.count({ where: { uploadStatus: 'completed' } })
  const publicUploads = await db.upload.count({ where: { uploadStatus: 'completed', privacy: { in: ['public', 'unlisted'] } } })

  // Calculate progress percentages
  const subs = ypp?.subscribers || 0
  const watchHours = ypp?.watchHours || 0
  const shortsViews = ypp?.shortsViews || 0

  const longFormProgress = {
    subscribers: { current: subs, required: YPP_CRITERIA.longForm.subscribers, percent: Math.min(100, (subs / YPP_CRITERIA.longForm.subscribers) * 100) },
    watchHours: { current: watchHours, required: YPP_CRITERIA.longForm.watchHours, percent: Math.min(100, (watchHours / YPP_CRITERIA.longForm.watchHours) * 100) },
  }

  const shortsProgress = {
    subscribers: { current: subs, required: YPP_CRITERIA.shorts.subscribers, percent: Math.min(100, (subs / YPP_CRITERIA.shorts.subscribers) * 100) },
    shortsViews: { current: shortsViews, required: YPP_CRITERIA.shorts.shortsViews, percent: Math.min(100, (shortsViews / YPP_CRITERIA.shorts.shortsViews) * 100) },
  }

  const checklist = {
    twoStepVerified: ypp?.twoStepVerified || false,
    advancedFeatures: ypp?.advancedFeatures || false,
    adsenseLinked: ypp?.adsenseLinked || false,
    noCommunityStrikes: (ypp?.communityStrikes || 0) === 0,
    hasPublicUploads: publicUploads > 0,
  }

  return NextResponse.json({
    channel: channel?.name || 'Not set',
    criteria: YPP_CRITERIA,
    longFormProgress,
    shortsProgress,
    checklist,
    stats: {
      subscribers: subs,
      watchHours,
      shortsViews,
      totalUploads: uploads,
      publicUploads,
      communityStrikes: ypp?.communityStrikes || 0,
    },
  })
}
