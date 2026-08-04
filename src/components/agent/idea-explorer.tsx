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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
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
  ArrowUpDown,
  Lightbulb,
  Calendar,
  Clock,
  X,
  ChevronDown,
  Sparkles,
  FileText,
  TrendingUp,
  Target,
  AlertTriangle,
  Flame,
  Gauge,
  DollarSign,
  Layers,
  Hash,
  CheckCircle2,
  Film,
  Video,
  Filter,
  Inbox,
  CheckSquare,
  Square,
  Trash2,
  CalendarClock,
  Tag,
  Loader2,
  ListChecks,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/agent/toast-provider'

// ─── Types ───────────────────────────────────────────────────────────

export type IdeaType = 'short' | 'longform'
export type IdeaStatus =
  | 'idea'
  | 'researched'
  | 'scripted'
  | 'producing'
  | 'reviewing'
  | 'approved'
  | 'uploaded'
  | 'failed'

export interface IdeaPillar {
  id: string
  name: string
  description?: string | null
  color?: string | null
  priority?: number | null
}

export interface Idea {
  id: string
  title: string
  type: IdeaType
  status: IdeaStatus
  pillarId?: string | null
  pillar?: IdeaPillar | null
  searchVolume?: number | null
  competitionScore?: number | null
  originalityScore?: number | null
  retentionPrediction?: number | null
  revenuePotential?: number | null
  productionEffort?: number | null
  riskScore?: number | null
  compositeScore?: number | null
  tags?: string[] | null
  scheduledDate?: string | Date | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
}

interface IdeaExplorerProps {
  ideas: Idea[]
  onSelectIdea?: (ideaId: string) => void
  /** Notified after a bulk action completes so the parent can refresh. */
  onBulkAction?: (action: string, count: number) => void
  className?: string
}

type SortKey =
  | 'created_desc'
  | 'created_asc'
  | 'title_asc'
  | 'title_desc'
  | 'composite_desc'
  | 'scheduled_asc'

// ─── Status Config ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  IdeaStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  idea: {
    label: 'Idea',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    dotClass: 'bg-slate-400',
  },
  researched: {
    label: 'Researched',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
  scripted: {
    label: 'Scripted',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
  producing: {
    label: 'Producing',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  reviewing: {
    label: 'Reviewing',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-400',
  },
  approved: {
    label: 'Approved',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  uploaded: {
    label: 'Uploaded',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    dotClass: 'bg-cyan-400',
  },
  failed: {
    label: 'Failed',
    badgeClass: 'bg-red-500/15 text-red-300 border-red-500/30',
    dotClass: 'bg-red-400',
  },
}

const TYPE_CONFIG: Record<
  IdeaType,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  short: {
    label: 'Short',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    icon: Film,
  },
  longform: {
    label: 'Long',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: Video,
  },
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'created_desc', label: 'Created (newest)' },
  { value: 'created_asc', label: 'Created (oldest)' },
  { value: 'title_asc', label: 'Title A-Z' },
  { value: 'title_desc', label: 'Title Z-A' },
  { value: 'composite_desc', label: 'Composite Score (high→low)' },
  { value: 'scheduled_asc', label: 'Scheduled Date' },
]

const VISIBLE_INCREMENT = 50

// ─── Bulk Action Options ────────────────────────────────────────────

const BULK_STATUS_OPTIONS: {
  value: IdeaStatus
  label: string
  dotClass: string
}[] = [
  { value: 'idea', label: 'Idea', dotClass: 'bg-slate-400' },
  { value: 'researched', label: 'Researched', dotClass: 'bg-cyan-400' },
  { value: 'scripted', label: 'Scripted', dotClass: 'bg-amber-400' },
  { value: 'producing', label: 'Producing', dotClass: 'bg-emerald-400' },
  { value: 'reviewing', label: 'Reviewing', dotClass: 'bg-rose-400' },
  { value: 'approved', label: 'Approved', dotClass: 'bg-emerald-400' },
  { value: 'uploaded', label: 'Uploaded', dotClass: 'bg-cyan-400' },
  { value: 'failed', label: 'Failed', dotClass: 'bg-red-400' },
]

const BULK_TYPE_OPTIONS: { value: IdeaType; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'longform', label: 'Long-form' },
]

type BulkActionType =
  | 'schedule'
  | 'unschedule'
  | 'delete'
  | 'set-status'
  | 'set-type'
  | 'assign-pillar'

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

