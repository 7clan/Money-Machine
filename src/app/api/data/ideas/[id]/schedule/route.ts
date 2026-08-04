import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** POST /api/data/ideas/:id/schedule — set scheduledDate on a VideoIdea */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : null

    if (!id) {
      return NextResponse.json({ error: 'Missing idea id' }, { status: 400 })
    }

    const updated = await db.videoIdea.update({
      where: { id },
      data: { scheduledDate },
    })

    // Log to audit trail
    await db.auditLog.create({
      data: {
        action: 'metadata_update',
        actor: 'user',
        target: id,
        details: JSON.stringify({
          message: `Idea scheduled for ${scheduledDate ? scheduledDate.toISOString().slice(0, 10) : 'no date'}`,
          detail: `Time: ${body.scheduledTime || 'unspecified'}`,
          target: id,
        }),
      },
    })

    return NextResponse.json({ ok: true, idea: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}

/** DELETE /api/data/ideas/:id/schedule — clear scheduledDate */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing idea id' }, { status: 400 })
    }

    const updated = await db.videoIdea.update({
      where: { id },
      data: { scheduledDate: null },
    })

    await db.auditLog.create({
      data: {
        action: 'metadata_update',
        actor: 'user',
        target: id,
        details: JSON.stringify({
          message: 'Idea unscheduled',
          detail: 'Cleared scheduledDate',
          target: id,
        }),
      },
    })

    return NextResponse.json({ ok: true, idea: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}
