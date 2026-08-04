'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  HardDrive,
  Loader2,
  RefreshCw,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  AlertTriangle,
  Database,
  type LucideIcon,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────
type Category = 'videos' | 'audio' | 'thumbnails' | 'other'

interface CategoryStats {
  bytes: number
  files: number
  path: string
}

interface LargestFile {
  path: string
  bytes: number
  category: Category
}

interface StorageStats {
  totalBytes: number
  totalFiles: number
  byCategory: Record<Category, CategoryStats>
  largestFiles: LargestFile[]
  quotaBytes: number
  usagePercentage: number
  lastUpdated: string
}

// ─── Helpers ─────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Math.max(0, Date.now() - then)
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const CATEGORY_META: Record<
  Category,
  {
    label: string
    icon: LucideIcon
    text: string
    bar: string
    ring: string
    glow: string
    border: string
  }
> = {
  videos: {
    label: 'Videos',
    icon: Film,
    text: 'text-violet-300',
    bar: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
    ring: 'stroke-violet-500',
    glow: 'from-violet-500/10 to-fuchsia-500/10',
    border: 'border-violet-500/20',
  },
  audio: {
    label: 'Audio',
    icon: Music,
    text: 'text-cyan-300',
    bar: 'bg-gradient-to-r from-cyan-500 to-teal-500',
    ring: 'stroke-cyan-500',
    glow: 'from-cyan-500/10 to-teal-500/10',
    border: 'border-cyan-500/20',
  },
  thumbnails: {
    label: 'Thumbnails',
    icon: ImageIcon,
    text: 'text-emerald-300',
    bar: 'bg-gradient-to-r from-emerald-500 to-lime-500',
    ring: 'stroke-emerald-500',
    glow: 'from-emerald-500/10 to-lime-500/10',
    border: 'border-emerald-500/20',
  },
  other: {
    label: 'Other',
    icon: FileText,
    text: 'text-amber-300',
    bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
    ring: 'stroke-amber-500',
    glow: 'from-amber-500/10 to-orange-500/10',
    border: 'border-amber-500/20',
  },
}

function usageColor(pct: number): { text: string; stroke: string; glow: string; label: string } {
  if (pct >= 80) {
    return {
      text: 'text-rose-300',
      stroke: 'stroke-rose-500',
      glow: 'from-rose-500/10 to-red-500/10',
      label: 'Critical',
    }
  }
  if (pct >= 50) {
    return {
      text: 'text-amber-300',
      stroke: 'stroke-amber-500',
      glow: 'from-amber-500/10 to-orange-500/10',
      label: 'Moderate',
    }
  }
  return {
    text: 'text-emerald-300',
    stroke: 'stroke-emerald-500',
    glow: 'from-emerald-500/10 to-teal-500/10',
    label: 'Healthy',
  }
}

// ─── Circular Progress Ring ──────────────────────────────────────────
function CircularProgress({
  percentage,
  stroke,
  size = 168,
  strokeWidth = 12,
}: {
  percentage: number
  stroke: string
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percentage))
  // Animate via framer-motion pathLength on a separate motion.circle
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-800"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={stroke}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (clamped / 100) * circumference }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-slate-100">
          {clamped.toFixed(clamped < 10 ? 2 : clamped < 100 ? 1 : 0)}%
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
          of quota used
        </span>
      </div>
    </div>
  )
}

