# Task 4-B — Re-render Flow Builder

**Agent**: Re-render Flow Builder
**Task**: Add video re-render flow (API + auto-retry hook + UI buttons)

## What was built

A complete manual + automatic video re-render flow that lets the operator (or the agent itself, after a failed quality review) regenerate a script addressing the failed-review issues and re-render the video from scratch.

### Architecture

```
                                  ┌─────────────────────────────┐
                                  │ src/engine/rerender.ts      │
                                  │  triggerRerender()          │
                                  │  deriveRevisionNote()       │
                                  │  RETRY_MARKER               │
                                  └─────────────┬───────────────┘
                                                │ used by
              ┌─────────────────────────────────┼─────────────────────────────────┐
              ▼                                 ▼                                 ▼
   ┌──────────────────────┐      ┌──────────────────────────┐      ┌────────────────────────────┐
   │ API route (manual)   │      │ agent.ts auto-retry hook │      │ bulk /api/data/projects/bulk│
   │ POST /api/agent/     │      │ phase6_qualityReview()   │      │   action: 're-render'       │
   │   rerender           │      │  - 1st failure → retry   │      │  (was placeholder, now real)│
   └──────────┬───────────┘      │  - 2nd failure → leave  │      └────────────────────────────┘
              │                  │     as failed            │
              │                  └──────────────────────────┘
              │
   ┌──────────┴──────────────────────────────────────────────┐
   │ Frontend callers (both POST to /api/agent/rerender)      │
   │  - VideoProjectExplorer per-card "Re-render" button      │
   │  - VideoPreviewModal footer "Re-render" button           │
   └──────────────────────────────────────────────────────────┘
```

### Key design decisions

1. **`writeScript(videoIdeaId, revisionNote?)`** — added an optional 2nd parameter to the existing script-writer function. When present, the note is appended to the LLM user prompt as "REVISION INSTRUCTIONS — A previous version of this script was rejected during quality review. Address the following issues…". This avoids duplicating the entire script-writing logic in a separate `reviseScript()` function.

2. **`ScriptResult.id`** — added a new field to the `ScriptResult` interface so `triggerRerender` can patch the freshly-created Script row's `version` (Prisma `db.script.create` doesn't let you compute `version = max(existing) + 1` in a single atomic call without a follow-up `update`).

3. **`RETRY_MARKER = 'retry-attempt-1'`** — a sentinel string stored in `VideoProject.editorNotes`. The auto-retry hook checks for its presence:
   - Absent → first failure → call `triggerRerender(..., isAutoRetry=true)` which prefixes the marker into editorNotes.
   - Present → second failure → don't auto-retry, leave as `failed`.
   - This caps auto-retries at **1 per project** (max 2 total production attempts per idea).

4. **Fire-and-forget `renderVideo()`** — per task spec, only the actual render (FFmpeg pipeline) is non-blocking. The HTTP response waits for `writeScript()` to complete so it can return the `newScriptId`. This means the API takes ~30-90s (LLM call) but the response is meaningful.

5. **Status flow on re-render**:
   - `triggerRerender` sets `status='producing'`, `renderProgress=0` → API responds 200.
   - `renderVideo()` (async) immediately overwrites to `status='editing'` (10%) → `rendering` (40%/60%/70%) → `review` (100%).
   - The Re-render button checks `isFailed && !isRerendering && !selectMode` so it auto-hides once status flips to `producing`/`editing`/etc.

6. **Toast API usage** — used `const { toast, update: updateToast } = useToast()` instead of the (broken) `toast.update(...)` pattern that already exists in `page.tsx`. This avoids introducing new TypeScript errors.

7. **Bulk re-render wired up** — the previous Task 5-D agent left a placeholder in `/api/data/projects/bulk` action='re-render' that just set status='producing' without actually re-rendering, with a comment explicitly pointing at "Task 4-B's rerender helper". This task replaces that placeholder with a real `Promise.all` that calls `triggerRerender` for each selected project.

### Files

**Created (2):**
- `src/engine/rerender.ts` — shared helper module (~160 LOC).
- `src/app/api/agent/rerender/route.ts` — POST endpoint, force-dynamic.

**Modified (5):**
- `src/engine/script-writer.ts` — added `revisionNote` param + `id` to ScriptResult.
- `src/engine/agent.ts` — auto-retry hook in `phase6_qualityReview` (~50 LOC added).
- `src/components/agent/video-project-explorer.tsx` — per-card Re-render button + AlertDialog (~120 LOC added).
- `src/components/agent/video-preview-modal.tsx` — Re-render button in modal footer + AlertDialog (~80 LOC added).
- `src/app/api/data/projects/bulk/route.ts` — bulk re-render action now calls `triggerRerender` for real (~65 LOC changed).

### Verification (all green)

| Step | Result |
|---|---|
| `bun run lint` | ✅ 0 errors, 0 warnings |
| `bunx tsc --noEmit` (my files only) | ✅ 0 new errors |
| `curl -X POST /api/agent/rerender -d '{"projectId":"<real-id>"}'` | ✅ HTTP 200 `{ok:true, projectId, newScriptId, message:'Re-render started'}` |
| 404 case (non-existent project) | ✅ HTTP 404 `{error:'not_found', message:'VideoProject ... not found'}` |
| 400 case (missing projectId) | ✅ HTTP 400 `{error:'bad_request', message:'projectId is required and must be a string'}` |
| Project status transition after rerender | ✅ `failed` → `producing` → `editing` (40%) → `rendering` (70%) → `review` (100%) |
| AuditLog entry | ✅ `actor=user`, `action=metadata_update`, `target=<projectId>`, `message='Video re-render requested'` |
| agent-browser visual QA | ✅ Re-render button appears on `failed`/`rejected` projects, hidden on `approved`/`review`/`producing` |
| Click Re-render → confirm dialog | ✅ AlertDialog appears with title, description, Cancel + Confirm Re-render buttons |
| Confirm → toast → status change | ✅ Loading toast → success toast → project status changes to `editing` with climbing renderProgress |

### Screenshots

- `/home/z/my-project/download/qa-rerender-pipeline-tab.png` — Pipeline tab overview
- `/home/z/my-project/download/qa-rerender-button-visible.png` — Re-render button on a failed project card
- `/home/z/my-project/download/qa-rerender-confirm-dialog.png` — AlertDialog confirmation
- `/home/z/my-project/download/qa-rerender-toast-loading.png` — Loading toast "Starting re-render…"
- `/home/z/my-project/download/qa-rerender-toast-success.png` — After API completed (toast auto-dismissed after 3.5s)

### Notes for downstream agents

- The `triggerRerender` helper is the single source of truth for re-renders. Any future code path that needs to re-render a video (manual or automatic) should call it — don't reimplement the script-version-patching logic.
- The `RETRY_MARKER` sentinel is the contract for "this project has already been auto-retried". If you add new auto-retry triggers (e.g. for render errors, not just review failures), reuse the same marker so the cap stays at 1 per project.
- The bulk re-render endpoint reports `affected = projectIds.length` by contract (callers expect this). The per-project success/failure breakdown is in the audit log details under `reRenderSucceeded` / `reRenderFailed`.
- Manual re-renders (via the UI button or direct API call) do NOT set the `RETRY_MARKER` — so a manual re-render followed by a failed review will still trigger the auto-retry. This is intentional: manual re-renders are operator-initiated and shouldn't consume the auto-retry budget.
