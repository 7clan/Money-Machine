import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl, getYouTubeConfig } from '@/engine/youtube-client'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * GET /api/youtube/auth?redirect_uri=<optional override>
 * Initiates the YouTube OAuth 2.0 flow.
 * Generates a CSRF state, stores it, and returns the Google authorization URL.
 * The optional `redirect_uri` query param lets the caller override the env-based
 * YOUTUBE_REDIRECT_URI — useful when the user registered a different URI in
 * Google Cloud Console than what's in .env.
 */
export async function GET(request: NextRequest) {
  try {
    const config = getYouTubeConfig()

    // Optional override from query string
    const overrideRedirectUri = request.nextUrl.searchParams.get('redirect_uri')?.trim() || undefined

    // Check if credentials are configured
    if (!config.clientId || !config.clientSecret) {
      return NextResponse.json({
        error: 'YouTube OAuth not configured',
        message: 'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your .env file.',
        setupRequired: true,
        steps: [
          '1. Go to https://console.cloud.google.com/',
          '2. Create a new project or select existing one',
          '3. Enable YouTube Data API v3',
          '4. Go to Credentials → Create OAuth 2.0 Client ID',
          '5. Set redirect URI to: ' + (overrideRedirectUri || config.redirectUri),
          '6. Copy Client ID and Client Secret to your .env file',
        ],
      }, { status: 400 })
    }

    // Check if already connected
    const existing = await db.oAuthConnection.findFirst({
      where: { provider: 'google', isConnected: true },
    })
    if (existing && existing.refreshToken) {
      return NextResponse.json({
        connected: true,
        channelTitle: existing.channelTitle,
        channelId: existing.channelId,
        message: 'YouTube is already connected',
      })
    }

    // Generate CSRF state token
    const state = randomUUID()

    // Store state for validation in callback
    await db.oAuthConnection.upsert({
      where: { id: 'google_oauth' },
      create: {
        id: 'google_oauth',
        provider: 'google',
        csrfState: state,
        isConnected: false,
      },
      update: { csrfState: state },
    })

    // Generate the Google authorization URL (with optional redirect URI override)
    const authUrl = getAuthUrl(state, overrideRedirectUri)

    return NextResponse.json({
      authUrl,
      state,
      redirectUri: overrideRedirectUri || config.redirectUri,
    })
  } catch (e: any) {
    console.error('YouTube auth init error:', e)
    return NextResponse.json({
      error: 'Failed to initiate OAuth flow',
      message: e.message,
    }, { status: 500 })
  }
}
