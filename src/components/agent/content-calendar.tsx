'use client'

import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Video,
  CalendarClock,
  CircleDot,
  Radio,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────

/** Derived from VideoIdea + (optional) nested pillar relation. */
export interface CalendarIdea {
  id: string
  title: string
  pillarId?: string | null
  pillar?: { id?: string; name?: string | null; color?: string | null } | null
  type?: string | null
  status?: string | null
  scheduledDate?: string | Date | null
}

/** Derived from Upload. */
export interface CalendarUpload {
  id: string
  title: string
  videoProjectId?: string
  youtubeVideoId?: string | null
  privacy?: string | null
  uploadStatus?: string | null
  publishedAt?: string | Date | null
}

export interface ContentCalendarProps {
  /** VideoIdea[] with scheduledDate */
  ideas?: any[]
  /** Upload[] with publishedAt */
  uploads?: any[]
  className?: string
}

interface DayEvent {
  kind: 'scheduled' | 'published'
  id: string
  title: string
  date: Date
  pillar?: PaletteEntry
  type?: string
  status?: string
  privacy?: string
}

// ─── Constants ────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface PaletteEntry {
  name: string
  dot: string
  text: string
  soft: string
  ring: string
  border: string
}

const PILLAR_PALETTE: PaletteEntry[] = [
  { name: 'violet',  dot: 'bg-violet-500',  text: 'text-violet-300',  soft: 'bg-violet-500/15',  ring: 'ring-violet-500/40',  border: 'border-violet-500/40' },
  { name: 'cyan',    dot: 'bg-cyan-500',    text: 'text-cyan-300',    soft: 'bg-cyan-500/15',    ring: 'ring-cyan-500/40',    border: 'border-cyan-500/40' },
  { name: 'emerald', dot: 'bg-emerald-500', text: 'text-emerald-300', soft: 'bg-emerald-500/15', ring: 'ring-emerald-500/40', border: 'border-emerald-500/40' },
  { name: 'amber',   dot: 'bg-amber-500',   text: 'text-amber-300',   soft: 'bg-amber-500/15',   ring: 'ring-amber-500/40',   border: 'border-amber-500/40' },
  { name: 'rose',    dot: 'bg-rose-500',    text: 'text-rose-300',    soft: 'bg-rose-500/15',    ring: 'ring-rose-500/40',    border: 'border-rose-500/40' },
  { name: 'fuchsia', dot: 'bg-fuchsia-500', text: 'text-fuchsia-300', soft: 'bg-fuchsia-500/15', ring: 'ring-fuchsia-500/40', border: 'border-fuchsia-500/40' },
  { name: 'teal',    dot: 'bg-teal-500',    text: 'text-teal-300',    soft: 'bg-teal-500/15',    ring: 'ring-teal-500/40',    border: 'border-teal-500/40' },
  { name: 'orange',  dot: 'bg-orange-500',  text: 'text-orange-300',  soft: 'bg-orange-500/15',  ring: 'ring-orange-500/40',  border: 'border-orange-500/40' },
]

const DEFAULT_PALETTE = PILLAR_PALETTE[0]

// ─── Helpers ──────────────────────────────────────────────────────────

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  const d = typeof v === 'string' ? new Date(v) : v
  return isNaN(d.getTime()) ? null : d
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0
  }
  return h
}

function resolvePillar(
  pillarId?: string | null,
  pillar?: { name?: string | null; color?: string | null } | null,
  fallbackKey?: string
): PaletteEntry {
  const colorStr = pillar?.color
  if (colorStr) {
    const lower = colorStr.toLowerCase()
    const match = PILLAR_PALETTE.find((p) => lower.includes(p.name))
    if (match) return match
  }
  const key = pillarId || pillar?.name || fallbackKey || 'default'
  if (!key || key === 'default') return DEFAULT_PALETTE
  return PILLAR_PALETTE[hashString(key) % PILLAR_PALETTE.length]
}

function buildCalendarGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startDayOfWeek = firstDay.getDay() // 0 = Sunday
  const start = new Date(year, month, 1 - startDayOfWeek)
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    cells.push(
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    )
  }
  return cells
}

function formatFullDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function relativeDays(d: Date): string {
  const today = startOfDay(new Date())
  const target = startOfDay(d)
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 0) return `in ${diffDays} days`
  return `${Math.abs(diffDays)} days ago`
}

// ─── Animation variants ───────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
}

const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
}

// ─── Component ────────────────────────────────────────────────────────

export function ContentCalendar({
  ideas = [],
  uploads = [],
  className,
}: ContentCalendarProps) {
  const today = useMemo(() => startOfDay(new Date()), [])

  // Pre-compute the initial view month: if there's a nearest upcoming scheduled
  // event in a different month, jump there. Otherwise default to this month.
  const initialViewDate = useMemo(() => {
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    // Inspect raw ideas/uploads for the nearest upcoming scheduled date.
    const upcoming: Date[] = []
    for (const raw of ideas) {
      const idea = raw as CalendarIdea
      const d = toDate(idea.scheduledDate)
      if (d && d.getTime() >= today.getTime()) upcoming.push(d)
    }
    if (!upcoming.length) return thisMonth
    upcoming.sort((a, b) => a.getTime() - b.getTime())
    const nearest = upcoming[0]
    const nearestMonth = new Date(nearest.getFullYear(), nearest.getMonth(), 1)
    return nearestMonth
  }, [today, ideas])

  const [viewDate, setViewDate] = useState<Date>(initialViewDate)
  const [direction, setDirection] = useState(1)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Normalize inputs into events.
  const { eventsByDay, scheduledEvents, publishedEvents, pillarsUsed } =
    useMemo(() => {
      const map = new Map<string, DayEvent[]>()
      const scheduled: DayEvent[] = []
      const published: DayEvent[] = []
      const pillarSet = new Map<string, PaletteEntry>()

      for (const raw of ideas) {
        const idea = raw as CalendarIdea
        const date = toDate(idea.scheduledDate)
        if (!date) continue
        const pillar = resolvePillar(idea.pillarId, idea.pillar, idea.id)
        pillarSet.set(pillar.name, pillar)
        const ev: DayEvent = {
          kind: 'scheduled',
          id: idea.id,
          title: idea.title || 'Untitled idea',
          date,
          pillar,
          type: idea.type || 'longform',
          status: idea.status || undefined,
        }
        scheduled.push(ev)
        const key = dayKey(date)
        const arr = map.get(key) || []
        arr.push(ev)
        map.set(key, arr)
      }

      for (const raw of uploads) {
        const up = raw as CalendarUpload
        const date = toDate(up.publishedAt)
        if (!date) continue
        const ev: DayEvent = {
          kind: 'published',
          id: up.id,
          title: up.title || 'Untitled upload',
          date,
          privacy: up.privacy || undefined,
          status: up.uploadStatus || undefined,
        }
        published.push(ev)
        const key = dayKey(date)
        const arr = map.get(key) || []
        arr.push(ev)
        map.set(key, arr)
      }

      // Sort each day's events: scheduled first, then by time.
      for (const arr of map.values()) {
        arr.sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'scheduled' ? -1 : 1
          return a.date.getTime() - b.date.getTime()
        })
      }

      return {
        eventsByDay: map,
        scheduledEvents: scheduled,
        publishedEvents: published,
        pillarsUsed: Array.from(pillarSet.values()),
      }
    }, [ideas, uploads])

  const grid = useMemo(() => buildCalendarGrid(viewDate), [viewDate])

  // Stats for the currently-viewed month.
  const monthStats = useMemo(() => {
    const y = viewDate.getFullYear()
    const m = viewDate.getMonth()
    const inMonthScheduled = scheduledEvents.filter(
      (e) => e.date.getFullYear() === y && e.date.getMonth() === m
    ).length
    const inMonthPublished = publishedEvents.filter(
      (e) => e.date.getFullYear() === y && e.date.getMonth() === m
    ).length
    const upcoming = scheduledEvents.filter(
      (e) => e.date.getTime() >= today.getTime()
    ).length
    return {
      scheduled: inMonthScheduled,
      published: inMonthPublished,
      upcoming,
    }
  }, [viewDate, scheduledEvents, publishedEvents, today])

  // Upcoming queue: next 5 scheduled ideas from today onward.
  const upcomingQueue = useMemo(() => {
    return scheduledEvents
      .filter((e) => e.date.getTime() >= today.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5)
  }, [scheduledEvents, today])

  const goPrev = () => {
    setDirection(-1)
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  const goNext = () => {
    setDirection(1)
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }
  const goToday = () => {
    const cur = new Date(today.getFullYear(), today.getMonth(), 1)
    setDirection(cur.getTime() > viewDate.getTime() ? 1 : -1)
    setViewDate(cur)
  }

  const monthLabel = `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  const selectedEvents = selectedDate
    ? eventsByDay.get(dayKey(selectedDate)) || []
    : []

  return (
    <Card
      className={cn(
        'bg-slate-900/60 border border-slate-800/50 backdrop-blur-sm text-slate-100',
        className
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5 text-cyan-400" />
              Content Calendar
            </CardTitle>
            <CardDescription className="text-slate-400">
              Scheduled publications and historical uploads.
            </CardDescription>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={goPrev}
              className="size-8 bg-slate-800/60 border-slate-700 hover:bg-slate-700 hover:text-white text-slate-300"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-[9rem] text-center">
              <div className="text-sm font-semibold text-slate-100">
                {monthLabel}
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={goNext}
              className="size-8 bg-slate-800/60 border-slate-700 hover:bg-slate-700 hover:text-white text-slate-300"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToday}
              className="ml-1 h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Today
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-2.5">
          <MiniStat
            label="Scheduled"
            value={monthStats.scheduled}
            icon={<CalendarClock className="size-4" />}
            tone="violet"
          />
          <MiniStat
            label="Published"
            value={monthStats.published}
            icon={<CheckCircle2 className="size-4" />}
            tone="emerald"
          />
          <MiniStat
            label="Upcoming"
            value={monthStats.upcoming}
            icon={<Radio className="size-4" />}
            tone="cyan"
          />
        </div>

        {/* Calendar grid (desktop / tablet) */}
        <div className="hidden sm:block">
          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[11px] font-medium uppercase tracking-wide text-slate-500 py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells with slide transition */}
          <div className="overflow-hidden">
            <AnimatePresence custom={direction} mode="popLayout" initial={false}>
              <motion.div
                key={`${viewDate.getFullYear()}-${viewDate.getMonth()}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="grid grid-cols-7 gap-1.5"
              >
                {grid.map((cellDate) => {
                  const key = dayKey(cellDate)
                  const dayEvents = eventsByDay.get(key) || []
                  const inMonth = cellDate.getMonth() === viewDate.getMonth()
                  const isToday = isSameDay(cellDate, today)
                  return (
                    <DayCell
                      key={key}
                      date={cellDate}
                      inMonth={inMonth}
                      isToday={isToday}
                      events={dayEvents}
                      onClick={() => setSelectedDate(cellDate)}
                    />
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile vertical list of days with events */}
        <div className="sm:hidden">
          <MobileDayList
            viewDate={viewDate}
            eventsByDay={eventsByDay}
            today={today}
            onSelect={setSelectedDate}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
          {pillarsUsed.length > 0 ? (
            pillarsUsed.map((p) => (
              <span key={p.name} className="flex items-center gap-1.5">
                <span className={cn('size-2.5 rounded-full', p.dot)} />
                <span className="capitalize">{p.name}</span>
              </span>
            ))
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-violet-500" />
                <span>Pillar A</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-cyan-500" />
                <span>Pillar B</span>
              </span>
            </>
          )}
          <span className="flex items-center gap-1.5">
            <CircleDot className="size-3.5 text-slate-400" />
            <span>Scheduled</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            <span>Published</span>
          </span>
        </div>

        {/* Upcoming queue */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3.5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-amber-400" />
            <h4 className="text-sm font-medium text-slate-200">Upcoming queue</h4>
            <Badge
              variant="outline"
              className="ml-auto bg-slate-800/60 text-slate-300 border-slate-700 text-[11px]"
            >
              Next {upcomingQueue.length}
            </Badge>
          </div>
          {upcomingQueue.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 text-center">
              No upcoming scheduled videos.
            </p>
          ) : (
            <motion.ul
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {upcomingQueue.map((ev) => (
                <motion.li
                  key={ev.id}
                  variants={itemVariants}
                  className="flex items-center gap-2.5 rounded-md bg-slate-900/40 px-2.5 py-2"
                >
                  <span
                    className={cn(
                      'size-2.5 rounded-full shrink-0',
                      ev.pillar?.dot || 'bg-violet-500'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-200 truncate">
                      {ev.title}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatShortDate(ev.date)} · {relativeDays(ev.date)}
                    </div>
                  </div>
                  {ev.type === 'short' && (
                    <Badge
                      variant="outline"
                      className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]"
                    >
                      Short
                    </Badge>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </CardContent>

      {/* Day detail side panel */}
      <Sheet
        open={selectedDate !== null}
        onOpenChange={(o) => !o && setSelectedDate(null)}
      >
        <SheetContent
          side="right"
          className="bg-slate-950 border-l border-slate-800 text-slate-100 w-full sm:max-w-md"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="size-5 text-cyan-400" />
              {selectedDate ? formatFullDate(selectedDate) : ''}
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              {selectedEvents.length === 0
                ? 'No events scheduled for this day.'
                : `${selectedEvents.length} event${selectedEvents.length === 1 ? '' : 's'} on this day.`}
            </SheetDescription>
          </SheetHeader>

          <Separator className="bg-slate-800" />

          <ScrollArea className="flex-1 -mx-1">
            <div className="px-4 pb-6 space-y-4">
              {selectedEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center">
                  <CalendarDays className="size-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    Nothing scheduled. Pick another day to inspect events.
                  </p>
                </div>
              ) : (
                <DayDetailSections events={selectedEvents} />
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </Card>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: 'violet' | 'cyan' | 'emerald' | 'amber'
}) {
  const toneMap: Record<typeof tone, string> = {
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  }
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 flex items-center gap-2.5',
        toneMap[tone]
      )}
    >
      <div className="size-7 rounded-md bg-slate-950/40 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-slate-400 truncate">
          {label}
        </div>
        <div className="text-lg font-semibold leading-tight tabular-nums">
          {value}
        </div>
      </div>
    </div>
  )
}

function DayCell({
  date,
  inMonth,
  isToday,
  events,
  onClick,
}: {
  date: Date
  inMonth: boolean
  isToday: boolean
  events: DayEvent[]
  onClick: () => void
}) {
  const scheduled = events.filter((e) => e.kind === 'scheduled')
  const published = events.filter((e) => e.kind === 'published')
  const visibleDots = scheduled.slice(0, 3)
  const extra = Math.max(0, scheduled.length - visibleDots.length)
  const hasEvents = events.length > 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative min-h-[68px] sm:min-h-[78px] rounded-md border p-1.5 text-left transition-colors flex flex-col gap-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
        inMonth
          ? 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
          : 'bg-slate-950/40 border-slate-900/60 opacity-50',
        isToday && 'ring-2 ring-violet-500/70 ring-offset-0',
        hasEvents && inMonth && 'border-slate-700'
      )}
      aria-label={`${date.toDateString()}${hasEvents ? `, ${events.length} events` : ''}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            isToday
              ? 'text-violet-300'
              : inMonth
                ? 'text-slate-300'
                : 'text-slate-600'
          )}
        >
          {date.getDate()}
        </span>
        {published.length > 0 && (
          <CheckCircle2 className="size-3.5 text-emerald-400" />
        )}
      </div>

      {visibleDots.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto">
          {visibleDots.map((ev, i) => (
            <span
              key={`${ev.id}-${i}`}
              className={cn(
                'size-2 rounded-full',
                ev.pillar?.dot || 'bg-violet-500'
              )}
              title={ev.title}
            />
          ))}
          {extra > 0 && (
            <span className="text-[9px] text-slate-400 leading-none self-center">
              +{extra}
            </span>
          )}
        </div>
      )}

      {scheduled.length === 0 && published.length > 0 && (
        <div className="mt-auto flex items-center gap-1 text-[10px] text-emerald-400/80">
          <Video className="size-3" />
          <span>{published.length}</span>
        </div>
      )}
    </button>
  )
}

function MobileDayList({
  viewDate,
  eventsByDay,
  today,
  onSelect,
}: {
  viewDate: Date
  eventsByDay: Map<string, DayEvent[]>
  today: Date
  onSelect: (d: Date) => void
}) {
  const y = viewDate.getFullYear()
  const m = viewDate.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const rows: { date: Date; events: DayEvent[] }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d)
    const events = eventsByDay.get(dayKey(date)) || []
    if (events.length > 0) rows.push({ date, events })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center">
        <CalendarDays className="size-7 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-400">
          No events in {MONTH_NAMES[m]} {y}.
        </p>
      </div>
    )
  }

  return (
    <motion.ul
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="space-y-2 max-h-80 overflow-y-auto pr-1"
    >
      {rows.map(({ date, events }) => {
        const isToday = isSameDay(date, today)
        return (
          <motion.li key={dayKey(date)} variants={itemVariants}>
            <button
              type="button"
              onClick={() => onSelect(date)}
              className={cn(
                'w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-colors',
                isToday
                  ? 'border-violet-500/50 bg-violet-500/10'
                  : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/60'
              )}
            >
              <div className="text-center shrink-0 w-10">
                <div className="text-[10px] uppercase text-slate-500">
                  {WEEKDAYS[date.getDay()]}
                </div>
                <div
                  className={cn(
                    'text-lg font-semibold tabular-nums',
                    isToday ? 'text-violet-300' : 'text-slate-200'
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1">
                  {events.slice(0, 4).map((ev) => (
                    <span
                      key={ev.id}
                      className={cn(
                        'size-2 rounded-full',
                        ev.kind === 'published'
                          ? 'bg-emerald-500'
                          : ev.pillar?.dot || 'bg-violet-500'
                      )}
                    />
                  ))}
                </div>
                <div className="text-xs text-slate-400 mt-1 truncate">
                  {events
                    .map((e) => e.title)
                    .slice(0, 2)
                    .join(' · ')}
                  {events.length > 2 && ` +${events.length - 2} more`}
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-500 shrink-0" />
            </button>
          </motion.li>
        )
      })}
    </motion.ul>
  )
}

function DayDetailSections({ events }: { events: DayEvent[] }) {
  const scheduled = events.filter((e) => e.kind === 'scheduled')
  const published = events.filter((e) => e.kind === 'published')

  return (
    <div className="space-y-4">
      {scheduled.length > 0 && (
        <section>
          <h5 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            <CircleDot className="size-3.5" />
            Scheduled
            <Badge className="bg-slate-800 text-slate-300 border-transparent ml-1">
              {scheduled.length}
            </Badge>
          </h5>
          <ul className="space-y-2">
            {scheduled.map((ev) => (
              <li
                key={ev.id}
                className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      'size-2.5 rounded-full mt-1 shrink-0',
                      ev.pillar?.dot || 'bg-violet-500'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100 font-medium break-words">
                      {ev.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="capitalize">
                        {ev.pillar?.name || 'pillar'}
                      </span>
                      <span>·</span>
                      <span>{formatTime(ev.date)}</span>
                      {ev.type === 'short' && (
                        <>
                          <span>·</span>
                          <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                            Short
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {published.length > 0 && (
        <section>
          <h5 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            Published
            <Badge className="bg-slate-800 text-slate-300 border-transparent ml-1">
              {published.length}
            </Badge>
          </h5>
          <ul className="space-y-2">
            {published.map((ev) => (
              <li
                key={ev.id}
                className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100 font-medium break-words">
                      {ev.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{formatTime(ev.date)}</span>
                      {ev.privacy && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{ev.privacy}</span>
                        </>
                      )}
                      {ev.status && ev.status !== 'completed' && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{ev.status}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {scheduled.length === 0 && published.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Sparkles className="size-4" />
          Nothing on this day.
        </div>
      )}
    </div>
  )
}

export default ContentCalendar
