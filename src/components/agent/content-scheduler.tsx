'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  GripVertical,
  Calendar as CalendarIcon,
  Clock,
  X,
  Plus,
  Sparkles,
  Trash2,
  Filter,
  Inbox,
  Zap,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  format,
  addDays,
  startOfDay,
  differenceInCalendarDays,
} from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────

export interface SchedulerIdea {
  id: string
  title: string
  pillarColor?: string // hex like "#4A90E2"
  pillarName?: string
  type: string // 'short' | 'long' | 'tutorial' etc
  compositeScore?: number | null
  scheduledDate?: string | null // ISO date
  scheduledTime?: string | null // "HH:MM" 24h
}

export interface ContentSchedulerProps {
  ideas: SchedulerIdea[]
  onSchedule: (ideaId: string, dateISO: string, time: string) => void
  onUnschedule?: (ideaId: string) => void
  onAutoFill?: () => void
  onClearSchedule?: () => void
  className?: string
  isLoading?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────

const PILLAR_FALLBACK_COLOR = '#94a3b8' // slate-400

const TYPE_LABELS: Record<string, string> = {
  short: 'Short',
  long: 'Long',
  longform: 'Long',
  tutorial: 'Tutorial',
  podcast: 'Podcast',
  live: 'Live',
  vod: 'VOD',
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  short: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  long: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  longform: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  tutorial: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  podcast: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  live: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  vod: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

const TYPE_BADGE_DEFAULT = 'bg-slate-500/15 text-slate-300 border-slate-500/30'

function typeBadgeClass(type: string): string {
  if (!type) return TYPE_BADGE_DEFAULT
  return TYPE_BADGE_STYLES[type.toLowerCase()] || TYPE_BADGE_DEFAULT
}

function typeLabel(type: string): string {
  if (!type) return 'Idea'
  const lower = type.toLowerCase()
  if (TYPE_LABELS[lower]) return TYPE_LABELS[lower]
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-500'
  if (score >= 40) return 'bg-rose-500'
  return 'bg-slate-500'
}

// ─── Date helpers ─────────────────────────────────────────────────────

function todayStart(): Date {
  return startOfDay(new Date())
}

function toISODate(d: Date): string {
  // local date ISO (YYYY-MM-DD) — avoids UTC offset drift
  return format(d, 'yyyy-MM-dd')
}

function relativeLabel(day: Date): string | null {
  const diff = differenceInCalendarDays(day, todayStart())
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return `In ${diff} days`
  return null
}

function buildNext14Days(): Date[] {
  const out: Date[] = []
  const base = todayStart()
  for (let i = 0; i < 14; i++) out.push(addDays(base, i))
  return out
}

// ─── Backlog Card ─────────────────────────────────────────────────────

interface BacklogCardProps {
  idea: SchedulerIdea
  isSelected: boolean
  isDragging: boolean
  onSelect: () => void
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void
  onQuickSchedule: (dateISO: string, time: string) => void
}

function BacklogCard({
  idea,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onQuickSchedule,
}: BacklogCardProps) {
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickDate, setQuickDate] = useState<Date | undefined>(todayStart())
  const [quickTime, setQuickTime] = useState<string>('10:00')

  const score =
    typeof idea.compositeScore === 'number' ? idea.compositeScore : null

  const handleConfirm = () => {
    if (!quickDate) return
    onQuickSchedule(toISODate(quickDate), quickTime || '10:00')
    setQuickOpen(false)
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative rounded-lg border bg-slate-900/60 transition-colors',
        'border-slate-800/60 hover:border-violet-500/40 hover:bg-slate-900/80',
        isSelected &&
          'border-violet-500/70 ring-1 ring-violet-500/40 bg-slate-900/90',
        isDragging && 'opacity-40',
      )}
    >
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onSelect}
        className="flex gap-2 p-3 cursor-grab active:cursor-grabbing"
      >
        {/* Drag handle */}
        <div className="flex flex-col items-center pt-0.5 text-slate-600 group-hover:text-slate-400 transition-colors">
          <GripVertical className="size-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full ring-1 ring-white/10"
              style={{ backgroundColor: idea.pillarColor || PILLAR_FALLBACK_COLOR }}
              title={idea.pillarName || 'Pillar'}
            />
            <h4 className="text-sm font-medium leading-snug text-slate-100 line-clamp-2 flex-1">
              {idea.title}
            </h4>
          </div>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn('border text-[10px] px-1.5 py-0', typeBadgeClass(idea.type))}
            >
              {typeLabel(idea.type)}
            </Badge>
            {score !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                  {score.toFixed(0)}
                </span>
                <div className="h-1 w-12 rounded-full bg-slate-700/60 overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', scoreColor(score))}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick-schedule button */}
        <Popover open={quickOpen} onOpenChange={setQuickOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-slate-500 hover:text-violet-300 hover:bg-violet-500/10"
              onClick={(e) => e.stopPropagation()}
              title="Quick schedule"
            >
              <Plus className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-72 bg-slate-900 border-slate-700/60 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-300">
              <CalendarIcon className="size-3.5 text-violet-400" />
              Quick schedule
            </div>
            <div className="text-[11px] text-slate-400 mb-2 line-clamp-1">
              {idea.title}
            </div>
            <div className="flex justify-center rounded-md border border-slate-800 bg-slate-950/60">
              <Calendar
                mode="single"
                selected={quickDate}
                onSelect={(d) => setQuickDate(d)}
                disabled={{ before: todayStart() }}
                className="bg-transparent"
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Clock className="size-3.5 text-cyan-400 shrink-0" />
              <Input
                type="time"
                value={quickTime}
                onChange={(e) => setQuickTime(e.target.value)}
                className="h-8 w-[90px] bg-slate-950/60 border-slate-700 text-xs"
              />
              <Button
                size="sm"
                className="ml-auto bg-violet-600 hover:bg-violet-500 text-white border-0"
                onClick={handleConfirm}
                disabled={!quickDate}
              >
                Confirm
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </motion.div>
  )
}

