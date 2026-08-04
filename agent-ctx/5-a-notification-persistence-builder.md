---
Task ID: 5-A
Agent: Notification Persistence Builder
Task: Add persistent Notification backend (Prisma model + REST API + agent integration) and refactor NotificationCenter to fetch from API instead of localStorage.

Work Log:
- Read /home/z/my-project/worklog.md (Tasks 1–9 + 9-F). Confirmed: dashboard uses dark theme with violet/cyan/emerald/amber/rose palette; NotificationCenter at src/components/agent/notification-center.tsx previously used localStorage only; ToastProvider mounted in layout.tsx; Prisma schema had 20+ models but no Notification model.
- Inspected existing files: prisma/schema.prisma, src/lib/db.ts, src/engine/agent.ts (logAction helper), src/app/api/agent/command/route.ts (stop case), src/components/agent/notification-center.tsx (localStorage-backed), src/app/api/data/ideas/[id]/schedule/route.ts (route-handler pattern reference).
- Added `Notification` model to prisma/schema.prisma with all 13 fields from spec (id, type, category, title, description, targetId, targetType, isRead, isImportant, actionLabel, actionTab, createdAt, updatedAt) + 3 indexes (isRead, createdAt, category). Ran `bun run db:push` — schema synced, Prisma client regenerated.
- Created src/app/api/data/notifications/route.ts:
  - GET: parses ?filter=all|unread|important (default all) and ?limit=N (default 50, max 200). Returns { notifications: [...], counts: { total, unread, important } } via 4 parallel Prisma queries (findMany + 3 counts). Serializes dates and nullable fields uniformly.
  - POST: validates required title; coerces type into the 5-value enum (success/error/warning/info/agent_event) and category into the 5-value enum (agent/pipeline/revenue/system/youtube), defaulting unknown values to info/system. Truncates title to 280 chars and description to 1024 chars. Returns 201 with the created row.
- Created src/app/api/data/notifications/[id]/route.ts:
  - PATCH: accepts { isRead: boolean }, 404s on missing id, returns the updated row.
  - DELETE: 404s on missing id, returns { ok: true } on success.
- Created src/app/api/data/notifications/read-all/route.ts:
  - POST: updateMany where isRead=false → data isRead=true. Returns { ok: true, updated: count }.
