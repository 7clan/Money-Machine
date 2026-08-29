/**
 * POST /api/publish-gate
 *
 * Runs all 7 hard publishing gates against a production and returns the report.
 * Does NOT publish — only verifies. The orchestrator must call this before
 * invoking PublishingAgent and abort if overall != PASS.
 *
 * Body: PublishGateInput (factCheckReport, qcReport, narrationSumSec,
 *       timelineTotalSec, finalVideoPath, creativeLock, privacyMode)
 */
import { NextRequest, NextResponse } from 'next/server'
import { runPublishGates, PublishGateInput } from '@/engine/publishing-safety-gate'

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as PublishGateInput
    const report = await runPublishGates(input)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json({
      overall: 'FAIL',
      gates: [],
      blockingGates: ['INVALID_INPUT'],
      timestamp: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    }, { status: 500 })
  }
}
