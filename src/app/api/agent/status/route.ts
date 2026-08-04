import { NextRequest, NextResponse } from 'next/server'
import { getAgentStatus } from '@/engine/agent'

export async function GET() {
  try {
    const status = await getAgentStatus()
    return NextResponse.json(status)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
