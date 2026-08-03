import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl, exchangeCode } from '@/engine/youtube-client'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

/** Start OAuth flow */
export async function GET() {
  try {
    const state = randomUUID() // CSRF protection
    
    // Store state for validation
    await db.oAuthConnection.upsert({
      where: { id: 'google_oauth' },
      create: { id: 'google_oauth', provider: 'google', csrfState: state },
      update: { csrfState: state },
    })

    const authUrl = getAuthUrl(state)
    return NextResponse.json({ authUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/** Handle OAuth callback */
export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json()

    // Validate CSRF state
    const conn = await db.oAuthConnection.findFirst({ where: { provider: 'google' } })
    if (!conn || conn.csrfState !== state) {
      return NextResponse.json({ error: 'Invalid state (CSRF)' }, { status: 400 })
    }

    // Exchange code for tokens
    const tokens = await exchangeCode(code)

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
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        isConnected: true,
      },
    })

    return NextResponse.json({ ok: true, message: 'YouTube connected' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
