'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  X,
  CheckSquare,
  Square,
  Trash2,
  RefreshCcw,
  CheckCircle,
  Loader2,
  Film,
  Play,
  XCircle,
  ListChecks,
  Tag,
  Settings2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/agent/toast-provider'

// ─── Types ───────────────────────────────────────────────────────────

export type VideoProjectStatus =
  | 'producing'
  | 'approved'
  | 'failed'
  | 'uploaded'
  | 'rejected'

// The pipeline endpoint serialises Prisma `VideoProject` rows with `any`
// typing on the dashboard side — accept a permissive shape so the
// component can consume `pipeline.projects` directly without bespoke
// mapping at every call site.
export interface VideoProject {
  id: string
  videoIdeaId?: string
  title?: string
  status?: string
  videoFilePath?: string | null
  thumbnailPath?: string | null
  resolution?: string | null
  duration?: number | null
  fileSize?: number | null
  renderProgress?: number | null
  isApproved?: boolean | null
  reviewResult?: string | null
  editorNotes?: string | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

interface VideoProjectExplorerProps {
  projects: VideoProject[]
  onPreview?: (id: string) => void
  /** Notified after a bulk action completes so the parent can refresh. */
  onBulkAction?: () => void
  className?: string
}

type SortKey = 'updated_desc' | 'updated_asc' | 'duration_desc' | 'duration_asc' | 'status'

// ─── Status Config ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  VideoProjectStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  producing: {
    label: 'Producing',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    dotClass: 'bg-cyan-400',
  },
  approved: {
    label: 'Approved',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-400',
  },
  uploaded: {
    label: 'Uploaded',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    dotClass: 'bg-violet-400',
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
}

// Map any unknown string status into one of our 5 known buckets so the
// UI never throws on legacy rows (e.g. status='planning' or 'reviewing').
function coerceStatus(raw?: string | null): VideoProjectStatus {
  if (!raw) return 'producing'
  if (raw in STATUS_CONFIG) return raw as VideoProjectStatus
  // Reasonable fallbacks for legacy / pipeline-internal statuses.
  if (raw === 'planning' || raw === 'storyboarding' || raw === 'rendering' || raw === 'review' || raw === 'reviewing' || raw === 'editing' || raw === 'recording' || raw === 'collecting_assets') {
    return 'producing'
  }
  if (raw === 'uploading') return 'uploaded'
  return 'producing'
}

const STATUS_FILTER_PILLS: { value: 'all' | VideoProjectStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'producing', label: 'Producing' },
  { value: 'approved', label: 'Approved' },
  { value: 'failed', label: 'Failed' },
  { value: 'uploaded', label: 'Uploaded' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'updated_desc', label: 'Updated (newest)' },
  { value: 'updated_asc', label: 'Updated (oldest)' },
  { value: 'duration_desc', label: 'Duration (long→short)' },
  { value: 'duration_asc', label: 'Duration (short→long)' },
  { value: 'status', label: 'Status' },
]

const BULK_STATUS_OPTIONS: {
  value: VideoProjectStatus
  label: string
  dotClass: string
}[] = [
  { value: 'producing', label: 'Producing', dotClass: 'bg-cyan-400' },
  { value: 'approved', label: 'Approved', dotClass: 'bg-emerald-400' },
  { value: 'failed', label: 'Failed', dotClass: 'bg-rose-400' },
  { value: 'uploaded', label: 'Uploaded', dotClass: 'bg-violet-400' },
  { value: 'rejected', label: 'Rejected', dotClass: 'bg-amber-400' },
]

type BulkActionType =
  | 'approve'
  | 'delete'
  | 'set-status'
  | 're-render'
  | 'unschedule'

// ─── Helpers ─────────────────────────────────────────────────────────

function toTimestamp(value?: string | Date | null): number {
  if (!value) return 0
  const d = value instanceof Date ? value : new Date(value)
  const t = d.getTime()
  return Number.isNaN(t) ? 0 : t
}

