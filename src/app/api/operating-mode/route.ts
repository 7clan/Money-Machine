/**
 * GET  /api/operating-mode — returns current mode + capabilities + all modes
 * POST /api/operating-mode { mode } — sets the mode (with audit log)
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  getOperatingMode,
  setOperatingMode,
  modeCapabilities,
  ALL_MODES,
  OperatingMode,
} from '@/engine/operating-mode'

export async function GET() {
  const mode = await getOperatingMode()
  return NextResponse.json({
    current: mode,
    default: 'PRIVATE_ONLY',
    allModes: ALL_MODES,
    capabilities: modeCapabilities(mode),
  })
}

export async function POST(request: NextRequest) {
  try {
    const { mode } = await request.json() as { mode: OperatingMode }
    if (!ALL_MODES.includes(mode)) {
      return NextResponse.json({ error: `invalid mode. Valid modes: ${ALL_MODES.join(', ')}` }, { status: 400 })
    }
    await setOperatingMode(mode)
    return NextResponse.json({
      ok: true,
      current: mode,
      capabilities: modeCapabilities(mode),
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
