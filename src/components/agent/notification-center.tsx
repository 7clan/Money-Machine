'use client'

// ───────────────────────────────────────────────────────────────────
// Notification Center — persistent bell-icon dropdown.
//
// Renders a bell button + popover. Notifications are stored in
// localStorage (when no `notifications` prop is supplied) and
// survive page reloads. Up to 50 are retained (newest first).
//
//   <NotificationCenter onNavigate={(t) => router.push(t)} />
//
// or controlled:
//   <NotificationCenter
//     notifications={serverNotifications}
//     onNavigate={(t) => router.push(t)}
//   />
//
// Palette: violet / cyan / emerald / amber / rose — NO indigo, NO blue.
// ───────────────────────────────────────────────────────────────────

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Trophy,
  CheckCheck,
  ChevronRight,
  BellOff,
  Filter,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

export type NotificationType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'achievement'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  description?: string
  timestamp: number
  read: boolean
  important?: boolean
  /** Navigation target, e.g. '/revenue' or 'revenue'. */
  target?: string
}

export interface NotificationCenterProps {
  /** If omitted, the component reads/writes localStorage. */
  notifications?: Notification[]
  onNavigate?: (target: string) => void
  className?: string
}

// ─── Constants ─────────────────────────────────────────────────────

const STORAGE_KEY = 'ytrs-notification-center-v1'
const MAX_NOTIFICATIONS = 50

type FilterKind = 'all' | 'unread' | 'important'

const FILTERS: { id: FilterKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'important', label: 'Important' },
]

const NOTIF_META: Record<
  NotificationType,
  { Icon: React.ElementType; iconBg: string; iconText: string }
