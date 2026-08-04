'use client'

// ───────────────────────────────────────────────────────────────────
// Agent Decision Log
//
// A unified timeline of every autonomous decision the agent has made:
// niche selection, content pillar creation, video idea generation,
// script writing, video approval/rejection, strategy reviews, uploads,
// emergency stops, mode changes, etc.
//
// Data: GET /api/data/decisions?category=<cat>&limit=<n>
// Polls every 30s for fresh data. Debounced (200ms) title/description
// search. "Load more" reveals +50 at a time.
//
// Palette: violet / cyan / emerald / amber / rose / fuchsia / slate / red
// (NO indigo, NO blue primary).
//
//   <DecisionLog className="..." />
// ───────────────────────────────────────────────────────────────────

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, isToday, isYesterday, isSameDay, parseISO } from 'date-fns'
import {
  Brain,
  Calendar,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  GitCommit,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types (mirror /api/data/decisions) ────────────────────────────

export type DecisionCategory =
  | 'niche'
  | 'strategy'
  | 'content'
  | 'production'
  | 'review'
  | 'upload'
  | 'system'
  | 'mode'

export interface Decision {
  id: string
  timestamp: string
  category: DecisionCategory
  decisionType: string
  title: string
  description: string
  reasoning?: string
  targetId?: string
  targetType?: string
  impact: 'high' | 'medium' | 'low'
  metadata?: Record<string, any>
}

interface DecisionCounts {
  total: number
  byCategory: Record<string, number>
  last24h: number
  last7d: number
}

interface DecisionsResponse {
  decisions: Decision[]
  counts: DecisionCounts
}

interface DecisionLogProps {
  className?: string
}

// ─── Constants ─────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000
const DEBOUNCE_MS = 200
const PAGE_SIZE = 50

type FilterKind = 'all' | DecisionCategory

interface CategoryMeta {
  /** Pill background gradient (from/to). */
  gradient: string
  /** Active pill background classes. */
  activeBg: string
  /** Active pill text color. */
  activeText: string
  /** Inactive pill text color. */
  text: string
  /** Timeline dot background. */
  dotBg: string
  /** Timeline dot ring (subtle glow). */
  dotRing: string
  /** Decision-type chip background. */
  chipBg: string
  /** Decision-type chip text color. */
  chipText: string
  /** Vertical accent bar on the timeline row. */
  accentBar: string
  /** Lucide icon for the chip / stat. */
  Icon: LucideIcon
}

const CATEGORY_META: Record<DecisionCategory, CategoryMeta> = {
  niche: {
    gradient: 'from-violet-500 to-fuchsia-500',
    activeBg: 'bg-violet-500/15',
    activeText: 'text-violet-200',
    text: 'text-violet-300',
    dotBg: 'bg-violet-500',
    dotRing: 'ring-violet-500/30',
    chipBg: 'bg-violet-500/15',
    chipText: 'text-violet-300',
    accentBar: 'before:bg-violet-500/60',
    Icon: Target,
  },
  strategy: {
    gradient: 'from-cyan-500 to-teal-500',
    activeBg: 'bg-cyan-500/15',
    activeText: 'text-cyan-200',
    text: 'text-cyan-300',
    dotBg: 'bg-cyan-500',
    dotRing: 'ring-cyan-500/30',
    chipBg: 'bg-cyan-500/15',
    chipText: 'text-cyan-300',
    accentBar: 'before:bg-cyan-500/60',
    Icon: TrendingUp,
  },
  content: {
    gradient: 'from-emerald-500 to-green-500',
    activeBg: 'bg-emerald-500/15',
    activeText: 'text-emerald-200',
    text: 'text-emerald-300',
    dotBg: 'bg-emerald-500',
    dotRing: 'ring-emerald-500/30',
    chipBg: 'bg-emerald-500/15',
    chipText: 'text-emerald-300',
    accentBar: 'before:bg-emerald-500/60',
    Icon: Sparkles,
  },
  production: {
    gradient: 'from-amber-500 to-orange-500',
    activeBg: 'bg-amber-500/15',
    activeText: 'text-amber-200',
    text: 'text-amber-300',
    dotBg: 'bg-amber-500',
    dotRing: 'ring-amber-500/30',
    chipBg: 'bg-amber-500/15',
    chipText: 'text-amber-300',
    accentBar: 'before:bg-amber-500/60',
    Icon: GitCommit,
  },
  review: {
    gradient: 'from-rose-500 to-pink-500',
    activeBg: 'bg-rose-500/15',
    activeText: 'text-rose-200',
    text: 'text-rose-300',
    dotBg: 'bg-rose-500',
    dotRing: 'ring-rose-500/30',
    chipBg: 'bg-rose-500/15',
    chipText: 'text-rose-300',
    accentBar: 'before:bg-rose-500/60',
    Icon: Eye,
  },
  upload: {
    gradient: 'from-fuchsia-500 to-purple-500',
    activeBg: 'bg-fuchsia-500/15',
    activeText: 'text-fuchsia-200',
    text: 'text-fuchsia-300',
    dotBg: 'bg-fuchsia-500',
    dotRing: 'ring-fuchsia-500/30',
    chipBg: 'bg-fuchsia-500/15',
    chipText: 'text-fuchsia-300',
    accentBar: 'before:bg-fuchsia-500/60',
    Icon: Upload,
  },
  system: {
    gradient: 'from-slate-500 to-slate-400',
    activeBg: 'bg-slate-500/15',
    activeText: 'text-slate-200',
    text: 'text-slate-300',
    dotBg: 'bg-slate-400',
    dotRing: 'ring-slate-400/30',
    chipBg: 'bg-slate-500/15',
    chipText: 'text-slate-300',
    accentBar: 'before:bg-slate-400/60',
    Icon: Brain,
  },
  mode: {
    gradient: 'from-red-500 to-rose-500',
    activeBg: 'bg-red-500/15',
    activeText: 'text-red-200',
    text: 'text-red-300',
    dotBg: 'bg-red-500',
    dotRing: 'ring-red-500/30',
    chipBg: 'bg-red-500/15',
    chipText: 'text-red-300',
    accentBar: 'before:bg-red-500/60',
    Icon: Brain,
  },
}

const FILTERS: { id: FilterKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'niche', label: 'Niche' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'content', label: 'Content' },
  { id: 'production', label: 'Production' },
  { id: 'review', label: 'Review' },
  { id: 'upload', label: 'Upload' },
  { id: 'system', label: 'System' },
  { id: 'mode', label: 'Mode' },
]