function relativeTime(value?: string | Date | null): string {
  const t = toTimestamp(value)
  if (!t) return '—'
  const diff = Date.now() - t
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const week = Math.floor(day / 7)
  if (week < 4) return `${week}w ago`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month}mo ago`
  const year = Math.floor(day / 365)
  return `${year}y ago`
}

function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return '—'
  }
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

// ─── Component ───────────────────────────────────────────────────────

export function VideoProjectExplorer({
  projects,
  onPreview,
  onBulkAction,
  className,
}: VideoProjectExplorerProps) {
  const { toast, update: updateToast } = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | VideoProjectStatus>(
    'all',
  )
  const [sortKey, setSortKey] = useState<SortKey>('updated_desc')

  // ─── Per-card re-render flow (single project) ─────────────────────
  // The bulk "re-render" action lives below; this state powers the
  // per-card button that calls /api/agent/rerender for one project.
  const [rerenderConfirmId, setRerenderConfirmId] = useState<string | null>(null)
  const [rerenderingIds, setRerenderingIds] = useState<Set<string>>(new Set())

  // ─── Bulk selection state ──────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState<BulkActionType | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<
    null | 'delete' | 're-render'
  >(null)

  // Debounced search (200ms)
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase())
    }, 200)
    return () => clearTimeout(handle)
  }, [searchInput])

  const filteredProjects = useMemo(() => {
    const out: VideoProject[] = []
    for (const project of projects) {
      const title = (project.title ?? '').toLowerCase()
      if (debouncedSearch && !title.includes(debouncedSearch)) continue
      if (statusFilter !== 'all') {
        const s = coerceStatus(project.status)
        if (s !== statusFilter) continue
      }
      out.push(project)
    }

    out.sort((a, b) => {
      switch (sortKey) {
        case 'updated_asc':
          return toTimestamp(a.updatedAt) - toTimestamp(b.updatedAt)
        case 'updated_desc':
          return toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt)
        case 'duration_asc': {
          const da = a.duration ?? 0
          const db = b.duration ?? 0
          return da - db
        }
        case 'duration_desc': {
          const da = a.duration ?? 0
          const db = b.duration ?? 0
          return db - da
        }
        case 'status': {
          const sa = coerceStatus(a.status)
          const sb = coerceStatus(b.status)
          return sa.localeCompare(sb)
        }
        default:
          return 0
      }
    })
    return out
  }, [projects, debouncedSearch, statusFilter, sortKey])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (debouncedSearch) n++
    if (statusFilter !== 'all') n++
    return n
  }, [debouncedSearch, statusFilter])

  // Prune stale IDs from selection when the projects list changes
  // (e.g. after a bulk delete or after the parent refetches).
  useEffect(() => {
    if (selectedIds.size === 0) return
    const validIds = new Set(projects.map((p) => p.id))
    let changed = false
    const next = new Set<string>()
    for (const id of selectedIds) {
      if (validIds.has(id)) {
        next.add(id)
      } else {
        changed = true
      }
    }
    if (changed) {
      setSelectedIds(next)
      if (next.size === 0) setSelectMode(false)
    }
  }, [projects, selectedIds])

  const clearFilters = useCallback(() => {
    setSearchInput('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setSortKey('updated_desc')
  }, [])

  // ─── Bulk action handlers ──────────────────────────────────────────
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      const next = !prev
      if (!next) setSelectedIds(new Set())
      return next
    })
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredProjects.map((p) => p.id)))
  }, [filteredProjects])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const executeBulkAction = useCallback(
    async (
      action: BulkActionType,
      payload?: Record<string, unknown>,
    ) => {
      if (selectedIds.size === 0) return
      setBulkLoading(action)
      const ids = Array.from(selectedIds)
      try {
        const res = await fetch('/api/data/projects/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, projectIds: ids, payload }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          affected?: number
          error?: string
        }
        if (!res.ok || !data.ok) {
          throw new Error(
            data.error || `Bulk ${action} failed (HTTP ${res.status})`,
          )
        }
        const affected = data.affected ?? 0
        toast({
          type: 'success',
          title: `Bulk ${action} complete`,
          description: `${affected} project${affected === 1 ? '' : 's'} affected.`,
        })
        // Clear local selection first, then notify parent so it can refresh.
        setSelectedIds(new Set())
        setSelectMode(false)
        setConfirmDialog(null)
        onBulkAction?.()
      } catch (err) {
        toast({
          type: 'error',
          title: `Bulk ${action} failed`,
          description: err instanceof Error ? err.message : 'Unknown error',
          duration: 5000,
        })
      } finally {
        setBulkLoading(null)
      }
    },
    [selectedIds, toast, onBulkAction],
  )

  const handleCardClick = useCallback(
    (id: string) => {
      if (selectMode) {
        toggleSelect(id)
        return
      }
      onPreview?.(id)
    },
    [selectMode, toggleSelect, onPreview],
  )

  // ─── Per-card re-render ──────────────────────────────────────────
  // Calls the single-project /api/agent/rerender endpoint, shows a
  // loading toast, marks the card as "rerendering" so its button hides,
  // and notifies the parent to refresh the pipeline.
  const handleCardRerender = useCallback(
    async (projectId: string) => {
      setRerenderConfirmId(null)
      setRerenderingIds((prev) => new Set(prev).add(projectId))
      const loadingId = toast({
        type: 'loading',
        title: 'Starting re-render…',
        description: 'Generating a revised script and re-rendering the video.',
        duration: 0,
      })
      try {
        const res = await fetch('/api/agent/rerender', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          message?: string
          error?: string
        }
        if (!res.ok || !data.ok) {
          const errMsg =
            data?.message || data?.error || `Re-render failed (${res.status})`
          updateToast(loadingId, {
            type: 'error',
            title: 'Re-render failed',
            description: errMsg,
            duration: 5000,
          })
          setRerenderingIds((prev) => {
            const next = new Set(prev)
            next.delete(projectId)
            return next
          })
          return
        }
        updateToast(loadingId, {
          type: 'success',
          title: 'Re-render started',
          description: data?.message || 'A new script version is being generated.',
          duration: 3500,
        })
        // Refresh the parent pipeline so the status flips to "producing".
        onBulkAction?.()
      } catch (err) {
        updateToast(loadingId, {
          type: 'error',
          title: 'Network error',
          description: err instanceof Error ? err.message : 'Failed to reach server',
          duration: 5000,
        })
        setRerenderingIds((prev) => {
          const next = new Set(prev)
          next.delete(projectId)
          return next
        })
      }
    },
    [toast, updateToast, onBulkAction],
  )

  const isLoading = projects.length === 0

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'w-full rounded-xl bg-slate-950 p-3 sm:p-4',
        'border border-slate-800/50',
        className,
      )}
    >
      {/* ─── Header / Search ─── */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
            <Film className="size-4 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Video Project Explorer
            </h3>
            <p className="text-[11px] text-slate-400">
              Produce, approve &amp; manage rendered videos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search projects by title…"
              className="h-9 border-slate-700/60 bg-slate-900/60 pl-9 pr-8 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Select toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={selectMode ? 'default' : 'outline'}
                size="sm"
                onClick={toggleSelectMode}
                className={cn(
                  'h-9 shrink-0 gap-1.5 px-3 text-xs',
                  selectMode
                    ? 'border-transparent bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600'
                    : 'border-slate-700/60 bg-slate-900/60 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100',
                )}
              >
                {selectMode ? (
                  <CheckSquare className="size-3.5" />
                ) : (
                  <Square className="size-3.5" />
                )}
                <span className="hidden sm:inline">Select</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-800 text-slate-100">
              {selectMode ? 'Exit selection mode' : 'Enter selection mode'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ─── Filter Row: status pills + sort ─── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Status pills */}
        <div className="flex items-center rounded-lg border border-slate-700/60 bg-slate-900/40 p-0.5">
          {STATUS_FILTER_PILLS.map((p) => {
            const isActive = statusFilter === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setStatusFilter(p.value)}
                className={cn(
                  'relative rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="vpx-status-pill-bg"
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-emerald-500/80 to-cyan-500/80"
                    transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
                  />
                )}
                <span className="relative z-10">{p.label}</span>
              </button>
            )
          })}
        </div>

        {/* Sort */}
        <Select
          value={sortKey}
          onValueChange={(v) => setSortKey(v as SortKey)}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-[180px] border-slate-700/60 bg-slate-900/60 text-xs text-slate-200 hover:bg-slate-800/60"
          >
            <Settings2 className="size-3.5 text-slate-500" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent className="border-slate-700/60 bg-slate-900 text-slate-200">
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Active filter count */}
        {activeFilterCount > 0 && (
          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
            <Tag className="size-3" />
            {activeFilterCount} active
          </Badge>
        )}

        <div className="ml-auto">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 gap-1.5 px-2 text-xs text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            >
              <X className="size-3" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* ─── Result Count ─── */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-slate-200">
            {filteredProjects.length}
          </span>{' '}
          of {projects.length} projects
        </p>
      </div>

      <Separator className="mb-3 bg-slate-800/60" />

      {/* ─── Selection Toolbar (only in select mode) ─── */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-3 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
              <span className="text-xs text-slate-400">
                {selectedIds.size > 0 ? (
                  <>
                    <span className="font-semibold text-emerald-300">
                      {selectedIds.size}
                    </span>{' '}
                    selected
                  </>
                ) : (
                  'Selection mode — click cards to select'
                )}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllFiltered}
                  className="h-7 gap-1.5 px-2 text-xs text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                >
                  <ListChecks className="size-3" />
                  Select all ({filteredProjects.length})
                </Button>
                {selectedIds.size > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="h-7 gap-1.5 px-2 text-xs text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  >
                    <X className="size-3" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Bulk Action Bar ─── */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            loadingAction={bulkLoading}
            confirmDialog={confirmDialog}
            onConfirmDialogChange={setConfirmDialog}
            onExecute={executeBulkAction}
          />
        )}
      </AnimatePresence>

      {/* ─── Grid ─── */}
      <ScrollArea className="max-h-[60vh]">
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredProjects.length === 0 ? (
          <EmptyState hasFilters={activeFilterCount > 0} onClear={clearFilters} />
        ) : (
          <div className="grid grid-cols-1 gap-2 pr-2 lg:grid-cols-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredProjects.map((project, i) => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{
                    duration: 0.25,
                    delay: Math.min(i * 0.03, 0.3),
                    ease: 'easeOut',
                  }}
                >
                  <ProjectCard
                    project={project}
                    onClick={() => handleCardClick(project.id)}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(project.id)}
                    onToggleSelect={toggleSelect}
                    isRerendering={rerenderingIds.has(project.id)}
                    onRerender={(id) => setRerenderConfirmId(id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>

      {/* ─── Per-card Re-render confirmation dialog ─── */}
      <AlertDialog
        open={rerenderConfirmId !== null}
        onOpenChange={(o) => { if (!o) setRerenderConfirmId(null) }}
      >
        <AlertDialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">
              Re-render this video?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              A new script version will be generated addressing the failed review
              issues, then the video will be re-rendered from scratch. This may
              take a few minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rerenderConfirmId) void handleCardRerender(rerenderConfirmId)
              }}
              className="border-0 bg-gradient-to-r from-rose-500 to-violet-500 text-white hover:from-rose-400 hover:to-violet-400"
            >
              <RefreshCcw className="mr-1.5 size-3.5" />
              Confirm Re-render
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Project Card ────────────────────────────────────────────────────

interface ProjectCardProps {
  project: VideoProject
  onClick: () => void
  selectMode: boolean
  isSelected: boolean
  onToggleSelect: (id: string) => void
  /** True while a re-render is in-flight for this project (hides the button). */
  isRerendering?: boolean
  /** Open the per-card re-render confirmation dialog. */
  onRerender?: (id: string) => void
}

function ProjectCard({
  project,
  onClick,
  selectMode,
  isSelected,
  onToggleSelect,
  isRerendering,
  onRerender,
}: ProjectCardProps) {
  const status = coerceStatus(project.status)
  const statusCfg = STATUS_CONFIG[status]
  const duration = project.duration
  const renderPct =
    typeof project.renderProgress === 'number'
      ? Math.max(0, Math.min(100, project.renderProgress))
      : null
  const isProducing = status === 'producing'
  const isFailed = status === 'failed' || status === 'rejected'
  // Show the re-render button only when the project failed AND we're not
  // already re-rendering it AND we're not in select mode (select mode is
  // for bulk actions; per-card actions are hidden to avoid clutter).
  const showRerender = isFailed && !isProducing && !isRerendering && !selectMode
  const canPreview =
    status === 'approved' || status === 'uploaded' || status === 'rejected'
  const title = project.title || 'Untitled project'

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'group relative w-full overflow-hidden rounded-lg',
        'bg-slate-900/60 border border-slate-800/50 backdrop-blur-sm',
        'p-3 sm:p-4 text-left transition-all duration-200',
        'hover:border-emerald-500/40 hover:bg-slate-900/80',
        'hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.35)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
        // Selected state — violet ring + slight elevation
        isSelected &&
          'border-violet-500/60 ring-2 ring-violet-500/50 shadow-[0_0_24px_-4px_rgba(139,92,246,0.55)] scale-[1.005]',
      )}
    >
      {/* Glow accent line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Selection checkbox — top right corner */}
      {selectMode && (
        <div
          className="absolute right-2 top-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(project.id)}
            className="size-4 border-violet-500/60 bg-slate-900/80 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500 data-[state=checked]:text-white"
            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${title}`}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Thumbnail / icon block */}
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-700/50 bg-slate-800/60">
          {project.thumbnailPath ? (
            // We can't reliably resolve arbitrary disk paths here, so we
            // surface a film icon — the preview modal handles real thumbs.
            <Film className="size-5 text-slate-400" />
          ) : (
            <Film className="size-5 text-slate-500" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          {/* Top row: title */}
          <Tooltip>
            <TooltipTrigger asChild>
              <h4
                className={cn(
                  'cursor-help text-sm font-medium leading-snug text-slate-100',
                  selectMode && 'pr-6',
                )}
              >
                {truncate(title, 60)}
              </h4>
            </TooltipTrigger>
            {title.length > 60 && (
              <TooltipContent className="max-w-xs bg-slate-800 text-slate-100">
                {title}
              </TooltipContent>
            )}
          </Tooltip>

          {/* Status badge row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn('gap-1 px-1.5 py-0 text-[10px]', statusCfg.badgeClass)}
            >
              <span className={cn('size-1.5 rounded-full', statusCfg.dotClass)} />
              {statusCfg.label}
            </Badge>

            {project.resolution && (
              <Badge
                variant="outline"
                className="gap-1 border-slate-700/40 bg-slate-800/40 px-1.5 py-0 text-[10px] text-slate-300"
              >
                {project.resolution}
              </Badge>
            )}

            {duration !== null && duration !== undefined && (
              <Badge
                variant="outline"
                className="gap-1 border-slate-700/40 bg-slate-800/40 px-1.5 py-0 text-[10px] font-mono text-slate-300"
              >
                {formatDuration(duration)}
              </Badge>
            )}

            {project.fileSize ? (
              <Badge
                variant="outline"
                className="gap-1 border-slate-700/40 bg-slate-800/40 px-1.5 py-0 text-[10px] font-mono text-slate-400"
              >
                {formatFileSize(project.fileSize)}
              </Badge>
            ) : null}
          </div>

          {/* Render progress bar (when producing) */}
          {isProducing && renderPct !== null && (
            <div className="flex items-center gap-2">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${renderPct}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-cyan-300">
                {renderPct.toFixed(0)}%
              </span>
            </div>
          )}

          {/* Footer row: timestamps + preview hint + per-card Re-render */}
          <div className="flex items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
            {project.updatedAt && (
              <span className="flex items-center gap-1">
                <RefreshCcw className="size-3 text-slate-500" />
                {relativeTime(project.updatedAt)}
              </span>
            )}

            {isRerendering && (
              <span className="ml-auto flex items-center gap-1 text-violet-300">
                <Loader2 className="size-3 animate-spin" />
                Re-rendering…
              </span>
            )}

            {showRerender && onRerender && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRerender(project.id)
                    }}
                    className="ml-auto h-6 gap-1 border-rose-500/40 bg-rose-500/5 px-2 text-[10px] text-rose-300 hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-200"
                  >
                    <RefreshCcw className="size-3" />
                    Re-render
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="border-slate-700 bg-slate-800 text-slate-200">
                  Re-render with revised script
                </TooltipContent>
              </Tooltip>
            )}

            {canPreview && !selectMode && !showRerender && !isRerendering && (
              <span className="ml-auto flex items-center gap-1 text-violet-300">
                <Play className="size-3" />
                Preview
              </span>
            )}
          </div>
        </div>

        {/* Play icon — hidden in select mode (replaced by checkbox) */}
        {!selectMode && canPreview && !showRerender && !isRerendering && (
          <Play className="size-4 -rotate-0 shrink-0 self-center text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-400" />
        )}
      </div>
    </motion.button>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean
  onClear: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-slate-900/60 border border-slate-800/60">
        <Film className="size-7 text-slate-500" />
      </div>
      <h4 className="mb-1 text-sm font-semibold text-slate-200">
        {hasFilters ? 'No projects match your filters' : 'No projects yet'}
      </h4>
      <p className="mb-4 max-w-xs text-xs text-slate-400">
        {hasFilters
          ? 'Try adjusting your search or clearing active filters to see more projects.'
          : 'Produce a video to see it appear here.'}
      </p>
      {hasFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="gap-1.5 border-slate-700/60 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
        >
          <X className="size-3.5" />
          Clear filters
        </Button>
      )}
    </motion.div>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2 pr-2 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-800/50 bg-slate-900/40 p-3 sm:p-4"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-12 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4 rounded" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 w-14 rounded" />
              </div>
              <Skeleton className="h-3 w-2/3 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Bulk Action Bar ────────────────────────────────────────────────

