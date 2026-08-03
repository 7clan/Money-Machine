'use client'

import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Clock,
  Database,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  variant?: 'default' | 'error' | 'success' | 'pending'
  className?: string
}

// ─── Variant Styles ────────────────────────────────────────────────
type VariantStyle = {
  container: string
  icon: string
  ring: string
  button: string
}

const variantStyles: Record<NonNullable<EmptyStateProps['variant']>, VariantStyle> = {
  default: {
    container: 'bg-gradient-to-br from-violet-500/15 to-cyan-500/15 ring-1 ring-violet-500/20',
    icon: 'text-violet-300',
    ring: 'from-violet-500/30 to-cyan-500/30',
    button:
      'bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 border-violet-500/30 hover:border-violet-400/50',
  },
  error: {
    container: 'bg-gradient-to-br from-red-500/15 to-rose-500/15 ring-1 ring-red-500/20',
    icon: 'text-red-300',
    ring: 'from-red-500/30 to-rose-500/30',
    button:
      'bg-red-500/15 hover:bg-red-500/25 text-red-200 border-red-500/30 hover:border-red-400/50',
  },
  success: {
    container: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/15 ring-1 ring-emerald-500/20',
    icon: 'text-emerald-300',
    ring: 'from-emerald-500/30 to-emerald-500/30',
    button:
      'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/30 hover:border-emerald-400/50',
  },
  pending: {
    container: 'bg-gradient-to-br from-amber-500/15 to-amber-500/15 ring-1 ring-amber-500/20',
    icon: 'text-amber-300',
    ring: 'from-amber-500/30 to-amber-500/30',
    button:
      'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/30 hover:border-amber-400/50',
  },
}

// ─── EmptyState ────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const styles = variantStyles[variant]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        className
      )}
    >
      {/* Icon container with pulsing ring */}
      <div className="relative mb-5">
        {/* Expanding pulse ring */}
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          className={cn(
            'absolute inset-0 rounded-full bg-gradient-to-br',
            styles.ring
          )}
        />
        {/* Icon disc */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className={cn(
            'relative flex items-center justify-center w-16 h-16 rounded-full',
            styles.container
          )}
        >
          <Icon className={cn('w-7 h-7', styles.icon)} strokeWidth={1.75} />
        </motion.div>
      </div>

      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-slate-400 max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={action.onClick}
          className={cn(
            'mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg',
            'text-sm font-medium border backdrop-blur-sm transition-colors duration-200',
            styles.button
          )}
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  )
}

// ─── Presets ───────────────────────────────────────────────────────

/** Default-styled empty state for "no data yet" scenarios. */
export function NoDataEmpty({ title, desc }: { title: string; desc?: string }) {
  return (
    <EmptyState
      icon={Database}
      title={title}
      description={desc}
      variant="default"
    />
  )
}

/** Error empty state with an optional retry action. */
export function ErrorEmpty({
  title,
  desc,
  onRetry,
}: {
  title: string
  desc?: string
  onRetry?: () => void
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description={desc}
      variant="error"
      action={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
    />
  )
}

/** Pending / in-progress empty state. */
export function PendingEmpty({ title, desc }: { title: string; desc?: string }) {
  return (
    <EmptyState
      icon={Clock}
      title={title}
      description={desc}
      variant="pending"
    />
  )
}
