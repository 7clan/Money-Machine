import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/engine/youtube-client'
import { db } from '@/lib/db'

/**
 * POST /api/youtube/exchange-code
 * Manually exchanges an OAuth authorization code for tokens.
 * Used when the redirect-based flow doesn't work (e.g. sandboxed environments).
 *
 * The user copies the `code` parameter from Google's redirect URL
 * and pastes it here along with the CSRF `state`.
 */
export async function POST(request: NextRequest) {
  try {
    const { code, state, redirectUri } = await request.json()

    if (!code) {
      return NextResponse.json({
        error: 'Missing authorization code',
        message: 'Please paste the authorization code from the Google redirect URL.',
      }, { status: 400 })
    }

    // Validate CSRF state if provided
    if (state) {
      const conn = await db.oAuthConnection.findFirst({ where: { provider: 'google' } })
      if (conn && conn.csrfState && conn.csrfState !== state) {
        return NextResponse.json({
          error: 'Invalid state token',
          message: 'The state token doesn\'t match. Please start a new connection attempt.',
        }, { status: 400 })
      }
    }

    // Exchange code for tokens (with optional redirect URI override — MUST match
    // whatever was sent in the original auth URL, or Google rejects the exchange)
    const tokens = await exchangeCode(code, redirectUri)

    // Fetch YouTube channel info
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

    // Store tokens
    const existingConn = await db.oAuthConnection.findFirst({ where: { provider: 'google' } })
    const connId = existingConn?.id || 'google_oauth'

    await db.oAuthConnection.upsert({
      where: { id: connId },
      create: {
        id: connId,
        provider: 'google',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        scope: 'youtube.upload youtube.readonly',
        channelId,
        channelTitle,
        isConnected: true,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        scope: 'youtube.upload youtube.readonly',
        channelId,
        channelTitle,
        isConnected: true,
      },
    })

    // Update channel name if we got it
    if (channelTitle) {
      const existingChannel = await db.channel.findFirst()
      if (existingChannel) {
        await db.channel.update({
          where: { id: existingChannel.id },
          data: { name: channelTitle },
        })
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        action: 'token_refresh',
        actor: 'owner',
        target: channelId || 'youtube',
        details: JSON.stringify({ channelTitle, action: 'manual_code_exchange' }),
      },
    })

    // Create notification
    await db.notification.create({
      data: {
        type: 'success',
        category: 'youtube',
        title: 'YouTube Connected!',
        description: channelTitle
          ? `Successfully connected to: ${channelTitle}`
          : 'YouTube connected successfully',
        isImportant: true,
      },
    })

    // Clear stale agent state (e.g. "YouTube not connected" error)
    const staleError = await db.agentState.findUnique({ where: { key: 'last_error' } })
    if (staleError?.value?.includes('YouTube not connected')) {
      await db.agentState.delete({ where: { key: 'last_error' } })
    }
    const staleNext = await db.agentState.findUnique({ where: { key: 'next_action' } })
    if (staleNext?.value?.includes('Connect YouTube')) {
      await db.agentState.delete({ where: { key: 'next_action' } })
    }

    return NextResponse.json({
      ok: true,
      message: 'YouTube connected successfully!',
      channelTitle,
      channelId,
    })
  } catch (e: any) {
    console.error('Manual code exchange error:', e)
    return NextResponse.json({
      error: 'Code exchange failed',
      message: e.message || 'Failed to exchange authorization code. Make sure the code is fresh (they expire in ~10 minutes).',
    }, { status: 500 })
  }
}
