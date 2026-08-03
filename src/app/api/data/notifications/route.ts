import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  'success',
  'error',
  'warning',
  'info',
  'agent_event',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_CATEGORIES = [
  'agent',
  'pipeline',
  'revenue',
  'system',
  'youtube',
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export interface NotificationPayload {
  type: NotificationType
  category: NotificationCategory
  title: string
  description?: string | null
  targetId?: string | null
  targetType?: string | null
  isImportant?: boolean
  actionLabel?: string | null
  actionTab?: string | null
}

interface CreateBody {
  type?: string
  category?: string
  title?: string
  description?: string | null
  targetId?: string | null
  targetType?: string | null
  isImportant?: boolean
  actionLabel?: string | null
  actionTab?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function coerceType(v: unknown): NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(v as string)
    ? (v as NotificationType)
    : 'info'
}

function coerceCategory(v: unknown): NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(v as string)
    ? (v as NotificationCategory)
    : 'system'
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

// ─── GET /api/data/notifications ──────────────────────────────────
//   Query params:
//     ?filter=all|unread|important  (default: all)
//     ?limit=50                      (default: 50, max: 200)
//
//   Returns:
//     { notifications: [...], counts: { total, unread, important } }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filterParam = searchParams.get('filter') || 'all'
    const filter: 'all' | 'unread' | 'important' =
      filterParam === 'unread' || filterParam === 'important' ? filterParam : 'all'

    const rawLimit = Number.parseInt(searchParams.get('limit') || '50', 10)
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50

    const where =
      filter === 'unread'
        ? { isRead: false }
        : filter === 'important'
          ? { isImportant: true }
          : {}

    const [rows, total, unread, important] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.notification.count(),
      db.notification.count({ where: { isRead: false } }),
      db.notification.count({ where: { isImportant: true } }),
    ])

    return NextResponse.json({
      notifications: rows.map(serialize),
      counts: { total, unread, important },
    })
  } catch (err: any) {
    console.error('[notifications GET] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// ─── POST /api/data/notifications ─────────────────────────────────
//   Create a new notification. Used internally by the agent engine
//   and by command endpoints (e.g. emergency stop).
//
//   Body (CreateBody):
//     type, category, title, description?, targetId?, targetType?,
//     isImportant?, actionLabel?, actionTab?

export async function POST(req: NextRequest) {
  try {
    const body: CreateBody = await req.json().catch(() => ({}))

    if (!isString(body.title)) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const data = {
      type: coerceType(body.type),
      category: coerceCategory(body.category),
      title: body.title.slice(0, 280),
      description: isString(body.description) ? body.description.slice(0, 1024) : null,
      targetId: isString(body.targetId) ? body.targetId : null,
      targetType: isString(body.targetType) ? body.targetType : null,
      isImportant: body.isImportant === true,
      actionLabel: isString(body.actionLabel) ? body.actionLabel.slice(0, 60) : null,
      actionTab: isString(body.actionTab) ? body.actionTab : null,
    }

    const created = await db.notification.create({ data })
    return NextResponse.json({ ok: true, notification: serialize(created) }, { status: 201 })
  } catch (err: any) {
    console.error('[notifications POST] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