> = {
  success: {
    Icon: CheckCircle2,
    iconBg: 'bg-emerald-500/15',
    iconText: 'text-emerald-400',
  },
  error: {
    Icon: XCircle,
    iconBg: 'bg-rose-500/15',
    iconText: 'text-rose-400',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-amber-500/15',
    iconText: 'text-amber-400',
  },
  info: {
    Icon: Info,
    iconBg: 'bg-cyan-500/15',
    iconText: 'text-cyan-400',
  },
  achievement: {
    Icon: Trophy,
    iconBg: 'bg-violet-500/15',
    iconText: 'text-violet-400',
  },
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatRelative(ts: number): string {
  try {
    return formatDistanceToNowStrict(new Date(ts), { addSuffix: true })
  } catch {
    return ''
  }
}

function isLocalStorageAvailable(): boolean {
  try {
    const k = '__ytrs_test__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

function loadFromStorage(): Notification[] {
  if (typeof window === 'undefined') return []
  if (!isLocalStorageAvailable()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((n): n is Notification => Boolean(n) && typeof n === 'object' && typeof n.id === 'string')
      .slice(0, MAX_NOTIFICATIONS)
  } catch {
    return []
  }
}

function saveToStorage(notifs: Notification[]): void {
  if (typeof window === 'undefined') return
  if (!isLocalStorageAvailable()) return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(notifs.slice(0, MAX_NOTIFICATIONS))
    )
  } catch {
    /* swallow quota errors */
  }
}

// ─── Component ─────────────────────────────────────────────────────

export function NotificationCenter({
  notifications,
  onNavigate,
  className,
}: NotificationCenterProps) {
  const isControlled = notifications !== undefined

  const [open, setOpen] = React.useState(false)
  const [filter, setFilter] = React.useState<FilterKind>('all')

  // Internal state mirrors the prop when controlled, otherwise localStorage.
  const [internal, setInternal] = React.useState<Notification[]>(() => {
    if (typeof window !== 'undefined' && notifications) {
      return notifications.slice(0, MAX_NOTIFICATIONS)
    }
    return loadFromStorage()
  })

  // Sync from prop when it changes (controlled mode).
  React.useEffect(() => {
    if (notifications) {
      setInternal(notifications.slice(0, MAX_NOTIFICATIONS))
    }
  }, [notifications])

  // Persist to localStorage in uncontrolled mode.
  React.useEffect(() => {
    if (isControlled) return
    saveToStorage(internal)
  }, [internal, isControlled])

  // ── Derived ──
  const unreadCount = React.useMemo(
    () => internal.filter((n) => !n.read).length,
    [internal]
  )

  const filtered = React.useMemo(() => {
    if (filter === 'unread') return internal.filter((n) => !n.read)
    if (filter === 'important') return internal.filter((n) => n.important)
    return internal
  }, [internal, filter])

  // ── Mutations ──
  const markAsRead = React.useCallback((id: string) => {
    setInternal((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllAsRead = React.useCallback(() => {
    setInternal((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  // ── Click handler ──
  const handleItemClick = (notif: Notification) => {
    if (!notif.read) markAsRead(notif.id)
    if (notif.target && onNavigate) onNavigate(notif.target)
    setOpen(false)
  }

  const handleViewAll = () => {
    if (onNavigate) onNavigate('/activity')
    setOpen(false)
  }

  // ── Render ──
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          className={cn(
            'relative w-9 h-9 inline-flex items-center justify-center rounded-md',
            'text-slate-300 hover:text-slate-100',
            'hover:bg-slate-800/60 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
            className
          )}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className={cn(
                'absolute top-1 right-1 w-4 h-4 rounded-full',
                'bg-rose-500 text-white',
                'text-[10px] font-bold flex items-center justify-center',
                'ring-2 ring-slate-950'
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          'p-0 w-[calc(100vw-2rem)] sm:w-96 max-w-md',
          'bg-slate-900/95 backdrop-blur-md',
          'border border-slate-800/60',
          'shadow-2xl'
        )}
      >
        <div className="flex flex-col max-h-[70vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-semibold text-slate-100">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 tabular-nums">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className={cn(
                'flex items-center gap-1',
                'text-[11px] font-medium',
                'text-violet-300 hover:text-violet-200',
                'disabled:text-slate-600 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-800/60">
            <Filter className="h-3 w-3 text-slate-500 ml-1 mr-0.5" />
            {FILTERS.map((f) => {
              const active = filter === f.id
              const count =
                f.id === 'all'
                  ? internal.length
                  : f.id === 'unread'
                    ? unreadCount
                    : internal.filter((n) => n.important).length
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md',
                    'text-[11px] font-medium transition-colors',
                    active
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      'text-[10px] tabular-nums',
                      active ? 'text-violet-300/80' : 'text-slate-500'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence initial={false}>
              {filtered.length === 0 ? (
                <EmptyState filter={filter} key="empty" />
              ) : (
                <motion.ul
                  key="list"
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: {},
                    show: { transition: { staggerChildren: 0.03 } },
                  }}
                  className="divide-y divide-slate-800/40"
                >
                  {filtered.map((notif) => (
                    <NotificationRow
                      key={notif.id}
                      notif={notif}
                      onClick={() => handleItemClick(notif)}
                    />
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800/60 px-3 py-2">
            <button
              type="button"
              onClick={handleViewAll}
              className={cn(
                'flex w-full items-center justify-center gap-1',
                'text-[11px] font-medium',
                'text-violet-300 hover:text-violet-200',
                'transition-colors py-1'
              )}
            >
              View all activity
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Notification Row ──────────────────────────────────────────────

function NotificationRow({
  notif,
  onClick,
}: {
  notif: Notification
  onClick: () => void
}) {
  const meta = NOTIF_META[notif.type] ?? NOTIF_META.info
  const Icon = meta.Icon

  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: -4 },
        show: { opacity: 1, y: 0, transition: { duration: 0.18 } },
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group relative w-full text-left',
          'flex items-start gap-2.5 px-3 py-2.5',
          'hover:bg-slate-800/60 transition-colors cursor-pointer',
          'focus:outline-none focus-visible:bg-slate-800/60'
        )}
      >
        {/* Unread dot */}
        <span
          className={cn(
            'absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full',
            notif.read ? 'bg-transparent' : 'bg-violet-400'
          )}
          aria-hidden="true"
        />

        {/* Icon */}
        <div
          className={cn(
            'shrink-0 ml-1.5 flex h-7 w-7 items-center justify-center rounded-full',
            meta.iconBg
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', meta.iconText)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {notif.important && (
              <span className="inline-flex items-center text-[10px] font-semibold text-amber-400">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                Important
              </span>
            )}
            <p
              className={cn(
                'text-xs font-medium truncate',
                notif.read ? 'text-slate-400' : 'text-slate-100'
              )}
            >
              {notif.title}
            </p>
          </div>
          {notif.description && (
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
              {notif.description}
            </p>
          )}
          <p className="text-[10px] text-slate-600 mt-0.5 tabular-nums">
            {formatRelative(notif.timestamp)}
          </p>
        </div>

        {/* Hover affordance */}
        <ChevronRight
          className={cn(
            'shrink-0 h-3 w-3 mt-1',
            'text-slate-600 opacity-0 group-hover:opacity-100',
            'group-hover:text-slate-400 transition-all'
          )}
        />
      </button>
    </motion.li>
  )
}

// ─── Empty State ───────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterKind }) {
  const label =
    filter === 'unread'
      ? 'No unread notifications'
      : filter === 'important'
        ? 'No important notifications'
        : 'No notifications yet'

  const sub =
    filter === 'unread'
      ? "You're all caught up."
      : filter === 'important'
        ? 'Important alerts will appear here.'
        : 'New activity will show up here.'

  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col items-center justify-center py-10 px-6 text-center"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-violet-500/10 blur-xl" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/60 ring-1 ring-slate-700/60">
          <BellOff className="h-5 w-5 text-slate-400" />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-200">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </motion.div>
  )
}

export default NotificationCenter
