import { NextRequest, NextResponse } from 'next/server'
import { triggerRerender } from '@/engine/rerender'

// Always run dynamically — this route mutates the database.
export const dynamic = 'force-dynamic'

/**
 * POST /api/agent/rerender
 *
 * Body: { projectId: string, revisionNote?: string }
 *
 * Triggers a full re-render of an existing VideoProject:
 *   1. Generates a NEW Script version (calling writeScript with the
 *      revisionNote appended to the LLM prompt so the model addresses
 *      the failed-review issues).
 *   2. Resets the project to status='producing', renderProgress=0,
 *      with the revision note captured in editorNotes.
 *   3. Writes an AuditLog entry (actor='user').
 *   4. Fire-and-forget kicks off `renderVideo()` (non-blocking).
 *
 * Returns 200: { ok: true, projectId, newScriptId, message }
 * Returns 404 if the project doesn't exist.
 * Returns 500 on unexpected error.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any))
    const projectId: unknown = body?.projectId
    const revisionNote: unknown = body?.revisionNote

    if (typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json(
        { error: 'bad_request', message: 'projectId is required and must be a string' },
        { status: 400 }
      )
    }

    const note = typeof revisionNote === 'string' && revisionNote.trim()
      ? revisionNote.trim()
      : undefined

    const result = await triggerRerender(projectId.trim(), note, false)
    return NextResponse.json(result, { status: 200 })
  } catch (e: any) {
    console.error('[api.agent.rerender] error:', e)
    const message = e?.message || 'Unknown error'
    // 404 if the project lookup failed — keep the message terse.
    const status = /not found/i.test(message) ? 404 : 500
    return NextResponse.json(
      { error: status === 404 ? 'not_found' : 'internal_error', message },
      { status }
    )
  }
}
