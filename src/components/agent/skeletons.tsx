'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ─── Skeleton Primitive ────────────────────────────────────────────
// Shimmer effect skeleton — a dark slate base with an animated gradient
// sweep that traverses left-to-right on an infinite loop.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-800/60 rounded-md',
        className
      )}
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-slate-700/40 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
      />
    </div>
  )
}

// ─── StatusCardSkeleton ────────────────────────────────────────────
// Mirrors the StatusCard component: ~120px tall with an icon top-left,
// trend indicator top-right, then a value + label + sub stacked at bottom.
export function StatusCardSkeleton() {
  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm p-4 h-[120px] flex flex-col">
      <div className="flex items-start justify-between">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-3 h-3 rounded-sm" />
      </div>
      <div className="mt-auto space-y-1.5">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2 w-16" />
      </div>
    </div>
  )
}

// ─── PipelineFlowSkeleton ──────────────────────────────────────────
// Mirrors the PipelineFlow component: 6 stage boxes in a horizontal row
// separated by chevron placeholders. Each box has icon / count / label.
export function PipelineFlowSkeleton() {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2 px-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="flex flex-col items-center min-w-[80px] p-3 rounded-xl border border-slate-800/50 bg-slate-900/30"
          >
            <Skeleton className="w-5 h-5 rounded-md mb-1" />
            <Skeleton className="h-5 w-6 mb-1" />
            <Skeleton className="h-2 w-12" />
          </motion.div>
          {i < 5 && (
            <div className="flex items-center px-1">
              <Skeleton className="w-4 h-4 rounded-sm" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── IdeaListSkeleton ──────────────────────────────────────────────
// Staggered shimmer cards matching an idea/video list row: thumbnail on
// the left, title + description bars, and a trailing action square.
export function IdeaListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800/40"
        >
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="w-8 h-8 rounded-md shrink-0" />
        </motion.div>
      ))}
    </div>
  )
}

// ─── ChartSkeleton ─────────────────────────────────────────────────
// Empty chart area with Y-axis ticks on the left, an animated bar plot
// in the middle, and X-axis labels along the bottom.
export function ChartSkeleton() {
  return (
    <div className="rounded-xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
      <div className="flex gap-2 h-[200px]">
        {/* Y-axis tick labels */}
        <div className="flex flex-col justify-between py-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-2 w-8" />
          ))}
        </div>
        {/* Plot area with shimmer bars */}
        <div className="flex-1 flex items-end gap-1.5 border-l border-b border-slate-800/50 pl-2 pb-1">
          {Array.from({ length: 12 }).map((_, i) => {
            const heightPct = 35 + Math.abs(Math.sin(i * 0.8)) * 35 + (i % 3) * 8
            return (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${Math.min(heightPct, 95)}%` }}
                transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' }}
                className="flex-1 min-w-0"
              >
                <Skeleton className="w-full h-full" />
              </motion.div>
            )
          })}
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex justify-between mt-2 pl-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-2 w-10" />
        ))}
      </div>
    </div>
  )
}

// ─── LogListSkeleton ───────────────────────────────────────────────
// Audit-log rows: dot + timestamp + badge + message line, staggered.
export function LogListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.25 }}
          className="flex items-center gap-3 py-1.5"
        >
          <Skeleton className="h-1.5 w-1.5 rounded-full shrink-0" />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-5 w-20 rounded-md shrink-0" />
          <Skeleton className="h-3 flex-1 max-w-md" />
        </motion.div>
      ))}
    </div>
  )
}

// ─── TabContentSkeleton ────────────────────────────────────────────
// Full tab placeholder: header row, status-card grid, chart, then a
// two-column section with an idea list and a log list.
export function TabContentSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Tab header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Status cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatusCardSkeleton key={i} />
        ))}
      </div>

      {/* Chart */}
      <ChartSkeleton />

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-900/40 border border-slate-800/50 p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <IdeaListSkeleton count={4} />
        </div>
        <div className="rounded-xl bg-slate-900/40 border border-slate-800/50 p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <LogListSkeleton count={6} />
        </div>
      </div>
    </motion.div>
  )
}
