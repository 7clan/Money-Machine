import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile } from 'fs/promises'
import path from 'path'

/**
 * POST /api/youtube/save-credentials
 * Saves YouTube OAuth credentials to the .env file.
 */
export async function POST(request: NextRequest) {
  try {
    const { clientId, clientSecret } = await request.json()

    if (!clientId || !clientSecret) {
      return NextResponse.json({
        error: 'Missing credentials',
        message: 'Both clientId and clientSecret are required.',
      }, { status: 400 })
    }

    // Validate format
    if (!clientId.includes('.apps.googleusercontent.com')) {
      return NextResponse.json({
        error: 'Invalid Client ID format',
        message: 'Client ID should end with .apps.googleusercontent.com',
      }, { status: 400 })
    }

    const envPath = path.join(process.cwd(), '.env')
    let envContent = ''

    try {
      envContent = await readFile(envPath, 'utf-8')
    } catch {
      envContent = ''
    }

    // Update or add YouTube env vars
    const lines = envContent.split('\n')
    let updatedClientId = false
    let updatedClientSecret = false
    let updatedRedirectUri = false

    const redirectUri = process.env.YOUTUBE_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/youtube/callback`

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('YOUTUBE_CLIENT_ID=')) {
        lines[i] = `YOUTUBE_CLIENT_ID=${clientId}`
        updatedClientId = true
      } else if (lines[i].startsWith('YOUTUBE_CLIENT_SECRET=')) {
        lines[i] = `YOUTUBE_CLIENT_SECRET=${clientSecret}`
        updatedClientSecret = true
      } else if (lines[i].startsWith('YOUTUBE_REDIRECT_URI=')) {
        lines[i] = `YOUTUBE_REDIRECT_URI=${redirectUri}`
        updatedRedirectUri = true
      }
    }

    if (!updatedClientId) lines.push(`YOUTUBE_CLIENT_ID=${clientId}`)
    if (!updatedClientSecret) lines.push(`YOUTUBE_CLIENT_SECRET=${clientSecret}`)
    if (!updatedRedirectUri) lines.push(`YOUTUBE_REDIRECT_URI=${redirectUri}`)

    // Remove any empty lines at the end
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop()
    }
    lines.push('') // Ensure trailing newline

    await writeFile(envPath, lines.join('\n'), 'utf-8')

    return NextResponse.json({
      ok: true,
      message: 'YouTube credentials saved. Restart the dev server for changes to take effect, then click "Connect YouTube" to complete the OAuth flow.',
      redirectUri,
    })
  } catch (e: any) {
    console.error('Save credentials error:', e)
    return NextResponse.json({
      error: 'Failed to save credentials',
      message: e.message,
    }, { status: 500 })
  }
}
