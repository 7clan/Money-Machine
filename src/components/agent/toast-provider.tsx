'use client'

// ───────────────────────────────────────────────────────────────────
// Toast Provider — global transient toast notification system.
//
// Wrap the app with <ToastProvider>, then trigger toasts from anywhere
// via the useToast() hook:
//
//   const { toast, dismiss, dismissAll, update, toasts } = useToast()
//   const id = toast({ type: 'success', title: 'Saved' })
//   // later, transition a loading toast → success:
//   update(id, { type: 'success', title: 'Upload complete', duration: 3000 })
//
// Palette: violet / cyan / emerald / amber / rose — NO indigo, NO blue.
// ───────────────────────────────────────────────────────────────────

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface ToastOptions {
  /** Auto-generated if not provided. */
  id?: string
  type?: ToastType
  title: string
  description?: string
  /** ms; 0 = persistent, default 3000. */
  duration?: number
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}

export interface Toast
  extends Required<Omit<ToastOptions, 'action' | 'onDismiss'>> {
  action?: ToastOptions['action']
  onDismiss?: ToastOptions['onDismiss']
  createdAt: number
}

interface ToastContextValue {
  toasts: Toast[]
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
  dismissAll: () => void
  update: (id: string, options: Partial<ToastOptions>) => void
}

// ─── Constants ─────────────────────────────────────────────────────

const MAX_VISIBLE = 5
const DEFAULT_DURATION = 3000

/** Per-type icon + accent palette. */
const TOAST_META: Record<
  ToastType,
  {
    Icon: React.ElementType
    iconBg: string
    iconText: string
    barColor: string
    glow: string
  }
> = {
  success: {
    Icon: CheckCircle2,
    iconBg: 'bg-emerald-500/15',
    iconText: 'text-emerald-400',
    barColor: 'bg-emerald-500',
    glow: 'shadow-[0_8px_30px_-12px_rgba(16,185,129,0.35)]',
  },
  error: {
    Icon: XCircle,
    iconBg: 'bg-rose-500/15',
    iconText: 'text-rose-400',
    barColor: 'bg-rose-500',
    glow: 'shadow-[0_8px_30px_-12px_rgba(244,63,94,0.35)]',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-amber-500/15',
    iconText: 'text-amber-400',
    barColor: 'bg-amber-500',
    glow: 'shadow-[0_8px_30px_-12px_rgba(245,158,11,0.35)]',
  },
  info: {
    Icon: Info,
    iconBg: 'bg-cyan-500/15',
    iconText: 'text-cyan-400',
    barColor: 'bg-cyan-500',
    glow: 'shadow-[0_8px_30px_-12px_rgba(6,182,212,0.35)]',
  },
  loading: {
    Icon: Loader2,
    iconBg: 'bg-violet-500/15',
    iconText: 'text-violet-400',
    barColor: 'bg-violet-500',
    glow: 'shadow-[0_8px_30px_-12px_rgba(139,92,246,0.35)]',
  },
}

// ─── Context ───────────────────────────────────────────────────────

const ToastContext = React.createContext<ToastContextValue | null>(null)

// ─── Helpers ───────────────────────────────────────────────────────

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Provider ──────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => {
      const target = prev.find((t) => t.id === id)
      if (target?.onDismiss) {
        try {
          target.onDismiss()
        } catch {
          /* swallow user-handler errors */
        }
      }
      return prev.filter((t) => t.id !== id)
    })
  }, [])

  const dismissAll = React.useCallback(() => {
    setToasts((prev) => {
      prev.forEach((t) => {
        if (t.onDismiss) {
          try {
            t.onDismiss()
          } catch {
            /* swallow */
          }
        }
      })
      return []
    })
  }, [])

  const toast = React.useCallback(
    (options: ToastOptions): string => {
      const id = options.id ?? generateId()
      const newToast: Toast = {
        id,
        type: options.type ?? 'info',
        title: options.title,
        description: options.description ?? '',
        duration: options.duration ?? DEFAULT_DURATION,
        createdAt: Date.now(),
        action: options.action,
        onDismiss: options.onDismiss,
      }
      setToasts((prev) => {
        // Newest at the front (top of stack).
        const next = [newToast, ...prev]
        // Cap visible count — extras silently fade out via AnimatePresence.
        return next.length > MAX_VISIBLE
          ? next.slice(0, MAX_VISIBLE)
          : next
      })
      return id
    },
    []
  )

  const update = React.useCallback(
    (id: string, options: Partial<ToastOptions>): void => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t
          const updated: Toast = {
            ...t,
            type: options.type ?? t.type,
            title: options.title ?? t.title,
            description: options.description ?? t.description,
            duration: options.duration ?? t.duration,
            action: options.action !== undefined ? options.action : t.action,
            onDismiss:
              options.onDismiss !== undefined ? options.onDismiss : t.onDismiss,
            // Re-stamp createdAt so the progress bar + timer restart.
            createdAt: Date.now(),
          }
          return updated
        })
      )
    },
    []
  )

  const value = React.useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss, dismissAll, update }),
    [toasts, toast, dismiss, dismissAll, update]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>')
  }
  return ctx
}

