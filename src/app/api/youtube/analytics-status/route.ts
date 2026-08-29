/**
 * GET /api/youtube/analytics-status
 *
 * Returns whether the connected YouTube account has the yt-analytics.readonly
 * scope, and the URL to reconnect with the analytics scope added.
 */
import { NextResponse } from 'next/server'
import { verifyAnalyticsScope } from '@/engine/analytics-agent'
import { getAuthUrl } from '@/engine/youtube-client'

export async function GET() {
  try {
    const { hasScope, grantedScopes } = await verifyAnalyticsScope()
    const reconnectUrl = await getAuthUrl('reconnect-analytics')
    return NextResponse.json({
      hasAnalyticsScope: hasScope,
      grantedScopes,
      requiredScope: 'https://www.googleapis.com/auth/yt-analytics.readonly',
      reconnectUrl,
      action: hasScope ? null : 'Click reconnectUrl to authorize YouTube Analytics (yt-analytics.readonly scope).',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
