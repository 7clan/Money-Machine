'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { LogListSkeleton } from '@/components/agent/skeletons'
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Filter,
  Hash,
  Inbox,
  Minus,
  RefreshCcw,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Square,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  /** Raw action key like 'emergency_stop', 'upload', etc. */
  action: string
  /** 'system' | 'agent' | 'user' (kept permissive to tolerate unknowns) */
  actor: string
  target?: string | null
  /** JSON string with { message, detail, target } OR a plain string. */
  details?: string | null
  createdAt: string
}

export interface ActivityFeedProps {
  logs: AuditLogEntry[]
  isLoading?: boolean
  onRefresh?: () => void
  className?: string
  /** Cap on rendered items (full filtered set is still counted for stats). */
  maxItems?: number
}

// ─── Action category config ───────────────────────────────────────────

type ActionCategory =
  | 'emergency_stop'
  | 'upload'
  | 'strategy'
  | 'mode_change'
  | 'metadata_update'
  | 'event'

interface ActionMeta {
  Icon: LucideIcon
  label: string
  /** Badge background/text/border classes. */
  badge: string
  /** Icon container background. */
  iconBg: string
  /** Icon stroke color. */
  iconText: string
  /** Soft ring color around the icon container. */
  ring: string
  /** Accent for the left border stripe on the row. */
  accent: string
}

const ACTION_META: Record<ActionCategory, ActionMeta> = {
  emergency_stop: {
    Icon: Square,
    label: 'E-STOP',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    iconBg: 'bg-rose-500/15',
    iconText: 'text-rose-400',
    ring: 'ring-rose-500/20',
    accent: 'before:bg-rose-500/60',
  },
  upload: {
    Icon: Upload,
    label: 'UPLOAD',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    iconBg: 'bg-cyan-500/15',
    iconText: 'text-cyan-400',
    ring: 'ring-cyan-500/20',
    accent: 'before:bg-cyan-500/60',
  },
  strategy: {
    Icon: Target,
    label: 'STRATEGY',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    iconBg: 'bg-violet-500/15',
    iconText: 'text-violet-400',
    ring: 'ring-violet-500/20',
    accent: 'before:bg-violet-500/60',
  },
  mode_change: {
    Icon: Settings2,
    label: 'MODE',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    iconBg: 'bg-amber-500/15',
    iconText: 'text-amber-400',
    ring: 'ring-amber-500/20',
    accent: 'before:bg-amber-500/60',
  },
  metadata_update: {
    Icon: RefreshCw,
    label: 'UPDATE',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    iconBg: 'bg-emerald-500/15',
    iconText: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    accent: 'before:bg-emerald-500/60',
  },
  event: {
    Icon: Activity,
    label: 'EVENT',
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    iconBg: 'bg-slate-500/15',
    iconText: 'text-slate-400',
    ring: 'ring-slate-500/20',
    accent: 'before:bg-slate-500/60',
  },
}

function categorizeAction(action: string): ActionCategory {
  const a = (action || '').toLowerCase()
  if (!a) return 'event'
  if (a === 'emergency_stop' || a.includes('emergency') || a.includes('estop') || a.includes('e_stop'))
    return 'emergency_stop'
  if (a === 'upload' || a.includes('upload')) return 'upload'
  if (a.includes('strategy')) return 'strategy'
  if (a.includes('mode_change') || a.includes('mode') || a.includes('operating_mode'))
    return 'mode_change'
  if (a.includes('metadata') || a.includes('update')) return 'metadata_update'
  return 'event'
}

// ─── Actor config ─────────────────────────────────────────────────────

type ActorKind = 'system' | 'agent' | 'user' | 'other'

interface ActorMeta {
  Icon: LucideIcon
  badge: string
  label: string
}

const ACTOR_META: Record<ActorKind, ActorMeta> = {
  system: {
    Icon: Cpu,
    badge: 'bg-slate-700/40 text-slate-300 border-slate-600/50',
    label: 'system',
  },
  agent: {
    Icon: Bot,
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    label: 'agent',
  },
  user: {
    Icon: User,
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    label: 'user',
  },
  other: {
    Icon: Server,
    badge: 'bg-slate-700/40 text-slate-300 border-slate-600/50',
    label: 'other',
  },
}