// ─── Mini progress bar ───────────────────────────────────────────────
function MiniBar({ pct, gradient }: { pct: number; gradient: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-800/70 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${gradient}`}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────
function StorageSkeleton() {
  return (
    <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800/80 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-28 rounded bg-slate-800/80 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-slate-800/60 animate-pulse" />
            </div>
          </div>
          <div className="h-7 w-20 rounded bg-slate-800/70 animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4 space-y-3"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800/80 animate-pulse" />
              <div className="h-4 w-16 rounded bg-slate-800/80 animate-pulse" />
              <div className="h-2.5 w-full rounded bg-slate-800/60 animate-pulse" />
              <div className="h-2 w-20 rounded bg-slate-800/50 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-32 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Error State ─────────────────────────────────────────────────────
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="bg-slate-900/60 border-rose-500/30 backdrop-blur-sm">
      <CardContent className="py-8">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-rose-200">Failed to load storage stats</p>
            <p className="text-xs text-rose-300/70 mt-1 max-w-sm">{message}</p>
          </div>
          <Button
            onClick={onRetry}
            size="sm"
            variant="outline"
            className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────
function EmptyState() {
  return (
    <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
      <CardContent className="py-10">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Database className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">No data yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Produce videos to see storage usage
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ──────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 60_000

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

export function StorageDashboard() {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0) // bump to refresh "Xs ago" label
  const mountedRef = useRef(true)

  const fetchStats = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    try {
      const res = await fetch('/api/data/storage-stats', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || `HTTP ${res.status}`)
      }
      const data: StorageStats = await res.json()
      if (mountedRef.current) {
        setStats(data)
        setError(null)
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  // Initial + 60s polling
  useEffect(() => {
    mountedRef.current = true
    fetchStats(true)
    const id = setInterval(() => fetchStats(false), REFRESH_INTERVAL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(id)
    }
  }, [fetchStats])

  // Relative-time label updater (every 15s)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  // Reference `tick` so ESLint doesn't complain about unused state
  void tick

  if (loading && !stats) {
    return <StorageSkeleton />
  }

  if (error && !stats) {
    return <ErrorState message={error} onRetry={() => fetchStats(true)} />
  }

  if (!stats) {
    return <StorageSkeleton />
  }

  // Empty state — no files at all
  if (stats.totalBytes === 0) {
    return (
      <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                <HardDrive className="w-4 h-4 text-violet-300" />
              </div>
              <div>
                <CardTitle className="text-sm text-slate-100">Storage Usage</CardTitle>
                <CardDescription className="text-[10px] text-slate-500">
                  Live disk usage from /data
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchStats(false)}
              disabled={refreshing}
              className="border-slate-700 text-slate-300 hover:bg-slate-800/60 h-7 text-[10px]"
            >
              <RefreshCw className={refreshing ? 'w-3 h-3 mr-1 animate-spin' : 'w-3 h-3 mr-1'} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyState />
        </CardContent>
      </Card>
    )
  }

  const u = usageColor(stats.usagePercentage)
  const categories: Category[] = ['videos', 'audio', 'thumbnails', 'other']

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      <Card className={`bg-slate-900/60 border-slate-800/60 backdrop-blur-sm relative overflow-hidden`}>
        {/* Glow background */}
        <div
          className={`pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br ${u.glow} blur-3xl opacity-60`}
          aria-hidden="true"
        />
        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-slate-700/60 flex items-center justify-center">
                <HardDrive className="w-4 h-4 text-violet-300" />
              </div>
              <div>
                <CardTitle className="text-sm text-slate-100">Storage Usage</CardTitle>
                <CardDescription className="text-[10px] text-slate-500">
                  {stats.totalFiles} files · last updated {formatRelativeTime(stats.lastUpdated)}
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchStats(false)}
              disabled={refreshing}
              className="border-slate-700 text-slate-300 hover:bg-slate-800/60 h-7 text-[10px]"
            >
              {refreshing ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3 mr-1" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 relative">
          {/* Main usage card */}
          <motion.div
            variants={itemVariants}
            className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4 sm:p-5"
          >
            <div className="flex flex-col md:flex-row items-center gap-5">
              <CircularProgress
                percentage={stats.usagePercentage}
                stroke={u.stroke}
              />
              <div className="flex-1 w-full text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <p className="text-2xl font-bold tabular-nums text-slate-100">
                    {formatBytes(stats.totalBytes)}
                  </p>
                  <span className="text-sm text-slate-500">/ {formatBytes(stats.quotaBytes)}</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  {stats.usagePercentage < 50
                    ? `${formatBytes(stats.quotaBytes - stats.totalBytes)} free remaining`
                    : stats.usagePercentage < 80
                      ? 'Approaching quota — consider cleaning up old assets'
                      : 'Quota nearly exhausted — immediate cleanup recommended'}
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      stats.usagePercentage < 50
                        ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                        : stats.usagePercentage < 80
                          ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                          : 'border-rose-500/40 text-rose-300 bg-rose-500/10'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full bg-current mr-1.5`} />
                    {u.label}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                    {stats.totalFiles} files tracked
                  </Badge>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Category breakdown */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat]
              const Icon = meta.icon
              const data = stats.byCategory[cat]
              const pctOfTotal = stats.totalBytes > 0 ? (data.bytes / stats.totalBytes) * 100 : 0
              const pctOfQuota = stats.quotaBytes > 0 ? (data.bytes / stats.quotaBytes) * 100 : 0
              return (
                <div
                  key={cat}
                  className={`relative overflow-hidden rounded-xl border ${meta.border} bg-gradient-to-br ${meta.glow} bg-slate-950/40 p-3.5`}
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg bg-slate-900/70 border border-slate-700/50 flex items-center justify-center ${meta.text}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[10px] font-semibold ${meta.text}`}>
                      {pctOfTotal.toFixed(1)}%
                    </span>
                  </div>
                  <p className={`text-base font-bold tabular-nums text-slate-100`}>
                    {formatBytes(data.bytes)}
                  </p>
                  <p className="text-[10px] text-slate-500 mb-2.5">
                    {data.files} {data.files === 1 ? 'file' : 'files'}
                  </p>
                  <MiniBar pct={pctOfQuota} gradient={meta.bar} />
                  <p className="text-[9px] text-slate-600 mt-1.5 font-mono truncate">{data.path}</p>
                </div>
              )
            })}
          </motion.div>

          {/* Largest files */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Largest Files
              </p>
              <span className="text-[10px] text-slate-500">
                Top {Math.min(10, stats.largestFiles.length)} · sorted by size
              </span>
            </div>
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/40">
              <div
                className="max-h-64 overflow-y-auto p-1.5"
                style={{ scrollbarWidth: 'thin' }}
              >
                {stats.largestFiles.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No files on disk</p>
                ) : (
                  <ul className="space-y-1">
                    {stats.largestFiles.map((file, i) => {
                      const meta = CATEGORY_META[file.category]
                      const Icon = meta.icon
                      const pctOfTotal = stats.totalBytes > 0 ? (file.bytes / stats.totalBytes) * 100 : 0
                      return (
                        <motion.li
                          key={`${file.path}-${i}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3 }}
                          className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-800/40 transition-colors"
                        >
                          <div
                            className={`shrink-0 w-7 h-7 rounded-md bg-slate-900/70 border border-slate-700/50 flex items-center justify-center ${meta.text}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-xs font-mono text-slate-300 truncate group-hover:text-slate-100 transition-colors">
                                {file.path}
                              </p>
                              <span className="text-[11px] font-semibold tabular-nums text-slate-400 shrink-0">
                                {formatBytes(file.bytes)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 min-w-0">
                                <MiniBar pct={Math.min(100, pctOfTotal * 4)} gradient={meta.bar} />
                              </div>
                              <span className="text-[9px] text-slate-600 tabular-nums shrink-0 w-10 text-right">
                                {pctOfTotal.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </motion.li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>

          {/* Error banner if refresh failed but we have stale data */}
          {error && stats && (
            <div className="text-[11px] text-rose-300/80 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              Last refresh failed — showing cached data.
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default StorageDashboard
