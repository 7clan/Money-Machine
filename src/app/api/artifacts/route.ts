/**
 * GET /api/artifacts — returns the full artifact manifest
 * GET /api/artifacts?productionId=X — returns artifacts for a production
 */
import { NextRequest, NextResponse } from 'next/server'
import { getManifest, getArtifactsForProduction } from '@/engine/artifact-store'

export async function GET(request: NextRequest) {
  const productionId = request.nextUrl.searchParams.get('productionId')
  if (productionId) {
    return NextResponse.json({ productionId, artifacts: getArtifactsForProduction(productionId) })
  }
  return NextResponse.json(getManifest())
}
