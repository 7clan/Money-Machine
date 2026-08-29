/**
 * GET /api/artifacts/cleanup-check
 *
 * Returns whether it's safe to clean up the workspace's generated media.
 * If any approved final master has PERSISTED=false and UPLOAD_COMPLETE=false,
 * returns { safe: false, unsafeArtifacts: [...] }.
 */
import { NextResponse } from 'next/server'
import { cleanupSafetyCheck } from '@/engine/artifact-store'

export async function GET() {
  const check = cleanupSafetyCheck()
  return NextResponse.json(check)
}