function formatDate(value?: string | Date | null): string {
  const t = toTimestamp(value)
  if (!t) return '—'
  return new Date(t).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function clampScore(value?: number | null): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.round(value)
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

function scoreBarColor(metric: string, value: number): string {
  // Higher-is-better metrics
  const higherBetter = [
    'originalityScore',
    'retentionPrediction',
    'revenuePotential',
    'compositeScore',
    'searchVolume',
  ]
  // Lower-is-better metrics
  const lowerBetter = ['competitionScore', 'productionEffort', 'riskScore']
  if (higherBetter.includes(metric)) {
    if (value >= 75) return 'bg-gradient-to-r from-violet-500 to-cyan-500'
    if (value >= 50) return 'bg-gradient-to-r from-emerald-500 to-cyan-500'
    if (value >= 30) return 'bg-amber-500'
    return 'bg-rose-500'
  }
  if (lowerBetter.includes(metric)) {
    if (value <= 30) return 'bg-gradient-to-r from-emerald-500 to-cyan-500'
    if (value <= 50) return 'bg-amber-500'
    return 'bg-rose-500'
  }
  return 'bg-primary'
}

function pillarColor(color?: string | null): string {
  if (!color) return 'bg-slate-400'
  // Map known hex / named colors to closest tailwind-ish dot color
  const c = color.toLowerCase()
  if (c.includes('violet') || c.includes('purple')) return 'bg-violet-400'
  if (c.includes('cyan') || c.includes('teal')) return 'bg-cyan-400'
  if (c.includes('emerald') || c.includes('green')) return 'bg-emerald-400'
  if (c.includes('amber') || c.includes('orange') || c.includes('yellow'))
    return 'bg-amber-400'
  if (c.includes('rose') || c.includes('pink') || c.includes('red'))
    return 'bg-rose-400'
  if (c.includes('#')) {
    // try to use the raw color via inline style fallback in component
    return ''
  }
  return 'bg-slate-400'
}

// ─── Component ───────────────────────────────────────────────────────

export function IdeaExplorer({
  ideas,
  onSelectIdea,
  onBulkAction,
  className,
}: IdeaExplorerProps) {
  const { toast } = useToast()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | IdeaType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | IdeaStatus>('all')
  const [pillarFilter, setPillarFilter] = useState<'all' | string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_desc')
  const [drawerIdeaId, setDrawerIdeaId] = useState<string | null>(null)

  // ─── Bulk selection state ──────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState<BulkActionType | null>(null)
  const [scheduleDate, setScheduleDate] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d
  })
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<
    null | 'delete' | 'unschedule'
  >(null)

  // Debounced search (200ms)
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase())
    }, 200)
    return () => clearTimeout(handle)
  }, [searchInput])

  // Reset visible count when filters change.
  // Pattern: store a signature alongside the count; when the signature
  // changes during render, reset the count to the baseline. This is the
  // React-recommended "derive state during render" pattern and avoids
  // both the setState-in-effect and ref-during-render lint rules.
  const filterSignature = `${debouncedSearch}|${typeFilter}|${statusFilter}|${pillarFilter}|${sortKey}`
  const [visibleState, setVisibleState] = useState<{
    sig: string
    count: number
  }>({ sig: filterSignature, count: VISIBLE_INCREMENT })
  if (visibleState.sig !== filterSignature) {
    setVisibleState({ sig: filterSignature, count: VISIBLE_INCREMENT })
  }
  const visibleCount = visibleState.count

  // Derive pillar list from ideas
  const pillars = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const idea of ideas) {
      const p = idea.pillar
      if (p?.id && p?.name) {
        if (!map.has(p.id)) {
          map.set(p.id, { id: p.id, name: p.name })
        }
      } else if (idea.pillarId) {
        if (!map.has(idea.pillarId)) {
          map.set(idea.pillarId, { id: idea.pillarId, name: idea.pillarId })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [ideas])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (debouncedSearch) n++
    if (typeFilter !== 'all') n++
    if (statusFilter !== 'all') n++
    if (pillarFilter !== 'all') n++
    return n
  }, [debouncedSearch, typeFilter, statusFilter, pillarFilter])

  const filteredIdeas = useMemo(() => {
    const out: Idea[] = []
    for (const idea of ideas) {
      if (
        debouncedSearch &&
        !idea.title.toLowerCase().includes(debouncedSearch)
      ) {
        continue
      }
      if (typeFilter !== 'all' && idea.type !== typeFilter) continue
      if (statusFilter !== 'all' && idea.status !== statusFilter) continue
      if (pillarFilter !== 'all') {
        const pid = idea.pillar?.id ?? idea.pillarId ?? null
        if (pid !== pillarFilter) continue
      }
      out.push(idea)
    }

    out.sort((a, b) => {
      switch (sortKey) {
        case 'created_asc':
          return toTimestamp(a.createdAt) - toTimestamp(b.createdAt)
        case 'created_desc':
          return toTimestamp(b.createdAt) - toTimestamp(a.createdAt)
        case 'title_asc':
          return a.title.localeCompare(b.title)
        case 'title_desc':
          return b.title.localeCompare(a.title)
        case 'composite_desc':
          return (
            (b.compositeScore ?? -1) - (a.compositeScore ?? -1)
          )
        case 'scheduled_asc': {
          const ta = toTimestamp(a.scheduledDate)
          const tb = toTimestamp(b.scheduledDate)
          // unscheduled go to end
          if (!ta && !tb) return 0
          if (!ta) return 1
          if (!tb) return -1
          return ta - tb
        }
        default:
          return 0
      }
    })
    return out
  }, [
    ideas,
    debouncedSearch,
    typeFilter,
    statusFilter,
    pillarFilter,
    sortKey,
  ])

  const visibleIdeas = filteredIdeas.slice(0, visibleCount)
  const hasMore = filteredIdeas.length > visibleCount

  const selectedIdea = useMemo(() => {
    if (!drawerIdeaId) return null
    return ideas.find((i) => i.id === drawerIdeaId) ?? null
  }, [drawerIdeaId, ideas])

  // Prune stale IDs from selection when the ideas list changes
  // (e.g. after a bulk delete or after the parent refetches).
  useEffect(() => {
    if (selectedIds.size === 0) return
    const validIds = new Set(ideas.map((i) => i.id))
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
  }, [ideas, selectedIds])

  const clearFilters = useCallback(() => {
    setSearchInput('')
    setDebouncedSearch('')
    setTypeFilter('all')
    setStatusFilter('all')
    setPillarFilter('all')
    setSortKey('created_desc')
  }, [])

  // ─── Bulk action handlers ──────────────────────────────────────────
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      const next = !prev
      if (!next) setSelectedIds(new Set())
      return next
    })
  }, [])

  const toggleSelect = useCallback((ideaId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(ideaId)) next.delete(ideaId)
      else next.add(ideaId)
      return next
    })
  }, [])

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filteredIdeas.map((i) => i.id)))
  }, [filteredIdeas])

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
        const res = await fetch('/api/data/ideas/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ideaIds: ids, payload }),
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
          description: `${affected} idea${affected === 1 ? '' : 's'} affected.`,
        })
        // Clear local selection first, then notify parent so it can refresh.
        setSelectedIds(new Set())
        setSelectMode(false)
        setConfirmDialog(null)
        setScheduleOpen(false)
        onBulkAction?.(action, affected)
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
    (ideaId: string) => {
      if (selectMode) {
        toggleSelect(ideaId)
        return
      }
      setDrawerIdeaId(ideaId)
    },
    [selectMode, toggleSelect],
  )

  const handleSelectFromDrawer = useCallback(() => {
    if (drawerIdeaId && onSelectIdea) {
      onSelectIdea(drawerIdeaId)
    }
  }, [drawerIdeaId, onSelectIdea])

  const isLoading = ideas.length === 0

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
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
            <Lightbulb className="size-4 text-violet-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Idea Explorer
            </h3>
            <p className="text-[11px] text-slate-400">
              Search, filter &amp; inspect video ideas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search ideas by title…"
              className="h-9 border-slate-700/60 bg-slate-900/60 pl-9 pr-8 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20"
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
                    ? 'border-transparent bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:from-violet-600 hover:to-cyan-600'
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

      {/* ─── Filter Row ─── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Type pills */}
        <div className="flex items-center rounded-lg border border-slate-700/60 bg-slate-900/40 p-0.5">
          {(['all', 'short', 'longform'] as const).map((t) => {
            const isActive = typeFilter === t
            const label =
              t === 'all' ? 'All' : t === 'short' ? 'Short' : 'Long'
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'relative rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="type-pill-bg"
                    className="absolute inset-0 rounded-md bg-gradient-to-r from-violet-500/80 to-cyan-500/80"
                    transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            )
          })}
        </div>

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as 'all' | IdeaStatus)}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-[150px] border-slate-700/60 bg-slate-900/60 text-xs text-slate-200 hover:bg-slate-800/60"
          >
            <Filter className="size-3.5 text-slate-500" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="border-slate-700/60 bg-slate-900 text-slate-200">
            <SelectItem value="all">All statuses</SelectItem>
            <Separator className="bg-slate-700/60" />
            {(Object.keys(STATUS_CONFIG) as IdeaStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      STATUS_CONFIG[s].dotClass,
                    )}
                  />
                  {STATUS_CONFIG[s].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Pillar filter */}
        <Select
          value={pillarFilter}
          onValueChange={(v) => setPillarFilter(v)}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-[160px] border-slate-700/60 bg-slate-900/60 text-xs text-slate-200 hover:bg-slate-800/60"
          >
            <Layers className="size-3.5 text-slate-500" />
            <SelectValue placeholder="Pillar" />
          </SelectTrigger>
          <SelectContent className="border-slate-700/60 bg-slate-900 text-slate-200">
            <SelectItem value="all">All pillars</SelectItem>
            {pillars.length > 0 && (
              <Separator className="bg-slate-700/60" />
            )}
            {pillars.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="line-clamp-1">{p.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={sortKey}
          onValueChange={(v) => setSortKey(v as SortKey)}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-[180px] border-slate-700/60 bg-slate-900/60 text-xs text-slate-200 hover:bg-slate-800/60"
          >
            <ArrowUpDown className="size-3.5 text-slate-500" />
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
          <Badge className="border-violet-500/30 bg-violet-500/15 text-violet-300">
            <Filter className="size-3" />
            {activeFilterCount} active
          </Badge>
        )}
      </div>

      {/* ─── Result Count & Clear ─── */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          <span className="font-semibold text-slate-200">
            {filteredIdeas.length}
          </span>{' '}
          of {ideas.length} ideas
        </p>
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
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2">
              <span className="text-xs text-slate-400">
                {selectedIds.size > 0 ? (
                  <>
                    <span className="font-semibold text-violet-300">
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
                  Select all ({filteredIdeas.length})
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
            pillars={pillars}
            scheduleDate={scheduleDate}
            scheduleOpen={scheduleOpen}
            confirmDialog={confirmDialog}
            onScheduleOpenChange={setScheduleOpen}
            onScheduleDateChange={setScheduleDate}
            onConfirmDialogChange={setConfirmDialog}
            onExecute={executeBulkAction}
          />
        )}
      </AnimatePresence>

      {/* ─── List ─── */}
      <ScrollArea className="max-h-[60vh]">
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredIdeas.length === 0 ? (
          <EmptyState onClear={clearFilters} hasFilters={activeFilterCount > 0} />
        ) : (
          <div className="flex flex-col gap-2 pr-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleIdeas.map((idea, i) => (
                <motion.div
                  key={idea.id}
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
                  <IdeaCard
                    idea={idea}
                    onClick={() => handleCardClick(idea.id)}
                    selectMode={selectMode}
                    isSelected={selectedIds.has(idea.id)}
                    onToggleSelect={toggleSelect}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {hasMore && (
              <div className="flex justify-center py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setVisibleState((s) => ({
                      sig: s.sig,
                      count: s.count + VISIBLE_INCREMENT,
                    }))
                  }
                  className="gap-1.5 border-slate-700/60 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                >
                  <ChevronDown className="size-3.5" />
                  Load more ({filteredIdeas.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* ─── Detail Drawer ─── */}
      <Sheet
        open={!!drawerIdeaId}
        onOpenChange={(open) => {
          if (!open) setDrawerIdeaId(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-full border-l border-slate-800/60 bg-slate-950 p-0 sm:max-w-md md:max-w-lg"
        >
          {selectedIdea ? (
            <IdeaDrawerContent
              idea={selectedIdea}
              onSelect={handleSelectFromDrawer}
              onClose={() => setDrawerIdeaId(null)}
              hasSelectHandler={!!onSelectIdea}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-slate-500">
              Loading…
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Idea Card ───────────────────────────────────────────────────────

interface IdeaCardProps {
  idea: Idea
  onClick: () => void
  selectMode: boolean
  isSelected: boolean
  onToggleSelect: (ideaId: string) => void
}

function IdeaCard({
  idea,
  onClick,
  selectMode,
  isSelected,
  onToggleSelect,
}: IdeaCardProps) {
  const typeCfg = TYPE_CONFIG[idea.type] ?? TYPE_CONFIG.short
  const statusCfg = STATUS_CONFIG[idea.status] ?? STATUS_CONFIG.idea
  const TypeIcon = typeCfg.icon
  const composite = clampScore(idea.compositeScore)
  const hasComposite =
    idea.compositeScore !== null && idea.compositeScore !== undefined
  const pillarDot = pillarColor(idea.pillar?.color)
  const pillarDotStyle =
    idea.pillar?.color && idea.pillar.color.startsWith('#')
      ? { backgroundColor: idea.pillar.color }
      : undefined

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
        'hover:border-violet-500/40 hover:bg-slate-900/80',
        'hover:shadow-[0_0_20px_-5px_rgba(139,92,246,0.35)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
        // Selected state — violet ring + slight elevation
        isSelected &&
          'border-violet-500/60 ring-2 ring-violet-500/50 shadow-[0_0_24px_-4px_rgba(139,92,246,0.55)] scale-[1.005]',
      )}
    >
      {/* Glow accent line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Selection checkbox — top right corner */}
      {selectMode && (
        <div
          className="absolute right-2 top-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(idea.id)}
            className="size-4 border-violet-500/60 bg-slate-900/80 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500 data-[state=checked]:text-white"
            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${idea.title}`}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          {/* Top row: badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn('gap-1 px-1.5 py-0 text-[10px]', typeCfg.badgeClass)}
            >
              <TypeIcon className="size-3" />
              {typeCfg.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn('gap-1 px-1.5 py-0 text-[10px]', statusCfg.badgeClass)}
            >
              <span className={cn('size-1.5 rounded-full', statusCfg.dotClass)} />
              {statusCfg.label}
            </Badge>

            {idea.pillar?.name && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-700/40 bg-slate-800/40 px-1.5 py-0.5 text-[10px] text-slate-300">
                    <span
                      className={cn('size-1.5 rounded-full', pillarDot)}
                      style={pillarDotStyle}
                    />
                    <span className="max-w-[120px] truncate">
                      {idea.pillar.name}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-800 text-slate-100">
                  Pillar: {idea.pillar.name}
                  {idea.pillar.description
                    ? ` — ${idea.pillar.description}`
                    : ''}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Title */}
          <Tooltip>
            <TooltipTrigger asChild>
              <h4 className="cursor-help text-sm font-medium leading-snug text-slate-100">
                {truncate(idea.title, 60)}
              </h4>
            </TooltipTrigger>
            {idea.title.length > 60 && (
              <TooltipContent className="max-w-xs bg-slate-800 text-slate-100">
                {idea.title}
              </TooltipContent>
            )}
          </Tooltip>

          {/* Bottom row: composite score + dates */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
            {hasComposite && (
              <div className="flex items-center gap-1.5">
                <Gauge className="size-3 text-violet-400" />
                <span className="font-medium text-slate-300">{composite}</span>
                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
                    style={{ width: `${composite}%` }}
                  />
                </div>
              </div>
            )}

            {idea.scheduledDate && (
              <div className="flex items-center gap-1">
                <Calendar className="size-3 text-cyan-400" />
                <span>
                  {new Date(toTimestamp(idea.scheduledDate)).toLocaleDateString(
                    undefined,
                    { month: 'short', day: 'numeric' },
                  )}
                </span>
              </div>
            )}

            {idea.createdAt && (
              <div className="flex items-center gap-1">
                <Clock className="size-3 text-slate-500" />
                <span>{relativeTime(idea.createdAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Chevron — hidden in select mode (replaced by checkbox) */}
        {!selectMode && (
          <ChevronDown className="size-4 -rotate-90 shrink-0 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-violet-400" />
        )}
      </div>
    </motion.button>
  )
}

// ─── Drawer Content ──────────────────────────────────────────────────

interface DrawerContentProps {
  idea: Idea
  onSelect: () => void
  onClose: () => void
  hasSelectHandler: boolean
}

function IdeaDrawerContent({
  idea,
  onSelect,
  onClose,
  hasSelectHandler,
}: DrawerContentProps) {
  const typeCfg = TYPE_CONFIG[idea.type] ?? TYPE_CONFIG.short
  const statusCfg = STATUS_CONFIG[idea.status] ?? STATUS_CONFIG.idea
  const TypeIcon = typeCfg.icon

  const scores: { key: string; label: string; value: number; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      key: 'searchVolume',
      label: 'Search Volume',
      value: clampScore(idea.searchVolume),
      icon: TrendingUp,
    },
    {
      key: 'competitionScore',
      label: 'Competition',
      value: clampScore(idea.competitionScore),
      icon: Target,
    },
    {
      key: 'originalityScore',
      label: 'Originality',
      value: clampScore(idea.originalityScore),
      icon: Sparkles,
    },
    {
      key: 'retentionPrediction',
      label: 'Retention Pred.',
      value: clampScore(idea.retentionPrediction),
      icon: Gauge,
    },
    {
      key: 'revenuePotential',
      label: 'Revenue Potential',
      value: clampScore(idea.revenuePotential),
      icon: DollarSign,
    },
    {
      key: 'productionEffort',
      label: 'Production Effort',
      value: clampScore(idea.productionEffort),
      icon: Film,
    },
    {
      key: 'riskScore',
      label: 'Risk Score',
      value: clampScore(idea.riskScore),
      icon: AlertTriangle,
    },
    {
      key: 'compositeScore',
      label: 'Composite Score',
      value: clampScore(idea.compositeScore),
      icon: Flame,
    },
  ]

  return (
    <ScrollArea className="h-full">
      <SheetHeader className="border-b border-slate-800/60 bg-slate-900/40 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn('gap-1', typeCfg.badgeClass)}
          >
            <TypeIcon className="size-3" />
            {typeCfg.label}
          </Badge>
          <Badge
            variant="outline"
            className={cn('gap-1', statusCfg.badgeClass)}
          >
            <span className={cn('size-1.5 rounded-full', statusCfg.dotClass)} />
            {statusCfg.label}
          </Badge>
          {idea.pillar?.name && (
            <Badge
              variant="outline"
              className="gap-1 border-slate-700/40 bg-slate-800/40 text-slate-300"
            >
              <span
                className={cn('size-1.5 rounded-full', pillarColor(idea.pillar.color))}
                style={
                  idea.pillar.color?.startsWith('#')
                    ? { backgroundColor: idea.pillar.color }
                    : undefined
                }
              />
              {idea.pillar.name}
            </Badge>
          )}
        </div>
        <SheetTitle className="text-lg font-semibold leading-tight text-slate-100">
          {idea.title}
        </SheetTitle>
        <SheetDescription className="text-xs text-slate-400">
          Idea ID:{' '}
          <code className="rounded bg-slate-800/60 px-1 py-0.5 text-[10px] text-slate-300">
            {idea.id}
          </code>
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 p-5">
        {/* Metadata grid */}
        <section>
          <h5 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <FileText className="size-3" />
            Metadata
          </h5>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <MetaItem label="Type" value={typeCfg.label} />
            <MetaItem label="Status" value={statusCfg.label} />
            <MetaItem
              label="Pillar"
              value={idea.pillar?.name ?? 'Unassigned'}
            />
            <MetaItem
              label="Composite"
              value={
                idea.compositeScore !== null &&
                idea.compositeScore !== undefined
                  ? String(clampScore(idea.compositeScore))
                  : '—'
              }
            />
            <MetaItem
              label="Scheduled"
              value={
                idea.scheduledDate
                  ? formatDate(idea.scheduledDate)
                  : 'Not scheduled'
              }
            />
            <MetaItem
              label="Created"
              value={idea.createdAt ? formatDate(idea.createdAt) : '—'}
            />
            <MetaItem
              label="Updated"
              value={idea.updatedAt ? formatDate(idea.updatedAt) : '—'}
            />
            <MetaItem
              label="Created (rel.)"
              value={idea.createdAt ? relativeTime(idea.createdAt) : '—'}
            />
          </div>
        </section>

        <Separator className="bg-slate-800/60" />

        {/* Scores */}
        <section>
          <h5 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Gauge className="size-3" />
            Score Metrics
          </h5>
          <div className="flex flex-col gap-3">
            {scores.map((s) => {
              const Icon = s.icon
              const rawValue = (idea as unknown as Record<string, unknown>)[s.key]
              const isSet = rawValue !== null && rawValue !== undefined
              return (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Icon className="size-3 text-slate-500" />
                      {s.label}
                    </span>
                    <span className="font-mono font-medium text-slate-200">
                      {isSet ? s.value : '—'}
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        scoreBarColor(s.key, s.value),
                      )}
                      style={{ width: `${isSet ? s.value : 0}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Tags */}
        {idea.tags && idea.tags.length > 0 && (
          <>
            <Separator className="bg-slate-800/60" />
            <section>
              <h5 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <Hash className="size-3" />
                Tags
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {idea.tags.map((tag, idx) => (
                  <Badge
                    key={`${tag}-${idx}`}
                    variant="outline"
                    className="border-slate-700/40 bg-slate-800/40 text-slate-300"
                  >
                    <Hash className="size-2.5" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Description */}
        {idea.pillar?.description && (
          <>
            <Separator className="bg-slate-800/60" />
            <section>
              <h5 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <Layers className="size-3" />
                Pillar Description
              </h5>
              <p className="text-xs leading-relaxed text-slate-300">
                {idea.pillar.description}
              </p>
            </section>
          </>
        )}
      </div>

      <SheetFooter className="flex-row gap-2 border-t border-slate-800/60 bg-slate-900/40 p-4">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 gap-1.5 border-slate-700/60 bg-slate-900/40 text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
        >
          <X className="size-3.5" />
          Close
        </Button>
        {hasSelectHandler && (
          <Button
            onClick={onSelect}
            className="flex-1 gap-1.5 bg-gradient-to-r from-violet-500 to-cyan-500 text-white hover:from-violet-600 hover:to-cyan-600"
          >
            <CheckCircle2 className="size-3.5" />
            Select
          </Button>
        )}
      </SheetFooter>
    </ScrollArea>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800/60 bg-slate-900/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="truncate text-xs font-medium text-slate-200" title={value}>
        {value}
      </div>
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────

function EmptyState({
  onClear,
  hasFilters,
}: {
  onClear: () => void
  hasFilters: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-slate-900/60 border border-slate-800/60">
        {hasFilters ? (
          <Inbox className="size-7 text-slate-500" />
        ) : (
          <Lightbulb className="size-7 text-slate-500" />
        )}
      </div>
      <h4 className="mb-1 text-sm font-semibold text-slate-200">
        {hasFilters ? 'No ideas match your filters' : 'No ideas yet'}
      </h4>
      <p className="mb-4 max-w-xs text-xs text-slate-400">
        {hasFilters
          ? 'Try adjusting your search or clearing active filters to see more ideas.'
          : 'Once the agent generates ideas, they will appear here.'}
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
    <div className="flex flex-col gap-2 pr-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-800/50 bg-slate-900/40 p-3 sm:p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <Skeleton className="h-4 w-3/4 rounded" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-12 rounded" />
              </div>
            </div>
            <Skeleton className="size-4 rounded" />
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
  pillars: { id: string; name: string }[]
  scheduleDate: Date
  scheduleOpen: boolean
  confirmDialog: null | 'delete' | 'unschedule'
  onScheduleOpenChange: (open: boolean) => void
  onScheduleDateChange: (date: Date) => void
  onConfirmDialogChange: (
    open: null | 'delete' | 'unschedule',
  ) => void
  onExecute: (
    action: BulkActionType,
    payload?: Record<string, unknown>,
  ) => Promise<void>
}

function BulkActionBar({
  selectedCount,
  loadingAction,
  pillars,
  scheduleDate,
  scheduleOpen,
  confirmDialog,
  onScheduleOpenChange,
  onScheduleDateChange,
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

        {/* Schedule (calendar popover) */}
        <Popover open={scheduleOpen} onOpenChange={onScheduleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={anyLoading}
              className="h-7 gap-1.5 border-slate-700/60 bg-slate-900/40 px-2 text-xs text-slate-200 hover:bg-slate-800/60 hover:text-slate-100"
            >
              {isLoading('schedule') ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CalendarClock className="size-3 text-cyan-400" />
              )}
              Schedule
            </Button>
          </PopoverTrigger>
          <PopoverContent
            sideOffset={6}
            className="w-auto border-slate-700/60 bg-slate-900 p-0 text-slate-200"
          >
            <div className="p-2">
              <CalendarPicker
                mode="single"
                selected={scheduleDate}
                onSelect={(d) => {
                  if (d) onScheduleDateChange(d)
                }}
                initialFocus
                className="rounded-md border border-slate-800 bg-slate-900 text-slate-200 [--primary:oklch(0.606_0.25_292.717)] [--primary-foreground:oklch(0.985_0_0)]"
                classNames={{
                  month_caption: 'text-slate-200 font-medium',
                  weekday: 'text-slate-500',
                  day: 'text-slate-300 hover:bg-slate-800/60 rounded-md',
                  today:
                    'bg-slate-800 text-slate-100 rounded-md font-semibold',
                  outside: 'text-slate-600 opacity-50',
                  button_previous:
                    'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800',
                  button_next:
                    'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800',
                  caption_label: 'text-slate-200 font-medium',
                }}
              />
              <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-2 py-2">
                <span className="text-xs text-slate-400">
                  {scheduleDate.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    onExecute('schedule', {
                      date: scheduleDate.toISOString(),
                    })
                  }
                  disabled={anyLoading}
                  className="h-7 gap-1.5 bg-gradient-to-r from-violet-500 to-cyan-500 px-3 text-xs text-white hover:from-violet-600 hover:to-cyan-600"
                >
                  {isLoading('schedule') ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CalendarClock className="size-3" />
                  )}
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Unschedule (with confirmation) */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={anyLoading}
          onClick={() => onConfirmDialogChange('unschedule')}
          className="h-7 gap-1.5 border-slate-700/60 bg-slate-900/40 px-2 text-xs text-slate-200 hover:bg-slate-800/60 hover:text-slate-100"
        >
          {isLoading('unschedule') ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <X className="size-3 text-amber-400" />
          )}
          Unschedule
        </Button>

        {/* Set Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={anyLoading}
              className="h-7 gap-1.5 border-slate-700/60 bg-slate-900/40 px-2 text-xs text-slate-200 hover:bg-slate-800/60 hover:text-slate-100"
            >
              {isLoading('set-status') ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Gauge className="size-3 text-emerald-400" />
              )}
              Set Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-slate-700/60 bg-slate-900 text-slate-200"
          >
            <DropdownMenuLabel className="text-xs text-slate-400">
              Set status for {selectedCount} idea
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

        {/* Set Type dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={anyLoading}
              className="h-7 gap-1.5 border-slate-700/60 bg-slate-900/40 px-2 text-xs text-slate-200 hover:bg-slate-800/60 hover:text-slate-100"
            >
              {isLoading('set-type') ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Tag className="size-3 text-violet-400" />
              )}
              Set Type
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-slate-700/60 bg-slate-900 text-slate-200"
          >
            <DropdownMenuLabel className="text-xs text-slate-400">
              Set type for {selectedCount} idea
              {selectedCount === 1 ? '' : 's'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-700/60" />
            {BULK_TYPE_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() =>
                  onExecute('set-type', { type: opt.value })
                }
                className="text-xs focus:bg-slate-800/60"
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assign Pillar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={anyLoading || pillars.length === 0}
              className="h-7 gap-1.5 border-slate-700/60 bg-slate-900/40 px-2 text-xs text-slate-200 hover:bg-slate-800/60 hover:text-slate-100"
            >
              {isLoading('assign-pillar') ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Layers className="size-3 text-cyan-400" />
              )}
              Assign Pillar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-slate-700/60 bg-slate-900 text-slate-200"
          >
            <DropdownMenuLabel className="text-xs text-slate-400">
              Assign pillar to {selectedCount} idea
              {selectedCount === 1 ? '' : 's'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-700/60" />
            {pillars.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-slate-500">
                No pillars available
              </div>
            ) : (
              pillars.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() =>
                    onExecute('assign-pillar', { pillarId: p.id })
                  }
                  className="text-xs focus:bg-slate-800/60"
                >
                  <span className="line-clamp-1">{p.name}</span>
                </DropdownMenuItem>
              ))
            )}
            {pillars.length > 0 && (
              <>
                <DropdownMenuSeparator className="bg-slate-700/60" />
                <DropdownMenuItem
                  onSelect={() =>
                    onExecute('assign-pillar', { pillarId: null })
                  }
                  className="gap-2 text-xs text-slate-400 focus:bg-slate-800/60"
                >
                  <XCircle className="size-3" />
                  Unassign pillar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Delete (red, with confirmation dialog) */}
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

        {/* Confirmation dialog for delete / unschedule */}
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
                    Delete {selectedCount} idea
                    {selectedCount === 1 ? '' : 's'}?
                  </>
                ) : (
                  <>
                    <X className="size-4 text-amber-400" />
                    Unschedule {selectedCount} idea
                    {selectedCount === 1 ? '' : 's'}?
                  </>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-slate-400">
                {confirmDialog === 'delete'
                  ? 'This will permanently delete the selected ideas along with their scripts, scenes, voice tracks, video projects, policy reviews, uploads, research sources, and claim ledger entries. This action cannot be undone.'
                  : 'This will clear the scheduled date on all selected ideas. Their other data will be preserved.'}
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
                  } else if (confirmDialog === 'unschedule') {
                    onExecute('unschedule')
                  }
                }}
                className={cn(
                  confirmDialog === 'delete'
                    ? 'border border-rose-500/50 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 hover:text-rose-100'
                    : 'border border-amber-500/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 hover:text-amber-100',
                )}
              >
                {confirmDialog === 'delete' ? 'Delete' : 'Unschedule'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  )
}

export default IdeaExplorer
