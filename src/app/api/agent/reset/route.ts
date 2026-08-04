import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const full = body.full !== false // default: full reset

    // Always reset agent state
    await db.agentState.upsert({ where: { key: 'agent_state' }, create: { key: 'agent_state', value: 'idle' }, update: { value: 'idle' } })
    await db.agentState.upsert({ where: { key: 'last_error' }, create: { key: 'last_error', value: '' }, update: { value: '' } })
    await db.agentState.upsert({ where: { key: 'current_job' }, create: { key: 'current_job', value: '' }, update: { value: '' } })
    await db.agentState.upsert({ where: { key: 'next_action' }, create: { key: 'next_action', value: '' }, update: { value: '' } })
    
    if (full) {
      // Clear partial data from failed runs
      await db.nicheAnalysis.deleteMany({})
      await db.agentState.deleteMany({ where: { key: 'selected_niche' } })
      await db.agentState.deleteMany({ where: { key: 'channel_strategy' } })
    }
    
    return NextResponse.json({ ok: true, message: full ? 'Full reset' : 'State reset (data preserved)' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
