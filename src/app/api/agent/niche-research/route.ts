import { NextResponse } from 'next/server'
import { getAllNicheAnalyses, researchNiches } from '@/engine/niche-research'

export async function GET() {
  try {
    const niches = await getAllNicheAnalyses()
    return NextResponse.json(niches)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Run niche research (async)
    researchNiches().catch(e => console.error('Niche research error:', e))
    return NextResponse.json({ ok: true, message: 'Niche research started...' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
