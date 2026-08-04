/**
 * Re-render Flow
 * --------------
 * Shared helper that:
 *   1. Looks up a VideoProject (with its VideoIdea + Scripts).
 *   2. Generates a NEW Script version that addresses a `revisionNote`
 *      (typically derived from a failed quality review).
 *   3. Resets the VideoProject to "producing" with renderProgress=0.
 *   4. Writes an AuditLog entry.
 *   5. Fire-and-forget triggers `renderVideo()` (the real export of
 *      video-renderer.ts — the task brief calls it "produceVideo()" but
 *      the actual exported name in this codebase is `renderVideo`).
 *
 * Used by:
 *   - The `/api/agent/rerender` POST route (manual re-render button).
 *   - The auto-retry hook inside `agent.ts` `phase6_qualityReview`
 *     (triggered automatically on the FIRST quality-review failure).
 */

import { db } from '@/lib/db'
import { writeScript } from './script-writer'
import { renderVideo } from './video-renderer'

export interface RerenderResult {
  ok: true
  projectId: string
  newScriptId: string
  message: string
}

/** Sentinel string stored in VideoProject.editorNotes to mark auto-retry attempts. */
export const RETRY_MARKER = 'retry-attempt-1'

/**
 * Derive a concise revision note from a list of failed-review issues.
 * Caps at ~800 chars so the LLM prompt stays manageable.
 */
export function deriveRevisionNote(issues: string[]): string {
  if (!issues.length) {
    return 'Previous quality review failed. Please rewrite the script with stronger originality and clearer factual accuracy.'
  }
  const bullet = issues.map((i) => `- ${i}`).join('\n')
  const note = `The previous version failed quality review with these issues:\n${bullet}\n\nPlease rewrite the script to address every issue above.`
  return note.length > 800 ? note.slice(0, 797) + '...' : note
}

/**
 * Trigger a re-render for a video project.
 *
 * @param projectId   The VideoProject id to re-render.
 * @param revisionNote Optional human/LLM-readable note describing what to fix.
 *                     If omitted, a generic "auto-retry after failed review"
 *                     note is used.
 * @param isAutoRetry  When true, the editorNotes is prefixed with the
 *                     `RETRY_MARKER` sentinel so subsequent failures can be
 *                     detected and auto-retry capped at 1 per project.
 */
export async function triggerRerender(
  projectId: string,
  revisionNote?: string,
  isAutoRetry = false
): Promise<RerenderResult> {
  const note = revisionNote?.trim() || 'Auto-retry: revised script based on failed quality review'

  // 1. Load project + idea + scripts
  const project = await db.videoProject.findUnique({
    where: { id: projectId },
    include: {
      videoIdea: {
        include: {
          scripts: { orderBy: { version: 'desc' } },
        },
      },
    },
  })

  if (!project) {
    throw new Error(`VideoProject ${projectId} not found`)
  }

  const ideaId = project.videoIdeaId

  // 2. Generate the revised script via writeScript (passes revisionNote into the LLM prompt).
  //    writeScript creates a brand-new Script row (default version=1). We then patch its
  //    version to (latestVersion + 1) so the version chain on this idea stays monotonic.
  const latestVersion = project.videoIdea.scripts.reduce(
    (max, s) => Math.max(max, s.version ?? 0),
    0
  )

  const result = await writeScript(ideaId, note)

  // 3. Patch version + reset review-sensitive fields so the next review re-evaluates cleanly.
  await db.script.update({
    where: { id: result.id },
    data: {
      version: latestVersion + 1,
      status: 'draft',
      originalityScore: 0,
      factCheckNotes: null,
    },
  })

  // 4. Update VideoProject: mark as producing, reset progress, store editor note.
  const editorNote = isAutoRetry
    ? `${RETRY_MARKER}: ${note}`.slice(0, 2000)
    : note.slice(0, 2000)

  await db.videoProject.update({
    where: { id: projectId },
    data: {
      status: 'producing',
      renderProgress: 0,
      editorNotes: editorNote,
      isApproved: false,
      reviewResult: null,
    },
  })

  // 5. AuditLog entry — actor "user" per task spec.
  await db.auditLog.create({
    data: {
      action: 'metadata_update',
      actor: 'user',
      target: projectId,
      details: JSON.stringify({
        message: 'Video re-render requested',
        detail: note,
        projectId,
        isAutoRetry,
        newScriptId: result.id,
        ts: Date.now(),
      }),
    },
  })

  // 6. Fire-and-forget the actual render. Don't block the HTTP response.
  //    The render will set status='editing' → 'rendering' → 'review' on its own.
  void renderVideo(projectId).catch((err) => {
    console.error('[rerender] renderVideo failed:', err)
    // Mark the project as failed so the user can see something went wrong.
    db.videoProject
      .update({
        where: { id: projectId },
        data: {
          status: 'failed',
          editorNotes: `Re-render failed: ${err?.message || String(err)}`.slice(0, 2000),
        },
      })
      .catch((e) => console.error('[rerender] failed to mark project as failed:', e))
  })

  return {
    ok: true,
    projectId,
    newScriptId: result.id,
    message: 'Re-render started',
  }
}
