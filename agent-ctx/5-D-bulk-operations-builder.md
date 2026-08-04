# Task 5-D — Bulk Operations Builder

## Mission
Add bulk operations (schedule / unschedule / delete / set-status / set-type / assign-pillar) to the existing `IdeaExplorer` component, backed by a new `/api/data/ideas/bulk` endpoint. Preserve all existing functionality (search, filter, sort, drawer).

## Files Touched

### New
- `src/app/api/data/ideas/bulk/route.ts` (277 LOC)

### Modified
- `src/components/agent/idea-explorer.tsx` (1198 → 1885 LOC, +687 LOC)

## API Contract

### `POST /api/data/ideas/bulk`
**Request body:**
```jsonc
{
  "action": "schedule" | "unschedule" | "delete" | "set-status" | "set-type" | "assign-pillar",
  "ideaIds": string[],   // non-empty
  "payload"?: {
    "date"?:      string (ISO),     // required for schedule
    "status"?:    IdeaStatus,       // required for set-status
    "type"?:      "short"|"longform", // required for set-type
    "pillarId"?:  string | null     // required for assign-pillar (null = unassign)
  }
}
```

**Response (200):**
```json
{ "ok": true, "affected": <count>, "action": "<action>" }
```

**Validation (400):**
- Invalid action enum
- `ideaIds` missing / empty / contains non-strings
- Per-action payload requirements (date / status / type / pillarId)

**Delete cascade (transactional):**
- PolicyReview (grandchild via VideoProject)
- Upload (grandchild via VideoProject)
- Scene (grandchild via Script)
- VoiceTrack (grandchild via Script)
- ResearchSource, ClaimLedger, Script, VideoProject (children of VideoIdea)
- VideoIdea itself

**AuditLog entry:** `target='bulk_ideas'`, `details` JSON includes `message`, `detail`, `bulkAction`, `count`, `ideaIds` (first 10), `payload` (omitted for delete).

## UI Behaviour

### Toolbar
- "Select" toggle button next to search input. When active, gradient violet→cyan.

### Selection mode
- Cards show a Checkbox in the top-right corner (violet when checked).
- ChevronDown indicator hidden in select mode.
- Clicking anywhere on a card toggles selection (instead of opening the drawer).
- Selected cards get violet `ring-2`, `border-violet-500/60`, soft violet glow, `scale-[1.005]`.

### Selection toolbar (AnimatePresence height-slide)
- "X selected" badge or "Selection mode — click cards to select" hint.
- "Select all (N)" — selects all `filteredIdeas` (not just visible).
- "Clear" — clears selection.

### Bulk action bar (sticky top, framer-motion spring)
Visible only when ≥1 idea selected. Six controls:
1. **Schedule** — Popover + CalendarPicker (defaults +7 days). Violet selected-day via `--primary` CSS var override. Apply button sends `payload.date` as ISO string.
2. **Unschedule** — AlertDialog (amber) for confirmation.
3. **Set Status** — DropdownMenu of 8 statuses with colored dots.
4. **Set Type** — DropdownMenu of short / longform.
5. **Assign Pillar** — DropdownMenu of existing pillars + "Unassign pillar" (null pillarId).
6. **Delete** — AlertDialog (rose) with explicit cascade warning.

All buttons show `Loader2 animate-spin` when in flight; all disabled while any action loads. After success: toast notification, clear selection, exit select mode, invoke `onBulkAction(action, count)`.

### Persistence
- Selection state survives filter changes (filters + selection are independent state).
- Tab switch / page refresh clears state naturally (component unmounts).
- Stale-ID pruner (`useEffect` on `ideas` + `selectedIds`) removes IDs that disappear from the parent's ideas list — handles parent-driven refresh after a bulk op.

## New Component Prop

```ts
interface IdeaExplorerProps {
  ideas: Idea[]
  onSelectIdea?: (ideaId: string) => void
  onBulkAction?: (action: string, count: number) => void  // ← new
  className?: string
}
```

The parent should pass `onBulkAction={() => refetchPipeline()}` if it wants the dashboard cards to refresh after a bulk op. The prop is optional — without it, the user will see stale cards until the next poll.

## Verification

- `bun run lint` → 0 errors.
- curl tests:
  - invalid action → 400
  - delete nonexistent → 200 with `affected:0`
  - empty/missing `ideaIds` → 400
  - invalid `payload.status` / missing `payload.date` → 400
  - real idea set-status / schedule / unschedule → 200 with `affected:1`, audit log entry created
- `/` page renders HTTP 200, no compile errors in dev.log.
- Existing audit-logs UI surfaces the new entries correctly (`message` + `detail` fields populated).

## Constraints Honored
- Dark theme only (bg-slate-950, cards bg-slate-900/60, borders bg-slate-800/50).
- Violet / cyan / emerald / amber / rose palette — NO indigo, NO blue primary.
- Only existing shadcn/ui components + lucide-react + framer-motion.
- `'use client'` directive preserved.
- Did NOT modify `src/app/page.tsx` (lead will integrate `onBulkAction` if desired).
- Did NOT modify Prisma schema or any existing API route.
- All existing IdeaExplorer functionality (search, debounced filter, type pills, status/pillar/sort dropdowns, detail drawer, score bars, tags, empty state, loading skeleton) preserved.
