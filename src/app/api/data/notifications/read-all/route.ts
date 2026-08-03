import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── POST /api/data/notifications/read-all ────────────────────────
//   Mark every notification as read. Returns the count of rows updated.

export async function POST() {
  try {
    const result = await db.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    })

    return NextResponse.json({ ok: true, updated: result.count })
  } catch (err: any) {
    console.error('[notifications read-all POST] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