function classifyActor(actor: string): ActorKind {
  const a = (actor || '').toLowerCase()
  if (a === 'system' || a === 'agent' || a === 'user') return a
  return 'other'
}

// ─── Helpers ──────────────────────────────────────────────────────────

interface ParsedDetails {
  message: string
  detail: string | null
  target: string | null
  raw: unknown
}

function parseDetails(entry: AuditLogEntry): ParsedDetails {
  let message = ''
  let detail: string | null = null
  let target: string | null = entry.target ?? null
  let raw: unknown = null

  if (entry.details) {
    try {
      const parsed = JSON.parse(entry.details)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>
        message = typeof obj.message === 'string' ? obj.message : ''
        if (obj.detail != null) detail = String(obj.detail)
        if (typeof obj.target === 'string' && obj.target) target = obj.target
        raw = parsed
      } else {
        message = String(parsed)
        raw = parsed
      }
    } catch {
      message = String(entry.details)
      raw = entry.details
    }
  }

  if (!message) {
    const cat = categorizeAction(entry.action)
    const label = ACTION_META[cat].label
    message = `${label.charAt(0)}${label.slice(1).toLowerCase()} action recorded`
  }

  return { message, detail, target, raw }
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function relativeTime(date: Date | null): string {
  if (!date) return '—'
  const diff = Date.now() - date.getTime()
  const sec = Math.max(0, Math.floor(diff / 1000))
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function shortId(id: string | null | undefined): string | null {
  if (!id) return null
  const trimmed = id.trim()
  if (!trimmed) return null
  return trimmed.length > 6 ? trimmed.slice(-6) : trimmed
}

type TimeRange = '1h' | '24h' | '7d' | 'all'

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  all: Number.POSITIVE_INFINITY,
}

const HOUR_MS = 60 * 60 * 1000

// ─── Custom scrollbar styles (self-contained) ─────────────────────────

const CUSTOM_SCROLL_CSS = `
.custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.2); border-radius: 3px; }
.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.4); }
.custom-scroll { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.25) transparent; }
`

// ─── Animation variants ───────────────────────────────────────────────

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.04 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 26 },
  },
}

// ─── Filter option lists ──────────────────────────────────────────────

type ActionFilterValue = 'all' | ActionCategory
type ActorFilterValue = 'all' | 'system' | 'agent' | 'user'

const ACTION_FILTER_OPTIONS: { value: ActionFilterValue; label: string }[] = [
  { value: 'all', label: 'All actions' },
  { value: 'emergency_stop', label: 'Emergency Stop' },
  { value: 'upload', label: 'Upload' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'mode_change', label: 'Mode Change' },
  { value: 'metadata_update', label: 'Metadata Update' },
]

const ACTOR_FILTER_OPTIONS: { value: ActorFilterValue; label: string }[] = [
  { value: 'all', label: 'All actors' },
  { value: 'system', label: 'System' },
  { value: 'agent', label: 'Agent' },
  { value: 'user', label: 'User' },
]

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'all', label: 'All time' },
]

const REFRESH_INTERVAL_MS = 30_000

// ─── Main component ───────────────────────────────────────────────────

