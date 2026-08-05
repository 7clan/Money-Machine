import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/youtube/demo-connect
 * Simulates a YouTube connection for demo/testing purposes.
 * Creates a mock OAuth connection without requiring real Google credentials.
 */
export async function POST() {
  try {
    // Check if already connected with real credentials
    const existing = await db.oAuthConnection.findFirst({
      where: { provider: 'google', isConnected: true },
    })

    if (existing && existing.refreshToken && !existing.refreshToken.startsWith('demo_')) {
      return NextResponse.json({
        error: 'Real connection exists',
        message: 'A real YouTube connection already exists. Disconnect it first before using demo mode.',
      }, { status: 400 })
    }

    // Create or update demo connection
    await db.oAuthConnection.upsert({
      where: { id: 'google_oauth' },
      create: {
        id: 'google_oauth',
        provider: 'google',
        accessToken: 'demo_access_token',
        refreshToken: 'demo_refresh_token',
        tokenExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        scope: 'youtube.upload youtube.readonly',
        channelId: 'demo_channel_id',
        channelTitle: 'Demo YouTube Channel',
        isConnected: true,
      },
      update: {
        accessToken: 'demo_access_token',
        refreshToken: 'demo_refresh_token',
        tokenExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        scope: 'youtube.upload youtube.readonly',
        channelId: 'demo_channel_id',
        channelTitle: 'Demo YouTube Channel',
        isConnected: true,
      },
    })

    // Update or create channel with demo data
    const existingChannel = await db.channel.findFirst()
    if (!existingChannel) {
      await db.channel.create({
        data: {
          name: 'Demo YouTube Channel',
          niche: 'AI & Technology',
          description: 'Demo channel for testing YouTube Revenue Studio',
          positioning: 'Educational AI content for developers',
          targetViewer: 'Tech-savvy developers and AI enthusiasts',
          brandPromise: 'Practical AI knowledge you can apply today',
          uploadCadence: '2x per week',
        },
      })
    } else {
      await db.channel.update({
        where: { id: existingChannel.id },
        data: {
          name: 'Demo YouTube Channel',
          niche: 'AI & Technology',
        },
      })
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'token_refresh',
        actor: 'owner',
        target: 'demo_channel_id',
        details: JSON.stringify({ channelTitle: 'Demo YouTube Channel', action: 'demo_connect' }),
      },
    })

    // Create notification
    await db.notification.create({
      data: {
        type: 'success',
        category: 'youtube',
        title: 'Demo Mode Activated',
        description: 'YouTube connected in demo mode. Uploads will be simulated.',
        isImportant: true,
        actionTab: 'overview',
      },
    })

    return NextResponse.json({
      ok: true,
      demo: true,
      message: 'Demo mode activated! YouTube is connected with simulated data.',
      channelTitle: 'Demo YouTube Channel',
    })
  } catch (e: any) {
    console.error('Demo connect error:', e)
    return NextResponse.json({
      error: 'Failed to activate demo mode',
      message: e.message,
    }, { status: 500 })
  }
}
