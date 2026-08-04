import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface PatchBody {
  isRead?: boolean
}

function serialize(n: {
  id: string
  type: string
  category: string
  title: string
  description: string | null
  targetId: string | null
  targetType: string | null
  isRead: boolean
  isImportant: boolean
  actionLabel: string | null
  actionTab: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: n.id,
    type: n.type,
    category: n.category,
    title: n.title,
    description: n.description ?? null,
    targetId: n.targetId ?? null,
    targetType: n.targetType ?? null,
    isRead: n.isRead,
    isImportant: n.isImportant,
    actionLabel: n.actionLabel ?? null,
    actionTab: n.actionTab ?? null,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }
}

// ─── PATCH /api/data/notifications/:id ────────────────────────────
//   Body: { isRead: boolean }
//   Mark a single notification as read or unread.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing notification id' }, { status: 400 })
    }

    const body: PatchBody = await req.json().catch(() => ({}))
    if (typeof body.isRead !== 'boolean') {
      return NextResponse.json(
        { error: 'Body must include { isRead: boolean }' },
        { status: 400 }
      )
    }

    const existing = await db.notification.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: body.isRead },
    })

    return NextResponse.json({ ok: true, notification: serialize(updated) })
  } catch (err: any) {
    console.error('[notifications PATCH] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/data/notifications/:id ───────────────────────────
//   Permanently delete a single notification.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing notification id' }, { status: 400 })
    }

    const existing = await db.notification.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    await db.notification.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[notifications DELETE] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