const IMPACT_META: Record<
  'high' | 'medium' | 'low',
  { bg: string; text: string; border: string; label: string }
> = {
  high: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-500/40',
    label: 'HIGH',
  },
  medium: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    label: 'MEDIUM',
  },
  low: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-500/40',
    label: 'LOW',
  },
}

// ─── Skeleton ──────────────────────────────────────────────────────
function TimelineSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.25 }}
          className="relative pl-8"
        >
          <div className="absolute left-[10px] top-3 h-2.5 w-2.5 rounded-full bg-slate-800 animate-pulse" />
          <div className="absolute left-[15px] top-6 bottom-[-12px] w-px bg-slate-800/40" />
          <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 rounded-md bg-slate-800/80 animate-pulse" />
              <div className="h-5 w-24 rounded-md bg-slate-800/60 animate-pulse" />
              <div className="ml-auto h-4 w-12 rounded-full bg-slate-800/60 animate-pulse" />
            </div>
            <div className="h-3.5 w-3/4 rounded bg-slate-800/60 animate-pulse" />
            <div className="h-3 w-full rounded bg-slate-800/40 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-slate-800/30 animate-pulse" />
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────
function StatCard({
  Icon,
  label,
  value,
  sub,
  iconBg,
  iconText,
}: {
  Icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  iconBg: string
  iconText: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-4 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={cn('rounded-lg p-1.5', iconBg)}>
          <Icon className={cn('w-3.5 h-3.5', iconText)} />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-100 tabular-nums tracking-tight">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-0.5">
        {label}
      </div>
      {sub && (
        <div className="text-[11px] text-slate-400 mt-1 truncate">{sub}</div>
      )}
    </motion.div>
  )
}

// ─── Date separator ────────────────────────────────────────────────
function dateLabel(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE MMM d')
}

