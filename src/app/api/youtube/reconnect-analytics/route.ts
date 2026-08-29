/**
 * POST /api/youtube/reconnect-analytics
 *
 * Triggers a fresh OAuth flow that requests BOTH youtube.upload AND
 * yt-analytics.readonly scopes. The user must complete Google's consent screen.
 * After callback, the new token's scope is verified to contain yt-analytics.readonly.
 */
import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/engine/youtube-client'

export async function POST() {
  try {
    const url = getAuthUrl('reconnect-analytics')
    return NextResponse.json({
      action: 'open_consent',
      authUrl: url,
      message: 'Open the authUrl to complete Google OAuth consent. Both youtube.upload and yt-analytics.readonly scopes are requested. After consent, the callback will verify the granted scope contains yt-analytics.readonly.',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
