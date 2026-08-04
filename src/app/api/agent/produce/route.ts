import { NextRequest, NextResponse } from 'next/server'
import { produceNextVideo } from '@/engine/agent'

export async function POST() {
  try {
    produceNextVideo().catch(e => console.error('Produce error:', e))
    return NextResponse.json({ ok: true, message: 'Video production started...' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