// ─── Day Row ──────────────────────────────────────────────────────────

interface DayRowProps {
  day: Date
  ideas: SchedulerIdea[]
  isDropTarget: boolean
  hasSelectedIdea: boolean
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onDayClick: () => void
  onUnschedule: (ideaId: string) => void
  onUpdateTime: (ideaId: string, time: string) => void
}

function DayRow({
  day,
  ideas,
  isDropTarget,
  hasSelectedIdea,
  onDragOver,
  onDragLeave,
  onDrop,
  onDayClick,
  onUnschedule,
  onUpdateTime,
}: DayRowProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTime, setEditTime] = useState<string>('10:00')

  const rel = relativeLabel(day)
  const isToday = rel === 'Today'
  const isTomorrow = rel === 'Tomorrow'

  const startEdit = (idea: SchedulerIdea) => {
    setEditingId(idea.id)
    setEditTime(idea.scheduledTime || '10:00')
  }

  const saveEdit = () => {
    if (editingId) onUpdateTime(editingId, editTime || '10:00')
    setEditingId(null)
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onDayClick}
      className={cn(
        'group/day rounded-lg border p-2.5 transition-all',
        'bg-slate-900/40 border-slate-800/60',
        isDropTarget &&
          'border-violet-500/70 bg-violet-500/5 shadow-[0_0_0_1px_rgba(139,92,246,0.4),0_0_28px_-6px_rgba(139,92,246,0.65)]',
        hasSelectedIdea &&
          !isDropTarget &&
          'border-violet-500/30 bg-violet-500/[0.03] cursor-pointer',
      )}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-semibold',
              isToday ? 'text-violet-300' : 'text-slate-200',
            )}
          >
            {format(day, 'EEE, MMM d')}
          </span>
          {rel && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 font-medium',
                isToday
                  ? 'border-violet-500/40 text-violet-300 bg-violet-500/10'
                  : isTomorrow
                    ? 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10'
                    : 'border-slate-700/60 text-slate-400 bg-slate-800/40',
              )}
            >
              {rel}
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-slate-500 tabular-nums">
          {ideas.length === 0
            ? '0 ideas'
            : `${ideas.length} idea${ideas.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Ideas / empty drop zone */}
      {ideas.length === 0 ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-md border border-dashed py-3 text-xs transition-colors',
            isDropTarget
              ? 'border-violet-400/70 text-violet-300 bg-violet-500/5'
              : 'border-slate-700/60 text-slate-500',
          )}
        >
          <Plus className="size-3 mr-1" />
          {isDropTarget ? 'Drop here' : 'Schedule'}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {ideas.map((idea) => (
              <motion.div
                key={idea.id}
                layout="position"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={cn(
                  'group/chip flex items-center gap-1.5 rounded-md border bg-slate-800/60 py-1 pl-2 pr-1.5 text-xs',
                  editingId === idea.id
                    ? 'border-violet-500/60 bg-slate-800/90'
                    : 'border-slate-700/60 hover:border-slate-600',
                )}
              >
                <span
                  className="size-2 rounded-full shrink-0 ring-1 ring-white/10"
                  style={{ backgroundColor: idea.pillarColor || PILLAR_FALLBACK_COLOR }}
                />
                <span className="text-slate-200 max-w-[170px] truncate">
                  {idea.title}
                </span>
                {editingId === idea.id ? (
                  <span className="flex items-center gap-1 ml-1">
                    <Input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 w-[82px] bg-slate-950 border-slate-700 text-[11px] px-1.5"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        saveEdit()
                      }}
                      className="text-emerald-400 hover:text-emerald-300 transition-colors"
                      title="Save time"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(idea)
                    }}
                    className="flex items-center gap-0.5 ml-1 text-slate-400 hover:text-cyan-300 transition-colors"
                    title="Edit time"
                  >
                    <Clock className="size-3" />
                    <span className="text-[10px] tabular-nums">
                      {idea.scheduledTime || '10:00'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnschedule(idea.id)
                  }}
                  className="text-slate-500 hover:text-rose-400 transition-colors ml-0.5"
                  title="Remove from schedule"
                >
                  <X className="size-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────

export function ContentScheduler({
  ideas,
  onSchedule,
  onUnschedule,
  onAutoFill,
  onClearSchedule,
  className,
  isLoading,
}: ContentSchedulerProps) {
  const isMobile = useIsMobile()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)

  const days = useMemo(() => buildNext14Days(), [])

  // Split ideas into backlog (unscheduled) and scheduled-by-date map.
  const { backlog, scheduledByDate } = useMemo(() => {
    const b: SchedulerIdea[] = []
    const map: Record<string, SchedulerIdea[]> = {}
    for (const idea of ideas || []) {
      if (idea.scheduledDate) {
        // Normalize to YYYY-MM-DD (strip any time portion)
        const dIso = String(idea.scheduledDate).slice(0, 10)
        if (!map[dIso]) map[dIso] = []
        map[dIso].push(idea)
      } else {
        b.push(idea)
      }
    }
    // Sort each day's ideas by scheduledTime
    for (const k of Object.keys(map)) {
      map[k].sort((a, b2) =>
        (a.scheduledTime || '99:99').localeCompare(b2.scheduledTime || '99:99'),
      )
    }
    return { backlog: b, scheduledByDate: map }
  }, [ideas])

  // Filtered backlog based on type filter
  const filteredBacklog = useMemo(() => {
    if (typeFilter === 'all') return backlog
    return backlog.filter((i) => {
      const t = (i.type || '').toLowerCase()
      if (typeFilter === 'short') return t === 'short'
      if (typeFilter === 'long') return t === 'long' || t === 'longform'
      return true
    })
  }, [backlog, typeFilter])

  // Stats
  const stats = useMemo(() => {
    const backlogCount = backlog.length
    const todayISO = toISODate(todayStart())
    const weekEndISO = toISODate(addDays(todayStart(), 6)) // 7 days incl today
    let scheduledWeek = 0
    let scheduledTotal = 0
    let openSlots = 0
    for (const day of days) {
      const iso = toISODate(day)
      const dayIdeas = scheduledByDate[iso] || []
      scheduledTotal += dayIdeas.length
      if (iso >= todayISO && iso <= weekEndISO) scheduledWeek += dayIdeas.length
      if (dayIdeas.length === 0) openSlots += 1
    }
    const avg = scheduledTotal / days.length
    return { backlogCount, scheduledWeek, openSlots, avg }
  }, [backlog.length, scheduledByDate, days])

  // ── Drag handlers (HTML5 native) ──
  const handleDragStart = useCallback(
    (ideaId: string) => (e: React.DragEvent<HTMLDivElement>) => {
      setDraggingId(ideaId)
      setSelectedIdeaId(null)
      e.dataTransfer.effectAllowed = 'move'
      try {
        e.dataTransfer.setData('text/plain', ideaId)
      } catch {
        // Some browsers throw if called outside a trusted drag event
      }
    },
    [],
  )

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setDragOverDate(null)
  }, [])

  const handleDayDragOver =
    (dateISO: string) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragOverDate !== dateISO) setDragOverDate(dateISO)
    }

  const handleDayDragLeave =
    (dateISO: string) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (dragOverDate === dateISO) setDragOverDate(null)
    }

  const handleDayDrop =
    (dateISO: string) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const ideaId = e.dataTransfer.getData('text/plain') || draggingId
      if (ideaId) {
        const idea = ideas.find((i) => i.id === ideaId)
        onSchedule(ideaId, dateISO, idea?.scheduledTime || '10:00')
      }
      setDraggingId(null)
      setDragOverDate(null)
    }

  // ── Mobile: tap-to-select then tap-day ──
  const handleIdeaClick = useCallback(
    (ideaId: string) => () => {
      if (!isMobile) return
      setSelectedIdeaId((prev) => (prev === ideaId ? null : ideaId))
    },
    [isMobile],
  )

  const handleDayClick = useCallback(
    (dateISO: string) => () => {
      if (!isMobile || !selectedIdeaId) return
      const idea = ideas.find((i) => i.id === selectedIdeaId)
      onSchedule(selectedIdeaId, dateISO, idea?.scheduledTime || '10:00')
      setSelectedIdeaId(null)
    },
    [isMobile, selectedIdeaId, ideas, onSchedule],
  )

  const handleQuickSchedule = useCallback(
    (ideaId: string) => (dateISO: string, time: string) => {
      onSchedule(ideaId, dateISO, time)
    },
    [onSchedule],
  )

  const handleUnschedule = useCallback(
    (ideaId: string) => {
      onUnschedule?.(ideaId)
    },
    [onUnschedule],
  )

  const handleUpdateTime = useCallback(
    (ideaId: string, time: string) => {
      const idea = ideas.find((i) => i.id === ideaId)
      if (idea?.scheduledDate) {
        onSchedule(ideaId, String(idea.scheduledDate).slice(0, 10), time)
      }
    },
    [ideas, onSchedule],
  )

  return (
    <div
      className={cn(
        'relative rounded-xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm overflow-hidden',
        className,
      )}
    >
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-800/40 border-b border-slate-800/60">
        <StatTile
          label="Backlog"
          value={stats.backlogCount}
          icon={<Inbox className="size-3.5 text-violet-400" />}
          accent="text-violet-300"
        />
        <StatTile
          label="Scheduled (7d)"
          value={stats.scheduledWeek}
          icon={<CalendarDays className="size-3.5 text-cyan-400" />}
          accent="text-cyan-300"
        />
        <StatTile
          label="Open slots (14d)"
          value={stats.openSlots}
          icon={<Plus className="size-3.5 text-emerald-400" />}
          accent="text-emerald-300"
        />
        <StatTile
          label="Avg/day"
          value={stats.avg.toFixed(1)}
          icon={<Zap className="size-3.5 text-amber-400" />}
          accent="text-amber-300"
        />
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/60 bg-slate-900/60 p-3">
        <Button
          size="sm"
          onClick={() => onAutoFill?.()}
          className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white border-0 shadow-sm"
        >
          <Sparkles className="size-3.5" />
          Auto-fill next 7 days
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onClearSchedule?.()}
          className="text-slate-300 hover:text-rose-300 hover:bg-rose-500/10"
        >
          <Trash2 className="size-3.5" />
          Clear schedule
        </Button>
        <div className="ml-auto">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              size="sm"
              className="w-[160px] bg-slate-950/40 border-slate-700/60"
            >
              <Filter className="size-3.5 text-slate-400" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700/60">
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="short">Shorts only</SelectItem>
              <SelectItem value="long">Long-form only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="flex flex-col lg:flex-row">
        {/* Left: Backlog (40%) */}
        <div className="w-full lg:w-2/5 border-b lg:border-b-0 lg:border-r border-slate-800/60 bg-slate-950/20">
          <div className="flex items-center justify-between p-3 pb-2">
            <div className="flex items-center gap-2">
              <Inbox className="size-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Idea Backlog
              </h3>
            </div>
            <Badge
              variant="outline"
              className="border-slate-700/60 text-slate-400 text-[10px]"
            >
              {filteredBacklog.length} unscheduled
            </Badge>
          </div>
          <div className="px-3 pb-3 space-y-2 max-h-[700px] overflow-y-auto">
            {isLoading ? (
              <BacklogSkeleton />
            ) : filteredBacklog.length === 0 ? (
              <BacklogEmpty />
            ) : (
              <LayoutGroup>
                <AnimatePresence mode="popLayout">
                  {filteredBacklog.map((idea) => (
                    <BacklogCard
                      key={idea.id}
                      idea={idea}
                      isSelected={selectedIdeaId === idea.id}
                      isDragging={draggingId === idea.id}
                      onSelect={handleIdeaClick(idea.id)}
                      onDragStart={handleDragStart(idea.id)}
                      onDragEnd={handleDragEnd}
                      onQuickSchedule={handleQuickSchedule(idea.id)}
                    />
                  ))}
                </AnimatePresence>
              </LayoutGroup>
            )}
            {isMobile && selectedIdeaId && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 rounded-md border border-violet-500/40 bg-violet-500/10 p-2 text-[11px] text-violet-200 flex items-center gap-2"
              >
                <Plus className="size-3.5" />
                <span>
                  Tap a day below to schedule this idea. Tap again to cancel.
                </span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: Schedule (60%) */}
        <div className="w-full lg:w-3/5 bg-slate-900/30">
          <div className="flex items-center justify-between p-3 pb-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Upcoming Schedule
              </h3>
            </div>
            <span className="text-[10px] text-slate-500">Next 14 days</span>
          </div>
          <div className="px-3 pb-3 space-y-2 max-h-[700px] overflow-y-auto">
            {isLoading ? (
              <ScheduleSkeleton />
            ) : (
              days.map((day) => {
                const iso = toISODate(day)
                const dayIdeas = scheduledByDate[iso] || []
                return (
                  <DayRow
                    key={iso}
                    day={day}
                    ideas={dayIdeas}
                    isDropTarget={dragOverDate === iso}
                    hasSelectedIdea={!!selectedIdeaId}
                    onDragOver={handleDayDragOver(iso)}
                    onDragLeave={handleDayDragLeave(iso)}
                    onDrop={handleDayDrop(iso)}
                    onDayClick={handleDayClick(iso)}
                    onUnschedule={handleUnschedule}
                    onUpdateTime={handleUpdateTime}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className="bg-slate-900/60 p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 font-medium">
        {icon}
        {label}
      </div>
      <div className={cn('text-xl font-semibold tabular-nums', accent)}>
        {value}
      </div>
    </div>
  )
}

// ─── Skeletons + Empty States ─────────────────────────────────────────

function BacklogSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-3"
        >
          <Skeleton className="h-3 w-3/4 bg-slate-800/80" />
          <Skeleton className="mt-2 h-3 w-1/3 bg-slate-800/80" />
        </div>
      ))}
    </div>
  )
}

function BacklogEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800/60 py-10 text-center">
      <Inbox className="size-8 text-slate-700 mb-2" />
      <p className="text-sm text-slate-500">No unscheduled ideas</p>
      <p className="text-[11px] text-slate-600 mt-1">
        All ideas are scheduled. Great work!
      </p>
    </div>
  )
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-3"
        >
          <Skeleton className="h-3 w-24 bg-slate-800/80" />
          <Skeleton className="mt-2 h-6 w-full bg-slate-800/80" />
        </div>
      ))}
    </div>
  )
}

export default ContentScheduler