// ─── Viewport ──────────────────────────────────────────────────────

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: Toast[]
  dismiss: (id: string) => void
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      aria-relevant="additions removals"
      className={cn(
        'pointer-events-none fixed top-4 right-4 z-[100]',
        'flex flex-col gap-2',
        'w-[calc(100vw-2rem)] sm:w-96 max-w-md'
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── ToastCard ─────────────────────────────────────────────────────

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const meta = TOAST_META[toast.type]
  const Icon = meta.Icon
  const isPersistent = toast.duration === 0 || toast.type === 'loading'

  // Progress tracking via refs + direct DOM writes (no re-renders).
  const barRef = React.useRef<HTMLDivElement>(null)
  const startRef = React.useRef<number>(toast.createdAt)
  const remainingRef = React.useRef<number>(toast.duration)
  const pausedRef = React.useRef<boolean>(false)
  const rafRef = React.useRef<number | null>(null)
  const dismissedRef = React.useRef<boolean>(false)

  const handleDismiss = React.useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    onDismiss(toast.id)
  }, [toast.id, onDismiss])

  // Main timer loop — only for non-persistent toasts.
  React.useEffect(() => {
    if (isPersistent) return

    let cancelled = false

    const tick = () => {
      if (cancelled) return
      if (!pausedRef.current) {
        const now = Date.now()
        const elapsed = now - startRef.current
        const remaining = Math.max(0, remainingRef.current - elapsed)
        const pct = toast.duration > 0 ? remaining / toast.duration : 0
        if (barRef.current) {
          barRef.current.style.transform = `scaleX(${pct})`
        }
        if (remaining <= 0) {
          handleDismiss()
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [isPersistent, toast.duration, toast.id, handleDismiss])

  // Reset timer when toast is updated (createdAt / duration change).
  React.useEffect(() => {
    startRef.current = toast.createdAt
    remainingRef.current = toast.duration
    if (barRef.current) {
      barRef.current.style.transform = 'scaleX(1)'
    }
  }, [toast.createdAt, toast.duration])

  const handleMouseEnter = () => {
    if (isPersistent) return
    pausedRef.current = true
    const now = Date.now()
    const elapsed = now - startRef.current
    remainingRef.current = Math.max(0, remainingRef.current - elapsed)
  }

  const handleMouseLeave = () => {
    if (isPersistent) return
    pausedRef.current = false
    startRef.current = Date.now()
  }

  const handleBodyClick = () => {
    handleDismiss()
  }

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (toast.action?.onClick) {
      try {
        toast.action.onClick()
      } catch {
        /* swallow */
      }
    }
    handleDismiss()
  }

  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleDismiss()
  }

  return (
    <motion.div
      layout
      role="status"
      initial={{ opacity: 0, x: 320, scale: 0.92 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        transition: { type: 'spring', stiffness: 320, damping: 30, mass: 0.8 },
      }}
      exit={{
        opacity: 0,
        x: 320,
        scale: 0.92,
        transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleBodyClick}
      className={cn(
        'pointer-events-auto relative cursor-pointer overflow-hidden',
        'bg-slate-900/95 backdrop-blur-md',
        'border border-slate-800/60 rounded-lg shadow-2xl',
        'px-3.5 py-3',
        meta.glow
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'shrink-0 flex h-8 w-8 items-center justify-center rounded-full',
            meta.iconBg
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              meta.iconText,
              toast.type === 'loading' && 'animate-spin'
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 leading-tight break-words">
            {toast.title}
          </p>
          {toast.description && (
            <p className="text-xs text-slate-400 mt-0.5 leading-snug break-words">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={handleActionClick}
              className={cn(
                'mt-1.5 text-xs font-medium',
                'text-violet-300 hover:text-violet-200',
                'transition-colors'
              )}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Dismiss X */}
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={handleDismissClick}
          className={cn(
            'shrink-0 -mr-1 -mt-1',
            'flex h-6 w-6 items-center justify-center rounded',
            'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60',
            'transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40'
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar — only for non-persistent toasts */}
      {!isPersistent && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-800/80"
          aria-hidden="true"
        >
          <div
            ref={barRef}
            className={cn('h-full origin-left', meta.barColor)}
            style={{ transform: 'scaleX(1)' }}
          />
        </div>
      )}
    </motion.div>
  )
}
