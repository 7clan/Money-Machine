---
Task ID: 4-D
Agent: Project Bulk Ops Builder
Task: Add bulk operations for Video Projects (API + new VideoProjectExplorer component + page integration)

Work Log:
- Read `/home/z/my-project/worklog.md` (Tasks 1–10 + 5-D bulk ops for ideas) and the existing `/agent-ctx/5-D-bulk-operations-builder.md` worklog to align with the established bulk pattern.
- Read `src/components/agent/idea-explorer.tsx` (1885 LOC) end-to-end to mirror its bulk state shape, stale-ID pruner, selection toolbar (AnimatePresence height-slide), sticky BulkActionBar (framer-motion spring), and the `executeBulkAction` handler that POSTs to `/api/data/<entity>/bulk` then toasts + clears selection + exits select mode + invokes `onBulkAction`.
- Read `src/app/api/data/ideas/bulk/route.ts` to mirror validation flow (action enum + non-empty string array check + per-action payload validation + `db.$transaction` for delete cascade + AuditLog entry with `target='bulk_ideas'`).
- Read `prisma/schema.prisma` (VideoProject + PolicyReview + Upload + VideoIdea) to confirm:
    - VideoProject.{id, videoIdeaId, title, status, videoFilePath, thumbnailPath, captionPath, resolution, duration, fileSize, renderProgress, reviewResult, isApproved, editorNotes, policyReviews, upload, videoIdea, createdAt, updatedAt}
    - PolicyReview.{videoProjectId, onDelete: Cascade}
    - Upload.{videoProjectId @unique, onDelete: Cascade}
    - VideoIdea.{scheduledDate, videoProjects[]}
