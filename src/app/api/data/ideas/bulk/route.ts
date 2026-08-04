import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────

type BulkAction =
  | 'schedule'
  | 'unschedule'
  | 'delete'
  | 'set-status'
  | 'set-type'
  | 'assign-pillar'

const VALID_ACTIONS: BulkAction[] = [
  'schedule',
  'unschedule',
  'delete',
  'set-status',
  'set-type',
  'assign-pillar',
]

const VALID_STATUSES = [
  'idea',
  'researched',
  'scripted',
  'producing',
  'reviewing',
  'approved',
  'uploaded',
  'failed',
]

const VALID_TYPES = ['short', 'longform']

interface BulkRequestBody {
  action?: unknown
  ideaIds?: unknown
  payload?: unknown
}

interface BulkPayload {
  date?: unknown
  status?: unknown
  type?: unknown
  pillarId?: unknown
}

// ─── Handler ─────────────────────────────────────────────────────────

/**
 * POST /api/data/ideas/bulk
 *
 * Body:
 *   { action: 'schedule'|'unschedule'|'delete'|'set-status'|'set-type'|'assign-pillar',
 *     ideaIds: string[],
 *     payload?: { date?, status?, type?, pillarId? } }
 *
 * Returns:
 *   { ok: true, affected: <count>, action: <action> }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as BulkRequestBody
    const { action, ideaIds, payload } = body
    const payloadObj = (payload ?? {}) as BulkPayload

    // ─── Validate action ────────────────────────────────────────────
    if (
      typeof action !== 'string' ||
      !VALID_ACTIONS.includes(action as BulkAction)
    ) {
      return NextResponse.json(
        {
          error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
        },
        { status: 400 },
      )
    }

    // ─── Validate ideaIds ───────────────────────────────────────────
    if (
      !Array.isArray(ideaIds) ||
      ideaIds.length === 0 ||
      !ideaIds.every((id) => typeof id === 'string')
    ) {
      return NextResponse.json(
        { error: 'ideaIds must be a non-empty array of strings' },
        { status: 400 },
      )
    }

    const ids: string[] = ideaIds
    const bulkAction = action as BulkAction
    let affected = 0

    switch (bulkAction) {
      case 'schedule': {
        if (typeof payloadObj.date !== 'string' || !payloadObj.date) {
          return NextResponse.json(
            { error: 'payload.date (ISO string) is required for schedule' },
            { status: 400 },
          )
        }
        const scheduledDate = new Date(payloadObj.date)
        if (Number.isNaN(scheduledDate.getTime())) {
          return NextResponse.json(
            { error: 'payload.date is not a valid date' },
            { status: 400 },
          )
        }
        const res = await db.videoIdea.updateMany({
          where: { id: { in: ids } },
          data: { scheduledDate },
        })
        affected = res.count
        break
      }

      case 'unschedule': {
        const res = await db.videoIdea.updateMany({
          where: { id: { in: ids } },
          data: { scheduledDate: null },
        })
        affected = res.count
        break
      }

      case 'set-status': {
        if (
          typeof payloadObj.status !== 'string' ||
          !VALID_STATUSES.includes(payloadObj.status)
        ) {
          return NextResponse.json(
            {
              error: `payload.status must be one of: ${VALID_STATUSES.join(', ')}`,
            },
            { status: 400 },
          )
        }
        const res = await db.videoIdea.updateMany({
          where: { id: { in: ids } },
          data: { status: payloadObj.status },
        })
        affected = res.count
        break
      }

      case 'set-type': {
        if (
          typeof payloadObj.type !== 'string' ||
          !VALID_TYPES.includes(payloadObj.type)
        ) {
          return NextResponse.json(
            { error: `payload.type must be one of: ${VALID_TYPES.join(', ')}` },
            { status: 400 },
          )
        }
        const res = await db.videoIdea.updateMany({
          where: { id: { in: ids } },
          data: { type: payloadObj.type },
        })
        affected = res.count
        break
      }

      case 'assign-pillar': {
        // pillarId may be null (to unassign) or a string.
        const rawPillar = payloadObj.pillarId
        if (rawPillar !== null && typeof rawPillar !== 'string') {
          return NextResponse.json(
            { error: 'payload.pillarId must be a string or null' },
            { status: 400 },
          )
        }
        const pillarId = rawPillar === '' ? null : rawPillar
        const res = await db.videoIdea.updateMany({
          where: { id: { in: ids } },
          data: { pillarId },
        })
        affected = res.count
        break
      }

      case 'delete': {
        // Schema already specifies `onDelete: Cascade` on every child
        // relation of VideoIdea, so a single `deleteMany` would suffice.
        // We still delete the descendants explicitly inside a transaction
        // for defence-in-depth and to keep the audit trail atomic.
        affected = await db.$transaction(async (tx) => {
          const scripts = await tx.script.findMany({
            where: { videoIdeaId: { in: ids } },
            select: { id: true },
          })
          const scriptIds = scripts.map((s) => s.id)

          const projects = await tx.videoProject.findMany({
            where: { videoIdeaId: { in: ids } },
            select: { id: true },
          })
          const projectIds = projects.map((p) => p.id)

          // Grandchildren of VideoProject
          if (projectIds.length > 0) {
            await tx.policyReview.deleteMany({
              where: { videoProjectId: { in: projectIds } },
            })
            await tx.upload.deleteMany({
              where: { videoProjectId: { in: projectIds } },
            })
          }

          // Grandchildren of Script
          if (scriptIds.length > 0) {
            await tx.scene.deleteMany({
              where: { scriptId: { in: scriptIds } },
            })
            await tx.voiceTrack.deleteMany({
              where: { scriptId: { in: scriptIds } },
            })
          }

          // Direct children of VideoIdea
          await tx.researchSource.deleteMany({
            where: { videoIdeaId: { in: ids } },
          })
          await tx.claimLedger.deleteMany({
            where: { videoIdeaId: { in: ids } },
          })
          await tx.script.deleteMany({
            where: { videoIdeaId: { in: ids } },
          })
          await tx.videoProject.deleteMany({
            where: { videoIdeaId: { in: ids } },
          })

          // Finally delete the ideas themselves
          const res = await tx.videoIdea.deleteMany({
            where: { id: { in: ids } },
          })
          return res.count
        })
        break
      }
    }

    // ─── Audit log ──────────────────────────────────────────────────
    // Format follows the existing pattern: a `message` (short human
    // description) + `detail` (longer context) so the audit-logs UI can
    // surface them without parsing arbitrary JSON. We still keep the
    // raw fields (`bulkAction`, `count`, `ideaIds`, `payload`) for
    // programmatic consumers.
    const auditMessage = `Bulk ${bulkAction} on ${affected} idea${affected === 1 ? '' : 's'}`
    const auditDetail = `${ids.length} id${ids.length === 1 ? '' : 's'} submitted; first 10: ${ids.slice(0, 10).join(', ')}${payload && bulkAction !== 'delete' ? `; payload: ${JSON.stringify(payloadObj)}` : ''}`
    await db.auditLog.create({
      data: {
        action: 'metadata_update',
        actor: 'user',
        target: 'bulk_ideas',
        details: JSON.stringify({
          message: auditMessage,
          detail: auditDetail,
          bulkAction,
          count: affected,
          ideaIds: ids.slice(0, 10),
          payload: bulkAction === 'delete' ? undefined : payloadObj,
        }),
      },
    })

    return NextResponse.json({ ok: true, affected, action: bulkAction })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error during bulk operation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
