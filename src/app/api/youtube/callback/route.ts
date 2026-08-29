import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/engine/youtube-client'
import { db } from '@/lib/db'

/**
 * GET /api/youtube/callback?code=xxx&state=yyy
 * Handles the redirect from Google after user authorizes the app.
 * Google sends the authorization code and state as query params.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    const baseUrl = process.env.APP_PUBLIC_URL || new URL(request.url).origin

    // Handle user denial
    if (error) {
      const errorDesc = searchParams.get('error_description') || error
      return NextResponse.redirect(
        `${baseUrl}/?youtube_auth=error&message=${encodeURIComponent(errorDesc)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/?youtube_auth=error&message=Missing%20authorization%20code`
      )
    }

    // Validate CSRF state — the state is a cryptographic nonce persisted by getAuthUrl.
    // The state format is: <nonceHex>:<purpose> (e.g., "a1b2...:reconnect-analytics")
    const conn = await db.oAuthConnection.findFirst({ where: { provider: 'google' } })
    if (!conn || !conn.csrfState || conn.csrfState !== state) {
      return NextResponse.redirect(
        `${baseUrl}/?youtube_auth=error&message=Invalid%20state%20nonce`
      )
    }
    // Extract the purpose from the validated state (for analytics scope verification)
    const statePurpose = state.includes(':') ? state.split(':').slice(1).join(':') : ''

    // Exchange code for tokens
    const tokens = await exchangeCode(code)

    // Fetch YouTube channel info with the new access token
    let channelTitle = ''
    let channelId = ''
    try {
      const channelRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
      )
      if (channelRes.ok) {
        const channelData = await channelRes.json()
        const ch = channelData.items?.[0]
        if (ch) {
          channelTitle = ch.snippet?.title || ''
          channelId = ch.id || ''
        }
      }
    } catch (e) {
      console.error('Failed to fetch channel info:', e)
    }

    // Store tokens + scope + mark as connected
    await db.oAuthConnection.upsert({
      where: { id: conn.id },
      create: {
        id: conn.id,
        provider: 'google',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        scope: tokens.scope,
        isConnected: true,
        channelTitle,
        channelId,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        scope: tokens.scope,
        isConnected: true,
        channelTitle,
        channelId,
      },
    })

    // If this was a reconnect-analytics flow, verify the granted scope includes yt-analytics.readonly
    let analyticsScopeOk: boolean | null = null
    if (statePurpose === 'reconnect-analytics') {
      const requiredAnalytics = 'https://www.googleapis.com/auth/yt-analytics.readonly'
      analyticsScopeOk = (tokens.scope || '').split(/\s+/).some((s: string) => s === requiredAnalytics || s === 'yt-analytics.readonly')
    }

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'token_refresh',
        actor: 'owner',
        target: channelId || 'youtube',
        details: JSON.stringify({ channelTitle, action: 'oauth_connected', scope: tokens.scope, analyticsScopeOk }),
      },
    })

    // Create notification
    await db.notification.create({
      data: {
        type: 'success',
        category: 'youtube',
        title: 'YouTube Connected',
        description: channelTitle
          ? `Successfully connected to channel: ${channelTitle}`
          : 'YouTube account connected successfully',
        isImportant: true,
        actionTab: 'settings',
      },
    })

    // Redirect back to app with success indicator.
    // baseUrl was set at the top of the try block (APP_PUBLIC_URL-aware).
    const analyticsParam = analyticsScopeOk === null ? '' : `&analytics_scope=${analyticsScopeOk ? 'granted' : 'missing'}`
    const successUrl = `${baseUrl}/?youtube_auth=success${channelTitle ? '&channel=' + encodeURIComponent(channelTitle) : ''}${analyticsParam}`
    return NextResponse.redirect(successUrl)
  } catch (e: any) {
    console.error('YouTube callback error:', e)
    const errBaseUrl = process.env.APP_PUBLIC_URL || new URL(request.url).origin
    return NextResponse.redirect(
      `${errBaseUrl}/?youtube_auth=error&message=${encodeURIComponent(e.message || 'Unknown error')}`
    )
  }
}

/**
 * POST /api/youtube/callback
 * Alternative: handle the callback via POST (for popup-based flows)
 */
export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json()

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
    }

    // Validate CSRF state
    const conn = await db.oAuthConnection.findFirst({ where: { provider: 'google' } })
    if (!conn || conn.csrfState !== state) {
      return NextResponse.json({ error: 'Invalid state (CSRF)' }, { status: 400 })
    }

    // Exchange code for tokens
    const tokens = await exchangeCode(code)

    // Fetch channel info
    let channelTitle = ''
    let channelId = ''
    try {
      const channelRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
      )
      if (channelRes.ok) {
        const channelData = await channelRes.json()
        const ch = channelData.items?.[0]
        if (ch) {
          channelTitle = ch.snippet?.title || ''
          channelId = ch.id || ''
        }
      }
    } catch {}

    // Store tokens
    await db.oAuthConnection.upsert({
      where: { id: conn.id },
      create: {
        id: conn.id,
        provider: 'google',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        isConnected: true,
        channelTitle,
        channelId,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        isConnected: true,
        channelTitle,
        channelId,
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'YouTube connected',
      channelTitle,
      channelId,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
