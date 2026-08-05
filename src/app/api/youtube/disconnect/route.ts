import { NextResponse } from 'next/server'
import { revokeTokens } from '@/engine/youtube-client'
import { db } from '@/lib/db'

/**
 * POST /api/youtube/disconnect
 * Disconnects YouTube by revoking OAuth tokens and clearing connection state.
 */
export async function POST() {
  try {
    // Check if connected
    const conn = await db.oAuthConnection.findFirst({
      where: { provider: 'google', isConnected: true },
    })

    if (!conn) {
      return NextResponse.json({
        error: 'Not connected',
        message: 'YouTube is not currently connected.',
      }, { status: 400 })
    }

    // Revoke tokens at Google and update local state
    await revokeTokens()

    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'token_revoke',
        actor: 'owner',
        details: 'YouTube disconnected by user',
      },
    })

    // Create notification
    await db.notification.create({
      data: {
        type: 'warning',
        category: 'youtube',
        title: 'YouTube Disconnected',
        description: 'Your YouTube account has been disconnected. Uploads and analytics are disabled.',
        isImportant: true,
        actionTab: 'settings',
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'YouTube disconnected successfully',
    })
  } catch (e: any) {
    console.error('YouTube disconnect error:', e)
    return NextResponse.json({
      error: 'Failed to disconnect',
      message: e.message,
    }, { status: 500 })
  }
}

/**
 * GET /api/youtube/disconnect
 * Returns current connection status
 */
export async function GET() {
  try {
    const conn = await db.oAuthConnection.findFirst({
      where: { provider: 'google' },
    })

    return NextResponse.json({
      connected: conn?.isConnected || false,
      channelTitle: conn?.channelTitle || null,
      channelId: conn?.channelId || null,
      tokenExpiry: conn?.tokenExpiry || null,
      scope: conn?.scope || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
