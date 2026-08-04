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

    // Handle user denial
    if (error) {
      const errorDesc = searchParams.get('error_description') || error
      return NextResponse.redirect(
        new URL(`/?youtube_auth=error&message=${encodeURIComponent(errorDesc)}`, request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/?youtube_auth=error&message=Missing%20authorization%20code', request.url)
      )
    }

    // Validate CSRF state
    const conn = await db.oAuthConnection.findFirst({ where: { provider: 'google' } })
    if (!conn || conn.csrfState !== state) {
      return NextResponse.redirect(
        new URL('/?youtube_auth=error&message=Invalid%20state%20token', request.url)
      )
    }

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

    // Store tokens and mark as connected
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

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'token_refresh',
        actor: 'owner',
        target: channelId || 'youtube',
        details: JSON.stringify({ channelTitle, action: 'oauth_connected' }),
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

    // Redirect back to app with success indicator
    return NextResponse.redirect(
      new URL(
        `/?youtube_auth=success${channelTitle ? '&channel=' + encodeURIComponent(channelTitle) : ''}`,
        request.url
      )
    )
  } catch (e: any) {
    console.error('YouTube callback error:', e)
    return NextResponse.redirect(
      new URL(`/?youtube_auth=error&message=${encodeURIComponent(e.message || 'Unknown error')}`, request.url)
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