export function ActivityFeed({
  logs,
  isLoading = false,
  onRefresh,
  className,
  maxItems = 50,
}: ActivityFeedProps) {
  // Filter state
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<ActionFilterValue>('all')
  const [actorFilter, setActorFilter] = useState<ActorFilterValue>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')

  // Expand state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(
    () => new Date()
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Memoized enrichment: parse every log entry once per logs change.
  const enriched = useMemo(() => {
    return logs.map((entry) => {
      const parsed = parseDetails(entry)
      const category = categorizeAction(entry.action)
      const actor = classifyActor(entry.actor)
      const date = toDate(entry.createdAt)
      return { entry, parsed, category, actor, date }
    })
  }, [logs])

  // Apply all filters (search + action + actor + time range) — no cap.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rangeMs = RANGE_MS[timeRange]
    const now = Date.now()

    return enriched.filter(({ entry, parsed, category, actor, date }) => {
      // Time range
      if (date && now - date.getTime() > rangeMs) return false

      // Action category
      if (actionFilter !== 'all' && category !== actionFilter) return false

      // Actor
      if (actorFilter !== 'all') {
        if (actor !== actorFilter) return false
      }

      // Search (case-insensitive across message + detail + target + action + actor)
      if (q) {
        const haystack = [
          parsed.message,
          parsed.detail ?? '',
          parsed.target ?? '',
          entry.target ?? '',
          entry.action,
          entry.actor,
          ACTION_META[category].label,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [enriched, search, actionFilter, actorFilter, timeRange])

  // Cap visible items for render performance (virtualization-friendly).
  const visible = useMemo(
    () => filtered.slice(0, Math.max(1, maxItems)),
    [filtered, maxItems]
  )

  // Stats computed from the full filtered set (pre-cap).
  const stats = useMemo(() => {
    const total = filtered.length
    const now = Date.now()

    const lastHour = filtered.filter(
      (e) => e.date && now - e.date.getTime() <= HOUR_MS
    ).length
    const prevHour = enriched.filter((e) => {
      if (!e.date) return false
      const diff = now - e.date.getTime()
      return diff > HOUR_MS && diff <= 2 * HOUR_MS
    }).length

    const trend = lastHour - prevHour

    // Most active category
    const counts = new Map<ActionCategory, number>()
    for (const e of filtered) {
      counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
    }
    let topCat: ActionCategory | null = null
    let topCount = 0
    for (const [cat, n] of counts) {
      if (n > topCount) {
        topCount = n
        topCat = cat
      }
    }
    const topPct = total > 0 && topCat ? Math.round((topCount / total) * 100) : 0

    return { total, lastHour, prevHour, trend, topCat, topCount, topPct }
  }, [filtered, enriched])

  // Auto-refresh effect
  const handleRefresh = useCallback(() => {
    if (!onRefresh) return
    setIsRefreshing(true)
    try {
      onRefresh()
    } finally {
      setLastRefreshed(new Date())
      // Brief visual feedback; non-blocking.
      window.setTimeout(() => setIsRefreshing(false), 450)
    }
  }, [onRefresh])

  useEffect(() => {
    if (!autoRefresh || !onRefresh) {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current)
        refreshTimer.current = null
      }
      return
    }
    refreshTimer.current = setInterval(() => {
      handleRefresh()
    }, REFRESH_INTERVAL_MS)
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current)
        refreshTimer.current = null
      }
    }
  }, [autoRefresh, onRefresh, handleRefresh])

  // Reset expansion when filtered set changes substantially (new ids only).
  useEffect(() => {
    setExpanded((prev) => {
      const next: Record<string, boolean> = {}
      for (const e of filtered) {
        if (prev[e.entry.id]) next[e.entry.id] = true
      }
      return next
    })
  }, [filtered])

  const toggle = useCallback((id: string) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }))
  }, [])

  const hasAnyLogs = logs.length > 0
  const hasFiltered = filtered.length > 0
  const showingCapped = visible.length < filtered.length

  return (
    <div
      className={cn(
        'relative rounded-xl bg-slate-900/60 border border-slate-800/60 backdrop-blur-sm text-slate-100',
        className
      )}
    >
      {/* Inject custom scrollbar styles (scoped to .custom-scroll) */}
      <style dangerouslySetInnerHTML={{ __html: CUSTOM_SCROLL_CSS }} />

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap p-4 sm:p-5 border-b border-slate-800/60">
        <div className="min-w-0 space-y-1">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <span className="size-7 rounded-md bg-gradient-to-br from-violet-500/20 to-cyan-500/20 ring-1 ring-violet-500/20 flex items-center justify-center">
              <Activity className="size-4 text-violet-300" />
            </span>
            Activity Feed
          </h3>
          <p className="text-xs text-slate-400">
            Live audit trail of agent actions, uploads, and strategy changes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-2 rounded-md border border-slate-800/60 bg-slate-950/40 px-3 py-1.5">
            <span className="text-xs text-slate-400">Auto-refresh</span>
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              aria-label="Toggle auto-refresh"
              className="data-[state=checked]:bg-violet-500 data-[state=unchecked]:bg-slate-700"
            />
            <span className="text-[10px] text-slate-500 tabular-nums w-8">
              {autoRefresh ? '30s' : 'off'}
            </span>
          </div>

          {/* Manual refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={!onRefresh || isRefreshing}
            className="h-8 bg-slate-950/40 border-slate-700/60 text-slate-200 hover:bg-slate-800/60 hover:text-white"
          >
            <RefreshCcw
              className={cn('size-3.5', isRefreshing && 'animate-spin')}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* ── Stats summary ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 sm:p-5 border-b border-slate-800/60">
        <StatTile
          label="Events in view"
          value={stats.total}
          icon={<Hash className="size-4" />}
          tone="slate"
          hint={
            lastRefreshed
              ? `Updated ${relativeTime(lastRefreshed)}`
              : undefined
          }
        />
        <StatTile
          label="Last hour"
          value={stats.lastHour}
          icon={<Clock className="size-4" />}
          tone="cyan"
          trend={stats.trend}
          trendHint={
            stats.prevHour > 0 || stats.lastHour > 0
              ? `vs ${stats.prevHour} prev hour`
              : 'no prior-hour data'
          }
        />
        <StatTile
          label="Most active"
          value={
            stats.topCat ? ACTION_META[stats.topCat].label : '—'
          }
          icon={
            stats.topCat ? (
              (() => {
                const M = ACTION_META[stats.topCat!]
                const I = M.Icon
                return <I className="size-4" />
              })()
            ) : (
              <Activity className="size-4" />
            )
          }
          tone="violet"
          hint={
            stats.topCat
              ? `${stats.topCount} events · ${stats.topPct}%`
              : 'no events'
          }
        />
      </div>

      {/* ── Filter bar ────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 border-b border-slate-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages, targets, actions…"
              className="pl-9 h-9 bg-slate-950/40 border-slate-700/60 text-slate-100 placeholder:text-slate-500 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 size-5 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"
              >
                <span aria-hidden>×</span>
              </button>
            )}
          </div>

          {/* Action filter */}
          <Select
            value={actionFilter}
            onValueChange={(v) => setActionFilter(v as ActionFilterValue)}
          >
            <SelectTrigger
              size="sm"
              className="h-9 w-full sm:w-[180px] bg-slate-950/40 border-slate-700/60 text-slate-200 data-[placeholder]:text-slate-400"
            >
              <Filter className="size-3.5 text-slate-400" />
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700/70 text-slate-200">
              {ACTION_FILTER_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="focus:bg-slate-800 focus:text-white"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Actor filter */}
          <Select
            value={actorFilter}
            onValueChange={(v) => setActorFilter(v as ActorFilterValue)}
          >
            <SelectTrigger
              size="sm"
              className="h-9 w-full sm:w-[150px] bg-slate-950/40 border-slate-700/60 text-slate-200"
            >
              <SelectValue placeholder="Actor" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700/70 text-slate-200">
              {ACTOR_FILTER_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="focus:bg-slate-800 focus:text-white"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time range filter */}
          <Select
            value={timeRange}
            onValueChange={(v) => setTimeRange(v as TimeRange)}
          >
            <SelectTrigger
              size="sm"
              className="h-9 w-full sm:w-[150px] bg-slate-950/40 border-slate-700/60 text-slate-200"
            >
              <Clock className="size-3.5 text-slate-400" />
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700/70 text-slate-200">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="focus:bg-slate-800 focus:text-white"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active filter summary / clear */}
        {(search ||
          actionFilter !== 'all' ||
          actorFilter !== 'all' ||
          timeRange !== 'all') && (
          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-slate-400">
            <span>Filters:</span>
            {search && (
              <FilterChip
                label={`"${search}"`}
                onClear={() => setSearch('')}
              />
            )}
            {actionFilter !== 'all' && (
              <FilterChip
                label={ACTION_FILTER_OPTIONS.find((o) => o.value === actionFilter)?.label ?? actionFilter}
                onClear={() => setActionFilter('all')}
              />
            )}
            {actorFilter !== 'all' && (
              <FilterChip
                label={ACTOR_FILTER_OPTIONS.find((o) => o.value === actorFilter)?.label ?? actorFilter}
                onClear={() => setActorFilter('all')}
              />
            )}
            {timeRange !== 'all' && (
              <FilterChip
                label={TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label ?? timeRange}
                onClear={() => setTimeRange('all')}
              />
            )}
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setActionFilter('all')
                setActorFilter('all')
                setTimeRange('all')
              }}
              className="text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Feed body ─────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5">
        {isLoading ? (
          <LogListSkeleton count={6} />
        ) : !hasAnyLogs ? (
          <FeedEmptyState
            icon={Inbox}
            title="No activity yet"
            description="Audit log entries from the autonomous agent will appear here once production begins. Trigger a produce-next cycle to populate the feed."
          />
        ) : !hasFiltered ? (
          <FeedEmptyState
            icon={Search}
            title="No events match your filters"
            description="Try widening the time range, clearing the search query, or switching to 'All' for the action and actor filters."
          />
        ) : (
          <>
            {/* Showing X of Y indicator */}
            <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing{' '}
                <span className="text-slate-200 font-medium tabular-nums">
                  {visible.length}
                </span>
                {showingCapped ? (
                  <>
                    {' '}
                    of{' '}
                    <span className="text-slate-200 font-medium tabular-nums">
                      {filtered.length}
                    </span>
                  </>
                ) : null}
                {' '}
                {filtered.length === 1 ? 'event' : 'events'}
              </span>
              {showingCapped && (
                <span className="text-amber-400/80">
                  Showing first {maxItems} — refine filters to narrow
                </span>
              )}
            </div>

            {/* Scrollable list with custom scrollbar */}
            <div className="max-h-[600px] overflow-y-auto custom-scroll pr-1 -mr-1">
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="show"
                className="space-y-2"
              >
                <AnimatePresence initial={false}>
                  {visible.map(({ entry, parsed, category, actor, date }) => (
                    <FeedRow
                      key={entry.id}
                      entry={entry}
                      parsed={parsed}
                      category={category}
                      actor={actor}
                      date={date}
                      expanded={!!expanded[entry.id]}
                      onToggle={() => toggle(entry.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ActivityFeed

// ─── Sub-components ───────────────────────────────────────────────────

interface StatTileProps {
  label: string
  value: number | string
  icon: React.ReactNode
  tone: 'slate' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose'
  hint?: string
  trend?: number
  trendHint?: string
}

function StatTile({
  label,
  value,
  icon,
  tone,
  hint,
  trend,
  trendHint,
}: StatTileProps) {
  const toneMap: Record<StatTileProps['tone'], string> = {
    slate: 'border-slate-700/60 bg-slate-800/30',
    cyan: 'border-cyan-500/30 bg-cyan-500/5',
    violet: 'border-violet-500/30 bg-violet-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    rose: 'border-rose-500/30 bg-rose-500/5',
  }
  const iconToneMap: Record<StatTileProps['tone'], string> = {
    slate: 'bg-slate-700/40 text-slate-300',
    cyan: 'bg-cyan-500/15 text-cyan-300',
    violet: 'bg-violet-500/15 text-violet-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-300',
    rose: 'bg-rose-500/15 text-rose-300',
  }

  const trendIcon =
    trend === undefined ? null : trend > 0 ? (
      <TrendingUp className="size-3 text-emerald-400" />
    ) : trend < 0 ? (
      <TrendingDown className="size-3 text-rose-400" />
    ) : (
      <Minus className="size-3 text-slate-500" />
    )

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 flex items-center gap-3',
        toneMap[tone]
      )}
    >
      <div
        className={cn(
          'size-8 rounded-md flex items-center justify-center shrink-0',
          iconToneMap[tone]
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-slate-400 truncate">
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold leading-tight tabular-nums truncate">
            {value}
          </span>
          {trendIcon}
        </div>
        {hint && (
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            {trendHint && trendIcon ? `${trendHint} · ` : ''}
            {hint}
          </div>
        )}
        {!hint && trendHint && trendIcon && (
          <div className="text-[10px] text-slate-500 truncate mt-0.5">
            {trendHint}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/60 border border-slate-700/60 px-1.5 py-0.5 text-[11px] text-slate-300">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear filter ${label}`}
        className="text-slate-500 hover:text-slate-200"
      >
        ×
      </button>
    </span>
  )
}

interface FeedRowProps {
  entry: AuditLogEntry
  parsed: ParsedDetails
  category: ActionCategory
  actor: ActorKind
  date: Date | null
  expanded: boolean
  onToggle: () => void
}

function FeedRow({
  entry,
  parsed,
  category,
  actor,
  date,
  expanded,
  onToggle,
}: FeedRowProps) {
  const meta = ACTION_META[category]
  const actorMeta = ACTOR_META[actor]
  const Icon = meta.Icon
  const ActorIcon = actorMeta.Icon
  const target = parsed.target ?? entry.target ?? null
  const sid = shortId(target)
  const hasDetail = parsed.raw != null && parsed.raw !== ''

  return (
    <motion.div
      layout
      variants={itemVariants}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'relative rounded-lg border bg-slate-950/40 overflow-hidden',
        'before:content-[""] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5',
        'border-slate-800/60 hover:border-slate-700/80 transition-colors',
        meta.accent
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left p-3 sm:p-3.5 flex items-start gap-3"
      >
        {/* Action icon */}
        <span
          className={cn(
            'size-8 rounded-md flex items-center justify-center shrink-0 ring-1',
            meta.iconBg,
            meta.iconText,
            meta.ring
          )}
        >
          <Icon className="size-4" />
        </span>

        {/* Body */}
        <div className="min-w-0 flex-1">
          {/* Top row: message + chevron */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-slate-100 leading-snug break-words">
              {parsed.message}
            </p>
            <span
              className={cn(
                'shrink-0 mt-0.5 text-slate-500 transition-transform',
                expanded && 'rotate-180'
              )}
            >
              <ChevronDown className="size-4" />
            </span>
          </div>

          {/* Meta row: badges + timestamp */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-semibold tracking-wide border',
                meta.badge
              )}
            >
              {meta.label}
            </Badge>

            <Badge
              variant="outline"
              className={cn(
                'text-[10px] gap-1 border',
                actorMeta.badge
              )}
            >
              <ActorIcon className="size-2.5" />
              {actorMeta.label}
            </Badge>

            {sid && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 bg-slate-800/40 text-slate-300 border-slate-700/60 font-mono"
                title={target ?? undefined}
              >
                <Hash className="size-2.5" />
                {sid}
              </Badge>
            )}

            <span className="text-[10px] text-slate-500 ml-auto flex items-center gap-1 tabular-nums">
              <Clock className="size-2.5" />
              {relativeTime(date)}
            </span>
          </div>
        </div>
      </button>

      {/* Expandable detail panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-slate-800/60"
          >
            <div className="p-3 sm:p-3.5 space-y-3 bg-slate-950/60">
              {/* Metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <DetailField label="Action" value={entry.action} mono />
                <DetailField label="Actor" value={entry.actor} mono />
                <DetailField
                  label="Created"
                  value={date ? date.toISOString() : '—'}
                  mono
                />
                <DetailField
                  label="Target"
                  value={target ?? '—'}
                  mono
                />
              </div>

              {/* Detail string (if present) */}
              {parsed.detail && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    Detail
                  </div>
                  <p className="text-xs text-slate-300 break-words">
                    {parsed.detail}
                  </p>
                </div>
              )}

              {/* Full JSON payload */}
              {hasDetail ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">
                      Raw payload
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] bg-slate-800/40 text-slate-400 border-slate-700/60"
                    >
                      JSON
                    </Badge>
                  </div>
                  <ScrollArea className="max-h-48 rounded-md border border-slate-800/80 bg-slate-950/80">
                    <pre className="text-[11px] leading-relaxed text-slate-300 p-3 font-mono whitespace-pre">
                      {typeof parsed.raw === 'string'
                        ? JSON.stringify(parsed.raw)
                        : JSON.stringify(parsed.raw, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic flex items-center gap-1.5">
                  <ChevronRight className="size-3" />
                  No JSON payload attached to this entry.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 truncate">
        {label}
      </div>
      <div
        className={cn(
          'text-xs text-slate-300 truncate',
          mono && 'font-mono'
        )}
        title={value}
      >
        {value || '—'}
      </div>
    </div>
  )
}

function FeedEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-dashed border-slate-700/60 bg-slate-950/30 p-10 text-center"
    >
      <div className="relative mx-auto mb-4 size-14">
        <motion.span
          className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 ring-1 ring-violet-500/20"
          animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
        <div className="relative size-14 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 ring-1 ring-violet-500/20 flex items-center justify-center">
          <motion.span
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon className="size-6 text-violet-300" />
          </motion.span>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
        {description}
      </p>
    </motion.div>
  )
}