- Verified existing shadcn primitives: `checkbox.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `button.tsx`, `badge.tsx`, `progress.tsx`, `scroll-area.tsx`, `separator.tsx`, `skeleton.tsx`, `tooltip.tsx`, `input.tsx`, `select.tsx`. Confirmed `useToast()` from `@/components/agent/toast-provider` exposes `toast({type, title, description, duration})`.
- Verified `/api/agent/rerender/route.ts` does NOT yet exist (Task 4-B is in progress in parallel) — per spec, `re-render` action just marks `status: 'producing', renderProgress: 0` and lets the actual re-render be triggered separately.
- Read existing inline Video Projects list in `src/app/page.tsx` (lines ~1266–1325) — replaced the inline `<ScrollArea className="h-72">` + `motion.button` map with the new `<VideoProjectExplorer>` component, kept the surrounding `<GlassCard variant="gradient" glowFrom="from-emerald-500" glowTo="to-cyan-500" className="lg:col-span-1">` wrapper and the `<EmptyState>` / `<IdeaListSkeleton count={3} />` fallbacks for the empty/loading states. Updated CardDescription to "Click any project to preview video, script, scenes & review. Use Select mode for bulk actions." Added `import { VideoProjectExplorer } from '@/components/agent/video-project-explorer'`. Confirmed `setPreviewVideoId` state setter (page.tsx line 448) is in scope and used by `onPreview={(id) => setPreviewVideoId(id)}`.

Backend: Created `src/app/api/data/projects/bulk/route.ts` (~245 LOC, `force-dynamic`):
- Single POST handler accepting `{action, projectIds: string[], payload?: {status?: string}}`.
- Validates `action` against enum (`approve | delete | set-status | re-render | unschedule`) → 400 on invalid.
- Validates `projectIds` is a non-empty array of strings → 400 on invalid.
- Per action:
    - `approve`: `db.videoProject.updateMany({ where: { id: { in: ids } }, data: { status: 'approved', isApproved: true } })`
    - `set-status`: requires `payload.status` ∈ `{producing, approved, failed, uploaded, rejected}` → 400 on invalid; uses `updateMany`.
    - `re-render`: marks each project `status: 'producing', renderProgress: 0` via `updateMany` (no actual re-render fire — Task 4-B's helper not yet available).
    - `unschedule`: `db.videoIdea.updateMany({ where: { videoProjects: { some: { id: { in: ids } } } }, data: { scheduledDate: null } })`.
    - `delete`: runs in `db.$transaction`: deletes PolicyReview + Upload (grandchildren) then VideoProject rows. Returns `affected = deleteMany.count`.
- Writes AuditLog entry: `action: 'metadata_update', actor: 'user', target: 'bulk_projects', details: JSON.stringify({ message: 'Bulk ${action} on ${count} project(s)', detail, bulkAction, count, projectIds: first10, payload (omitted for delete) })`.
- Returns `{ ok: true, affected, action }`. 500 handler returns `{ error, message }`.

Frontend: Created `src/components/agent/video-project-explorer.tsx` (~810 LOC, `'use client'`):
- Public API: `{ projects: VideoProject[], onPreview?: (id: string) => void, onBulkAction?: () => void, className?: string }`.
- `VideoProject` interface is permissive (all fields optional except `id`) so it can consume `pipeline.projects` (`any[]`) directly.
- `coerceStatus()` helper maps any string to one of the 5 known statuses (producing/approved/failed/uploaded/rejected) so the UI never throws on legacy rows like `planning` or `reviewing`.
- Toolbar: search box (debounced 200ms, filters by title substring) + "Select" toggle button (Square/CheckSquare icon — emerald→cyan gradient when active).
- Filter row: status pills (All/Producing/Approved/Failed/Uploaded) with framer-motion `layoutId="vpx-status-pill-bg"` sliding gradient + Sort dropdown (5 options: updated_desc default, updated_asc, duration_desc, duration_asc, status) + active filter count Badge + Clear filters button.
- Result count "X of Y projects".
- Selection toolbar (AnimatePresence height-slide): "X selected" or "Selection mode — click cards to select" hint + "Select all (N)" + "Clear" buttons.
- BulkActionBar (sticky top-0, framer-motion spring entrance, violet border + glow): count badge + 4 action buttons:
    - **Approve** (emerald, CheckCircle icon) — fires `executeBulkAction('approve')` directly.
    - **Set Status** (amber, Tag icon) — DropdownMenu of 5 statuses with colored dots.
    - **Re-render** (violet, RefreshCcw icon) — opens AlertDialog (violet) for confirmation warning about resetting render progress; actual re-render performed by agent pipeline.
    - **Delete** (rose, Trash2 icon) — opens AlertDialog (rose) with explicit warning about cascading deletes of PolicyReview + Upload rows.
- Project cards (grid 1-col mobile / 2-col lg): each card shows thumbnail block (Film icon), title (truncate 60 chars + tooltip), status badge (color-coded per coerceStatus), resolution, duration (mm:ss or Ns), file size (KB/MB/GB), render progress bar (cyan→emerald gradient when producing), updated relative time, "Preview" hint for approved/uploaded/rejected. In select mode: Checkbox in top-right corner with `stopPropagation` wrapper, click anywhere on card toggles selection, Play icon hidden, violet `ring-2 ring-violet-500/50` + soft glow + `scale-[1.005]` elevation on selected.
- Stale-ID pruner: `useEffect` watches `projects` + `selectedIds` and removes IDs that no longer exist in the parent's projects list; auto-exits select mode if selection becomes empty.
- Empty state: friendly message "No projects yet" / "No projects match your filters" with Clear filters button.
- Loading skeleton: 4 staggered shimmer cards matching project card dimensions.
- Uses existing shadcn primitives only + `lucide-react` (RefreshCcw, Trash2, CheckCircle, Square, CheckSquare, Loader2, Film, Play, XCircle, ListChecks, Tag, Settings2, X, Search) + `framer-motion` (AnimatePresence, layout, motion.div).
- Dark theme: bg-slate-950 wrapper, cards bg-slate-900/60 border-slate-800/50 backdrop-blur-sm, violet/cyan/emerald/amber/rose palette — NO indigo, NO blue primary.

Verification:
- `bun run lint` → exit 0, zero errors (after the parallel Task 4-B agent finished saving video-preview-modal.tsx; during my browser test that file was briefly in a partially-saved state showing a transient parsing error — re-running lint after Task 4-B completed showed 0 errors).
- `bunx tsc --noEmit` → 0 errors in my new/modified files. Pre-existing errors remain only in: `examples/websocket/*` (missing socket.io modules), `skills/*`, `src/app/page.tsx` lines 534/540/549 (toast.dismiss/update misuse — pre-existing, documented in worklog Task 5-A as off-limits), `src/components/agent/export-button.tsx` (Task 5-B's pre-existing issue).
- curl tests all pass:
    - `POST -d '{"action":"invalid","projectIds":["x"]}'` → 400 `{"error":"Invalid action. Must be one of: approve, delete, set-status, re-render, unschedule"}`
    - `POST -d '{"action":"approve","projectIds":[]}'` → 400 `{"error":"projectIds must be a non-empty array of strings"}`
    - `POST -d '{"action":"approve","projectIds":["<real-id>"]}'` → 200 `{"ok":true,"affected":1,"action":"approve"}`
    - `POST -d '{"action":"set-status","projectIds":["<id>"],"payload":{"status":"bogus"}}'` → 400 `{"error":"payload.status must be one of: producing, approved, failed, uploaded, rejected"}`
    - `POST -d '{"action":"set-status","projectIds":["<id>"],"payload":{"status":"approved"}}'` → 200 with `affected:1`
    - `POST -d '{"action":"re-render","projectIds":["<id>"]}'` → 200 with `affected:1`
    - `POST -d '{"action":"unschedule","projectIds":["<id>"]}'` → 200 with `affected:1`
    - AuditLog entries created with `target='bulk_projects'`, `message="Bulk approve on 1 project"`, `detail` listing IDs + payload.
- agent-browser visual QA: navigated to `/`, clicked Pipeline tab, scrolled to Video Projects card, clicked the VPE "Select" toggle (second Select button — first is IdeaExplorer's), clicked the Jasper project checkbox. Verified via snapshot that:
    - VPE renders with title "Video Project Explorer", subtitle "Produce, approve & manage rendered videos", search input "Search projects by title…", Select toggle button, status filter pills (All/Producing/Approved/Failed/Uploaded), Sort dropdown (default "Updated (newest)"), "4 of 4 projects" count, 4 project cards (Jasper vs Copy.ai + 3 failed projects) each showing status badge + resolution + duration + file size + relative timestamp.
    - BulkActionBar appears with "1 selected" + 4 buttons: Approve (emerald, ref=e55), Set Status (amber dropdown, ref=e56), Re-render (violet, ref=e57), Delete (rose, ref=e58).
    - Clicked Approve button → project's `updatedAt` refreshed to "1s ago", confirming `onBulkAction` callback ran `pollAll()` to refresh pipeline data.
- VLM (z-ai vision CLI) analyzed screenshots and confirmed:
    - Video Project Explorer panel visible with proper title, subtitle, search bar, emerald Select button.
    - Sticky BulkActionBar with violet border, "1 selected" text, all 4 action buttons color-coded (Approve green, Set Status yellow, Re-render refresh icon, Delete red trash).
    - Project cards in 2-col grid; selected Jasper card has violet ring/glow.
    - Status filter pills visible with "All" active in teal/cyan.
    - Dark theme consistent throughout (deep navy/black backgrounds, no light/white areas, no blue/indigo primary colors).

Stage Summary:
- Files Created (2):
    - `/home/z/my-project/src/app/api/data/projects/bulk/route.ts` (~245 LOC) — bulk operations endpoint with action enum validation, projectIds validation, per-action payload validation, transactional delete cascade of PolicyReview + Upload, AuditLog entry, 500 handler.
    - `/home/z/my-project/src/components/agent/video-project-explorer.tsx` (~810 LOC) — standalone `'use client'` React component with multi-select mode, sticky BulkActionBar (4 actions: Approve/Set Status/Re-render/Delete), status filter pills, sort dropdown, debounced search, project cards with violet selection ring, stale-ID pruner, empty state, loading skeleton, framer-motion animations, mobile-responsive 1-col→2-col grid.
- Files Modified (1):
    - `/home/z/my-project/src/app/page.tsx` — added `import { VideoProjectExplorer } from '@/components/agent/video-project-explorer'`; replaced the inline Video Projects `<ScrollArea className="h-72">` + `motion.button` map (lines ~1276–1323) with `<VideoProjectExplorer projects={pipeline.projects} onPreview={(id) => setPreviewVideoId(id)} onBulkAction={() => { pollAll(); toast({type:'success', title:'Bulk action complete', description:'Pipeline refreshed', duration:2500}) }} />`; updated CardDescription to mention "Use Select mode for bulk actions."; kept EmptyState/IdeaListSkeleton fallbacks for empty/loading states.
- Lint: 0 errors. tsc: 0 errors in new/modified files. All curl tests pass (200/400 as appropriate). agent-browser visual QA confirms VPE renders correctly with Select toggle, search, status filter pills, project cards, sticky BulkActionBar, and bulk Approve action flows correctly through to parent refresh.
- All design constraints honored: dark theme only (bg-slate-950, cards bg-slate-900/60, borders bg-slate-800/50), violet/cyan/emerald/amber/rose palette (NO indigo, NO blue primary), only existing shadcn/ui components + lucide-react + framer-motion, `'use client'` directive, mobile responsive, accessible (aria-labels on checkboxes, semantic button elements, tooltip explanations).
