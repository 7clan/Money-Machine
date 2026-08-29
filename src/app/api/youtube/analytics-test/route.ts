/**
 * GET /api/youtube/analytics-test?videoId=XXX
 *
 * After reconnect, tests the analytics pipeline:
 *   1. verifies scope is present
 *   2. executes a real YouTube Analytics API request
 *   3. persists AnalyticsSnapshot
 *   4. persists LearningSignal if sufficient data exists
 *
 * Returns the full AnalyticsFetchResult. Never fabricates metrics — if the API
 * returns no rows (brand-new private video), status=NO_DATA.
 */
import { NextRequest, NextResponse } from 'next/server'
import { fetchAndPersistAnalytics } from '@/engine/analytics-agent'

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId')
  if (!videoId) {
    return NextResponse.json({ error: 'videoId query parameter required' }, { status: 400 })
  }
  try {
    const result = await fetchAndPersistAnalytics(videoId)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({
      status: 'FAIL',
      reason: e instanceof Error ? e.message : String(e),
      videoId,
      learningSignalsCreated: 0,
    }, { status: 500 })
  }
}