// ─── Timeline row ──────────────────────────────────────────────────
function TimelineRow({
  decision,
  index,
  isLastInDay,
}: {
  decision: Decision
  index: number
  isLastInDay: boolean
}) {
  const meta = CATEGORY_META[decision.category] ?? CATEGORY_META.system
  const impact = IMPACT_META[decision.impact] ?? IMPACT_META.low
  const ts = parseISO(decision.timestamp)
  const Icon = meta.Icon
  const targetHref = decision.targetType
    ? `/${decision.targetType}/${decision.targetId ?? ''}`
    : undefined

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
      className="relative pl-8"
    >
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-[9px] top-3 h-3 w-3 rounded-full ring-2',
          meta.dotBg,
          meta.dotRing,
          'ring-offset-1 ring-offset-slate-950'
        )}
      >
        <div
          className={cn(
            'absolute inset-0 rounded-full animate-ping opacity-30',
            meta.dotBg
          )}
        />
      </div>
      {/* Vertical connector */}
      {!isLastInDay && (
        <div className="absolute left-[15px] top-6 bottom-[-12px] w-px bg-gradient-to-b from-slate-700/50 to-slate-800/20" />
      )}

      {/* Card */}
      <div
        className={cn(
          'group relative rounded-xl bg-slate-900/60 border border-slate-800/60 p-3.5',
          'transition-all duration-200 hover:bg-slate-900/80 hover:border-slate-700/60',
          'before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-full',
          meta.accentBar
        )}
      >
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {/* Decision type chip */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              meta.chipBg,
              meta.chipText
            )}
          >
            <Icon className="w-2.5 h-2.5" />
            {decision.decisionType}
          </span>
          {/* Timestamp */}
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 tabular-nums">
            <Clock className="w-2.5 h-2.5" />
            {format(ts, 'HH:mm')}
          </span>
          {/* Impact badge */}
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wider',
              impact.bg,
              impact.text,
              impact.border
            )}
          >
            {impact.label}
          </span>
        </div>

        {/* Title */}
        <div className="text-sm font-medium text-slate-100 leading-snug">
          {decision.title}
        </div>

        {/* Description */}
        <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
          {decision.description}
        </p>

        {/* Reasoning blockquote */}
        {decision.reasoning && (
          <blockquote
            className={cn(
              'mt-2 border-l-2 pl-2.5 py-1 text-[11px] italic',
              meta.chipText,
              'border-current opacity-80'
            )}
          >
            “{decision.reasoning}”
          </blockquote>
        )}

        {/* Footer: target link + metadata chips */}
        {(targetHref || decision.metadata) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {targetHref && (
              <a
                href={targetHref}
                onClick={(e) => e.preventDefault()}
                className={cn(
                  'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]',
                  'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
                  'transition-colors'
                )}
              >
                <span className="opacity-70">
                  {decision.targetType}:{' '}
                </span>
                <span className="font-mono">
                  {decision.targetId?.slice(-8) ?? ''}
                </span>
                <ChevronRight className="w-2.5 h-2.5 opacity-50 group-hover:translate-x-0.5 transition-transform" />
              </a>
            )}
            {decision.metadata?.compositeScore != null && (
              <span className="inline-flex items-center gap-0.5 rounded bg-slate-800/50 px-1.5 py-0.5 text-[10px] text-slate-400">
                <Target className="w-2.5 h-2.5" />
                score{' '}
                {Number(decision.metadata.compositeScore).toFixed(1)}
              </span>
            )}
            {Array.isArray(decision.metadata?.tags) &&
              decision.metadata.tags.length > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded bg-slate-800/50 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {decision.metadata.tags.slice(0, 2).join(' · ')}
                  {decision.metadata.tags.length > 2 &&
                    ` +${decision.metadata.tags.length - 2}`}
                </span>
              )}
            {typeof decision.metadata?.issueCount === 'number' &&
              decision.metadata.issueCount > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300">
                  {decision.metadata.issueCount} issue
                  {decision.metadata.issueCount === 1 ? '' : 's'}
                </span>
              )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────
