import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Parse legacy (plain string) and new (JSON) detail payloads into a uniform shape */
function parseLog(log: any) {
  let message = ''
  let detail: string | null = null
  if (log.details) {
    try {
      const parsed = JSON.parse(log.details)
      if (parsed && typeof parsed === 'object' && 'message' in parsed) {
        message = parsed.message
        detail = parsed.detail ?? null
      } else {
        message = String(log.details)
      }
    } catch {
      message = String(log.details)
    }
  }
  return {
    id: log.id,
    action: log.action,
    actor: log.actor,
    target: log.target ?? null,
    message,
    detail,
    createdAt: log.createdAt,
  }
}

export async function GET() {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  return NextResponse.json(logs.map(parseLog))
}
