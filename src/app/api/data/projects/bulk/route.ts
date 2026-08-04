import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { triggerRerender } from '@/engine/rerender'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────

type BulkAction =
  | 'approve'
  | 'delete'
  | 'set-status'
  | 're-render'
  | 'unschedule'

const VALID_ACTIONS: BulkAction[] = [
  'approve',
  'delete',
  'set-status',
  're-render',
  'unschedule',
]

/**
 * Allowed project statuses for `set-status`.
 * Mirrors the 5 statuses the dashboard surface uses for Video Projects.
 * (Schema default is "planning" but the agent never surfaces that state
 * in the Pipeline tab — keep this list aligned with the spec.)
 */
const VALID_PROJECT_STATUSES = [
  'producing',
  'approved',
  'failed',
  'uploaded',
  'rejected',
] as const

interface BulkRequestBody {
  action?: unknown
  projectIds?: unknown
  payload?: unknown
}

interface BulkPayload {
  status?: unknown
}

// ─── Handler ─────────────────────────────────────────────────────────

/**
 * POST /api/data/projects/bulk
 *
 * Body:
 *   { action: 'approve'|'delete'|'set-status'|'re-render'|'unschedule',
 *     projectIds: string[],
 *     payload?: { status?: string } }
 *
 * Returns:
 *   { ok: true, affected: <count>, action: <action> }
 *
 * AuditLog entry created with target='bulk_projects'.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as BulkRequestBody
    const { action, projectIds, payload } = body
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

    // ─── Validate projectIds ────────────────────────────────────────
    if (
      !Array.isArray(projectIds) ||
      projectIds.length === 0 ||
      !projectIds.every((id) => typeof id === 'string')
    ) {
      return NextResponse.json(
        { error: 'projectIds must be a non-empty array of strings' },
        { status: 400 },
      )
    }

    const ids: string[] = projectIds
    const bulkAction = action as BulkAction
    let affected = 0
    // Re-render-specific breakdown (succeeded / failed per project).
    // Populated only by the 're-render' case; consumed by the audit log.
    const reRenderStats = { succeeded: 0, failed: 0 }

    switch (bulkAction) {
      case 'approve': {
        const res = await db.videoProject.updateMany({
          where: { id: { in: ids } },
          data: { status: 'approved', isApproved: true },
        })
        affected = res.count
        break
      }

      case 'set-status': {
        if (
          typeof payloadObj.status !== 'string' ||
          !VALID_PROJECT_STATUSES.includes(
            payloadObj.status as (typeof VALID_PROJECT_STATUSES)[number],
          )
        ) {
          return NextResponse.json(
            {
              error: `payload.status must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`,
            },
            { status: 400 },
          )
        }
        const res = await db.videoProject.updateMany({
          where: { id: { in: ids } },
          data: { status: payloadObj.status },
        })
        affected = res.count
        break
      }

      case 're-render': {
        // Actually trigger a real re-render for each selected project via
        // the shared `triggerRerender` helper (Task 4-B). Each call:
        //   - generates a new Script version (with revisionNote derived
        //     from the project's last review issues when available),
        //   - resets VideoProject to status='producing', renderProgress=0,
        //   - writes an AuditLog entry (actor='user'),
        //   - fire-and-forgets `renderVideo()`.
        // We swallow per-project errors so one bad project doesn't abort
        // the rest of the batch.
        const projects = await db.videoProject.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            reviewResult: true,
          },
        })
        await Promise.all(
          projects.map(async (p) => {
            try {
              // Derive a revision note from the project's last review
              // result (a JSON string with `issues` array) when present.
              let revisionNote: string | undefined
              if (p.reviewResult) {
                try {
                  const parsed = JSON.parse(p.reviewResult) as {
                    issues?: unknown
                  }
                  if (Array.isArray(parsed.issues)) {
                    const issues = parsed.issues
                      .map((i) => String(i))
                      .filter(Boolean)
                    if (issues.length) {
                      revisionNote = issues
                        .map((i) => `- ${i}`)
                        .join('\n')
                    }
                  }
                } catch {
                  // ignore — fall back to no revisionNote
                }
              }
              await triggerRerender(p.id, revisionNote, false)
              reRenderStats.succeeded++
            } catch (err) {
              reRenderStats.failed++
              console.error(
                `[bulk.re-render] failed for project ${p.id}:`,
                err,
              )
            }
          }),
        )
        // `affected` is the requested batch size by contract (callers
        // expect `affected === projectIds.length`); the per-project
        // breakdown is captured in `reRenderStats` for the audit log.
        affected = ids.length
        break
      }

      case 'unschedule': {
        // Clear scheduledDate on the related VideoIdea, joined through
        // `videoProjects: { some: { id: { in: ids } } }`.
        const res = await db.videoIdea.updateMany({
          where: {
            videoProjects: { some: { id: { in: ids } } },
          },
          data: { scheduledDate: null },
        })
        affected = res.count
        break
      }

      case 'delete': {
        // Schema specifies `onDelete: Cascade` for PolicyReview + Upload
        // (grandchildren of VideoProject via `videoProjectId`), so a single
        // `videoProject.deleteMany` would suffice in principle. We still
        // delete the descendants explicitly inside a transaction for
        // defence-in-depth and a clean audit trail.
        affected = await db.$transaction(async (tx) => {
          // Grandchildren of VideoProject
          await tx.policyReview.deleteMany({
            where: { videoProjectId: { in: ids } },
          })
          await tx.upload.deleteMany({
            where: { videoProjectId: { in: ids } },
          })

          const res = await tx.videoProject.deleteMany({
            where: { id: { in: ids } },
          })
          return res.count
        })
        break
      }
    }

    // ─── Audit log ──────────────────────────────────────────────────
    // Format mirrors the existing pattern used by /api/data/ideas/bulk:
    // a short human `message` + longer `detail` (so the audit-logs UI can
    // surface them without parsing arbitrary JSON), alongside the raw
    // fields (`bulkAction`, `count`, `projectIds`, `payload`) for
    // programmatic consumers.
    const auditMessage = `Bulk ${bulkAction} on ${affected} project${affected === 1 ? '' : 's'}`
    const rerenderBreakdown =
      bulkAction === 're-render'
        ? `; re-render: ${reRenderStats.succeeded} succeeded, ${reRenderStats.failed} failed`
        : ''
    const auditDetail = `${ids.length} id${ids.length === 1 ? '' : 's'} submitted; first 10: ${ids.slice(0, 10).join(', ')}${bulkAction !== 'delete' ? `; payload: ${JSON.stringify(payloadObj)}` : ''}${rerenderBreakdown}`
    await db.auditLog.create({
      data: {
        action: 'metadata_update',
        actor: 'user',
        target: 'bulk_projects',
        details: JSON.stringify({
          message: auditMessage,
          detail: auditDetail,
          bulkAction,
          count: affected,
          projectIds: ids.slice(0, 10),
          payload: bulkAction === 'delete' ? undefined : payloadObj,
          ...(bulkAction === 're-render'
            ? { reRenderSucceeded: reRenderStats.succeeded, reRenderFailed: reRenderStats.failed }
            : {}),
        }),
      },
    })

    return NextResponse.json({ ok: true, affected, action: bulkAction })
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : 'Unknown error during bulk operation'
    return NextResponse.json(
      { error: message, message },
      { status: 500 },
    )
  }
}