export function DecisionLog({ className }: DecisionLogProps) {
  const [data, setData] = React.useState<DecisionsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<FilterKind>('all')
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)

  // ── Fetch ──
  const fetchData = React.useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      try {
        const url = new URL('/api/data/decisions', window.location.origin)
        // Fetch a large batch (200) so client-side filter/search + load more work.
        url.searchParams.set('limit', '200')
        if (filter !== 'all') url.searchParams.set('category', filter)
        const res = await fetch(url.toString(), { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const json: DecisionsResponse = await res.json()
        setData(json)
        setLastUpdated(new Date())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [filter]
  )

  // ── Initial fetch + filter-change refetch ──
  React.useEffect(() => {
    fetchData(false)
    setVisibleCount(PAGE_SIZE)
  }, [fetchData])

  // ── Poll every 30s ──
  React.useEffect(() => {
    const id = setInterval(() => fetchData(true), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchData])

  // ── Debounced search (200ms) ──
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [search])

  // ── Filtered + searched + limited decisions ──
  const filtered = React.useMemo(() => {
    if (!data?.decisions) return []
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return data.decisions
    return data.decisions.filter((d) => {
      return (
        d.title.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.decisionType.toLowerCase().includes(q)
      )
    })
  }, [data, debouncedSearch])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visible.length < filtered.length

  // ── Group by day for separators ──
  type Group = { dayKey: string; label: string; items: Decision[] }
  const groups: Group[] = React.useMemo(() => {
    const map = new Map<string, Group>()
    for (const d of visible) {
      const ts = parseISO(d.timestamp)
      const key = format(ts, 'yyyy-MM-dd')
      if (!map.has(key)) {
        map.set(key, {
          dayKey: key,
          label: dateLabel(ts),
          items: [],
        })
      }
      map.get(key)!.items.push(d)
    }
    return Array.from(map.values())
  }, [visible])

  // ── Most active category ──
  const mostActiveCategory = React.useMemo(() => {
    if (!data?.counts?.byCategory) return null
    const entries = Object.entries(data.counts.byCategory).sort(
      (a, b) => b[1] - a[1]
    )
    if (entries.length === 0 || entries[0][1] === 0) return null
    return entries[0] // [cat, count]
  }, [data])

  // ── Per-filter counts (for the pill badges) ──
  const filterCounts = React.useMemo(() => {
    const base = data?.counts?.byCategory ?? {}
    return {
      all: data?.counts?.total ?? 0,
      ...base,
    } as Record<FilterKind, number>
  }, [data])

  // ── Render ──
  return (
    <div className={cn('space-y-4', className)}>
      {/* ─── Header row ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-400" />
            Agent Decision Log
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every autonomous choice the agent has made
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {lastUpdated && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {format(lastUpdated, 'HH:mm:ss')}
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]',
              'border border-slate-800/60 bg-slate-900/60 text-slate-400',
              'hover:border-slate-700 hover:text-slate-200 transition-colors',
              refreshing && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Refresh decisions"
          >
            <RefreshCw
              className={cn('w-3 h-3', refreshing && 'animate-spin')}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── Stats row ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          Icon={Brain}
          label="Total Decisions"
          value={data?.counts?.total ?? '—'}
          sub={error ? 'Failed to load' : undefined}
          iconBg="bg-violet-500/15"
          iconText="text-violet-400"
        />
        <StatCard
          Icon={Clock}
          label="Last 24h"
          value={data?.counts?.last24h ?? '—'}
          sub={data ? `${Math.round((data.counts.last24h / Math.max(data.counts.total, 1)) * 100)}% of total` : undefined}
          iconBg="bg-cyan-500/15"
          iconText="text-cyan-400"
        />
        <StatCard
          Icon={Calendar}
          label="Last 7d"
          value={data?.counts?.last7d ?? '—'}
          sub={data ? `${Math.round((data.counts.last7d / Math.max(data.counts.total, 1)) * 100)}% of total` : undefined}
          iconBg="bg-emerald-500/15"
          iconText="text-emerald-400"
        />
        <StatCard
          Icon={TrendingUp}
          label="Most Active"
          value={
            mostActiveCategory
              ? mostActiveCategory[0].charAt(0).toUpperCase() +
                mostActiveCategory[0].slice(1)
              : '—'
          }
          sub={
            mostActiveCategory
              ? `${mostActiveCategory[1]} decision${
                  mostActiveCategory[1] === 1 ? '' : 's'
                }`
              : undefined
          }
          iconBg="bg-amber-500/15"
          iconText="text-amber-400"
        />
      </div>

      {/* ─── Filter pills + search ─── */}
      <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3 h-3 text-slate-500 mr-1 shrink-0" />
          {FILTERS.map((f) => {
            const isActive = filter === f.id
            const count = filterCounts[f.id] ?? 0
            const meta =
              f.id !== 'all' ? CATEGORY_META[f.id as DecisionCategory] : null
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  'transition-colors duration-200',
                  isActive
                    ? meta
                      ? cn(meta.activeBg, meta.activeText)
                      : 'bg-slate-700/70 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                )}
                aria-pressed={isActive}
              >
                {isActive && (
                  <motion.span
                    layoutId="decision-filter-pill"
                    className={cn(
                      'absolute inset-0 rounded-full bg-gradient-to-r opacity-20',
                      meta ? meta.gradient : 'from-slate-500 to-slate-400'
                    )}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative z-10">{f.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'relative z-10 rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums',
                      isActive
                        ? 'bg-slate-950/40 text-current'
                        : 'bg-slate-800/80 text-slate-400'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search box */}
        <div className="relative lg:ml-auto lg:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setVisibleCount(PAGE_SIZE) // reset pagination on search
            }}
            placeholder="Search decisions…"
            className={cn(
              'w-full rounded-md border border-slate-800/60 bg-slate-900/60 py-1.5 pl-8 pr-7 text-[12px] text-slate-200',
              'placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-slate-900/80',
              'transition-colors'
            )}
            aria-label="Search decisions"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Timeline ─── */}
      <div
        className={cn(
          'rounded-xl bg-slate-950/40 border border-slate-800/50 p-4',
          'max-h-[70vh] overflow-y-auto',
          // Custom scrollbar (webkit + firefox)
          '[scrollbar-width:thin] [scrollbar-color:rgb(51,65,85)_transparent]',
          '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700/60',
          '[&::-webkit-scrollbar-thumb:hover]:bg-slate-600/80'
        )}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-rose-500/15 p-3 mb-3">
              <X className="w-5 h-5 text-rose-400" />
            </div>
            <p className="text-sm font-medium text-rose-300">
              Failed to load decisions
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">{error}</p>
            <button
              onClick={() => fetchData(false)}
              className="mt-3 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Try again
            </button>
          </div>
        ) : loading && !data ? (
          <TimelineSkeleton count={6} />
        ) : !data || data.decisions.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative">
              <div className="absolute -inset-6 rounded-full bg-violet-500/10 blur-2xl" />
              <div className="relative rounded-full bg-slate-900/80 border border-slate-800 p-4">
                <Brain className="w-6 h-6 text-violet-400" />
              </div>
            </div>
            <p className="text-sm font-medium text-slate-300 mt-4">
              No decisions yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Run initial setup to start the autonomous cycle. Decisions will
              appear here as the agent selects niches, generates ideas, and
              produces videos.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          /* ── Search-empty state ── */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-slate-800/60 p-3 mb-3">
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              No decisions match “{search}”
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Try a different search term or clear the filter.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {groups.map((group) => (
              <div key={group.dayKey} className="mb-2 last:mb-0">
                {/* Date separator */}
                <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-2 bg-slate-950/85 backdrop-blur-sm px-1 py-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                    {group.label}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {group.items.length} decision
                    {group.items.length === 1 ? '' : 's'}
                  </span>
                  <div className="ml-auto h-px flex-1 bg-gradient-to-r from-slate-800/60 to-transparent" />
                </div>

                <div className="space-y-3">
                  {group.items.map((d, idx) => (
                    <TimelineRow
                      key={d.id}
                      decision={d}
                      index={idx}
                      isLastInDay={idx === group.items.length - 1}
                    />
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>
        )}

        {/* ── Load more ── */}
        {hasMore && !loading && (
          <div className="flex justify-center mt-4 pt-3 border-t border-slate-800/40">
            <button
              onClick={() =>
                setVisibleCount((c) => c + PAGE_SIZE)
              }
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium',
                'border border-slate-800/60 bg-slate-900/60 text-slate-300',
                'hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-200',
                'transition-colors'
              )}
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
              <span className="text-slate-500">
                ({visible.length} of {filtered.length})
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Footer hint ─── */}
      <div className="flex items-center justify-between text-[10px] text-slate-600">
        <span>
          {filtered.length} decision{filtered.length === 1 ? '' : 's'}
          {filter !== 'all' && ` · filtered by ${filter}`}
          {debouncedSearch && ` · matching “${debouncedSearch}”`}
        </span>
        <span>Auto-refreshes every 30s</span>
      </div>
    </div>
  )
}

export default DecisionLog