interface BulkActionBarProps {
  selectedCount: number
  loadingAction: BulkActionType | null
  confirmDialog: null | 'delete' | 're-render'
  onConfirmDialogChange: (open: null | 'delete' | 're-render') => void
  onExecute: (
    action: BulkActionType,
    payload?: Record<string, unknown>,
  ) => Promise<void>
}

function BulkActionBar({
  selectedCount,
  loadingAction,
  confirmDialog,
  onConfirmDialogChange,
  onExecute,
}: BulkActionBarProps) {
  const isLoading = (a: BulkActionType) => loadingAction === a
  const anyLoading = loadingAction !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7 }}
      className="sticky top-0 z-30 mb-3"
    >
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-violet-500/40 bg-slate-900/95 px-3 py-2 shadow-[0_8px_30px_-12px_rgba(139,92,246,0.4)] backdrop-blur-md">
        {/* Count badge */}
        <div className="flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs">
          <CheckSquare className="size-3.5 text-violet-300" />
          <span className="font-semibold text-violet-200">{selectedCount}</span>
          <span className="text-slate-400">selected</span>
        </div>

        <Separator
          orientation="vertical"
          className="mx-1 h-5 bg-slate-700/60"
        />

        {/* Approve (emerald) */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={anyLoading}
          onClick={() => onExecute('approve')}
          className="h-7 gap-1.5 border-emerald-500/40 bg-emerald-500/10 px-2 text-xs text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
        >
          {isLoading('approve') ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <CheckCircle className="size-3" />
          )}
          Approve
        </Button>

        {/* Set Status (amber, dropdown) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={anyLoading}
              className="h-7 gap-1.5 border-amber-500/40 bg-amber-500/10 px-2 text-xs text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
            >
              {isLoading('set-status') ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Tag className="size-3" />
              )}
              Set Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-slate-700/60 bg-slate-900 text-slate-200"
          >
            <DropdownMenuLabel className="text-xs text-slate-400">
              Set status for {selectedCount} project
              {selectedCount === 1 ? '' : 's'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-700/60" />
            {BULK_STATUS_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() =>
                  onExecute('set-status', { status: opt.value })
                }
                className="gap-2 text-xs focus:bg-slate-800/60"
              >
                <span
                  className={cn('size-1.5 rounded-full', opt.dotClass)}
                />
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Re-render (violet) — with confirmation dialog */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={anyLoading}
          onClick={() => onConfirmDialogChange('re-render')}
          className="h-7 gap-1.5 border-violet-500/40 bg-violet-500/10 px-2 text-xs text-violet-300 hover:bg-violet-500/20 hover:text-violet-200"
        >
          {isLoading('re-render') ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCcw className="size-3" />
          )}
          Re-render
        </Button>

        {/* Delete (rose) — with confirmation dialog */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={anyLoading}
          onClick={() => onConfirmDialogChange('delete')}
          className="h-7 gap-1.5 border-rose-500/40 bg-rose-500/10 px-2 text-xs text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
        >
          {isLoading('delete') ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
          Delete
        </Button>

        {/* Confirmation dialog for delete / re-render */}
        <AlertDialog
          open={confirmDialog !== null}
          onOpenChange={(open) => {
            if (!open) onConfirmDialogChange(null)
          }}
        >
          <AlertDialogContent className="border-slate-700/60 bg-slate-950 text-slate-100">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-base">
                {confirmDialog === 'delete' ? (
                  <>
                    <Trash2 className="size-4 text-rose-400" />
                    Delete {selectedCount} project
                    {selectedCount === 1 ? '' : 's'}?
                  </>
                ) : (
                  <>
                    <RefreshCcw className="size-4 text-violet-400" />
                    Re-render {selectedCount} project
                    {selectedCount === 1 ? '' : 's'}?
                  </>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-slate-400">
                {confirmDialog === 'delete'
                  ? 'This will permanently delete the selected video projects along with their policy reviews and any associated uploads. The underlying scripts and video ideas will be preserved. This action cannot be undone.'
                  : 'This will reset each selected project back to "producing" with render progress at 0%. The actual re-render will be triggered by the agent pipeline — your dashboard will refresh to show the new pending state.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-700/60 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmDialog === 'delete') {
                    onExecute('delete')
                  } else if (confirmDialog === 're-render') {
                    onExecute('re-render')
                  }
                }}
                className={cn(
                  confirmDialog === 'delete'
                    ? 'border border-rose-500/50 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 hover:text-rose-100'
                    : 'border border-violet-500/50 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 hover:text-violet-100',
                )}
              >
                {confirmDialog === 'delete' ? (
                  <>
                    <XCircle className="size-3.5" />
                    Delete
                  </>
                ) : (
                  <>
                    <RefreshCcw className="size-3.5" />
                    Re-render
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  )
}

export default VideoProjectExplorer