- Updated src/engine/agent.ts:
  - Added a `notify()` helper that wraps `db.notification.create` in try/catch (failures are logged via console.error but never thrown, so notification persistence can't break the agent main flow).
  - Added `notify()` calls alongside existing `logAction()` calls for these important events:
    1. Niche selected (phase1) → success/pipeline, actionTab=strategy
    2. Channel strategy created (phase2) → success/pipeline, actionTab=strategy
    3. Video rendered (phase5) → success/pipeline, targetId=project.id, targetType=video_project, actionTab=pipeline
    4. Quality review PASSED (phase6) → success/pipeline, targetId=videoProjectId, actionTab=pipeline
    5. Quality review FAILED (phase6) → error/pipeline, isImportant=true, actionTab=pipeline
    6. YouTube not connected (phase7) → warning/youtube, isImportant=true, actionTab=settings
    7. Video uploaded (phase7) → success/youtube, targetId=videoProjectId, actionTab=pipeline
    8. Thumbnail upload failed (phase7) → warning/youtube, isImportant=true
- Updated src/app/api/agent/command/route.ts: the `stop` case now creates a Notification of type=error, category=agent, isImportant=true, actionTab=overview, with description "The autonomous agent has been halted. Resume from the dashboard when ready." Wrapped in try/catch so a notification failure doesn't break the stop command.
- Refactored src/components/agent/notification-center.tsx:
  - Replaced localStorage with /api/data/notifications fetching.
  - Added 15s polling via setInterval when uncontrolled (no `notifications` prop supplied).
  - Refreshes immediately when the popover opens (so the user always sees fresh data on click).
  - "Mark all" calls POST /api/data/notifications/read-all with optimistic state update.
  - Click on a notification calls PATCH /api/data/notifications/:id with { isRead: true } (optimistic) then navigates to `notif.target` (which is mapped from `actionTab`) via onNavigate, then closes the popover.
  - Added `agent_event` to NotificationType union with a Bolt icon (violet) — handles the new agent_event type returned by the API.
  - Added a small Loader2 spinner in the header that animates while fetching.
  - Preserved all existing visual design: dark theme (bg-slate-900/95, border-slate-800/60), bell button, animated unread badge (rose, spring animation), filter tabs (All/Unread/Important), staggered list, per-type icons, Important amber pill, relative timestamps via date-fns, empty states, "View all activity" footer.
  - Preserved backward compat: the optional `notifications` prop still works for controlled mode (skips API + polling).
- Updated src/lib/db.ts to defensively invalidate the cached PrismaClient singleton in dev mode when the schema changes. Added:
  - A `SCHEMA_VERSION` constant (currently 2) bumped after each `prisma db push` that adds new models.
  - A `bustPrismaRequireCache()` helper that deletes all `node_modules/.prisma/client` and `node_modules/@prisma/client` entries from Bun's `require.cache` so the next `new PrismaClient()` uses the freshly generated class with the new model delegates.
  - An `isStale` check (schema version mismatch OR missing `.notification` delegate) that triggers cache busting + fresh client creation.
  - Without this fix, the running dev server kept using the OLD PrismaClient cached in globalThis from before `db:push`, which caused `db.notification` to be undefined and the GET /api/data/notifications endpoint to throw "Cannot read properties of undefined (reading 'findMany')".
- Restarted the dev server (it had died) via `(bun run dev > dev.log 2>&1 &)` so the freshly generated PrismaClient would be loaded.

Verification:
- `bun run lint` → exit 0, zero errors/warnings (after adding eslint-disable-next-line for the intentional `require('@prisma/client')` dynamic import in lib/db.ts).
- `bunx tsc --noEmit` → zero errors in any of the new/modified files (src/lib/db.ts, src/engine/agent.ts, src/app/api/agent/command/route.ts, src/app/api/data/notifications/route.ts, src/app/api/data/notifications/[id]/route.ts, src/app/api/data/notifications/read-all/route.ts, src/components/agent/notification-center.tsx). Only pre-existing errors remain in examples/websocket/*, skills/*, and src/app/page.tsx (toast.dismiss/update misuse — pre-existing, and page.tsx is off-limits per the constraint).
- `curl -s http://localhost:3000/api/data/notifications` → returns `{"notifications":[],"counts":{"total":0,"unread":0,"important":0}}` (clean JSON, 200 OK).
- Tested full CRUD via curl: POST creates a notification (201), GET returns it with correct counts, PATCH marks as read, POST /read-all returns 0 updated (already read), DELETE removes it, GET returns empty list again.
- Tested agent command integration: POST /api/agent/command {command: 'stop'} → returns {ok: true} AND creates an important error notification with title "Emergency stop activated" and actionTab=overview (verified via subsequent GET). Cleaned up the test notification afterward so the DB starts empty for the lead.

Stage Summary:
- Files CREATED (5):
  - src/app/api/data/notifications/route.ts (GET + POST, ~190 LOC)
  - src/app/api/data/notifications/[id]/route.ts (PATCH + DELETE, ~120 LOC)
  - src/app/api/data/notifications/read-all/route.ts (POST, ~25 LOC)
- Files MODIFIED (4):
  - prisma/schema.prisma — added Notification model with 13 fields + 3 indexes
  - src/engine/agent.ts — added `notify()` helper (try/catch wrapped) + 8 notify() calls alongside logAction() calls for important events (niche selected, strategy created, video produced, video approved, video failed review, YouTube not connected, video uploaded, thumbnail upload failed)
  - src/app/api/agent/command/route.ts — `stop` case now persists an important error notification
  - src/components/agent/notification-center.tsx — replaced localStorage with /api/data/notifications fetching + 15s polling + open-triggered refresh + PATCH-on-click + POST-read-all-on-mark-all; added agent_event type; preserved all existing visual design and onNavigate prop; kept controlled mode for backward compat
  - src/lib/db.ts — added SCHEMA_VERSION cache-invalidation logic + bustPrismaRequireCache() helper (dev mode only) to handle Prisma client regeneration without restarting the dev server
- API surface for the lead / future tasks:
  - GET    /api/data/notifications?filter=all|unread|important&limit=50 → { notifications: [...], counts: { total, unread, important } }
  - POST   /api/data/notifications            body: { type, category, title, description?, targetId?, targetType?, isImportant?, actionLabel?, actionTab? } → 201 { ok, notification }
  - PATCH  /api/data/notifications/:id        body: { isRead: boolean } → { ok, notification }
  - DELETE /api/data/notifications/:id        → { ok: true }
  - POST   /api/data/notifications/read-all   → { ok: true, updated: count }
- NotificationCenter is now a drop-in replacement for the previous localStorage version — same props (onNavigate, className, optional `notifications` for controlled mode), same visual design, but now persisted in SQLite via the Prisma `Notification` model.
