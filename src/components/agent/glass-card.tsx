'use client'

import { motion, type TargetAndTransition } from 'framer-motion'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────
interface GlassCardProps {
  children: React.ReactNode
  variant?: 'default' | 'glow' | 'gradient' | 'bordered'
  /** Tailwind "from-*" color class for glow & gradient variants, e.g. 'from-violet-500' */
  glowFrom?: string
  /** Tailwind "to-*" color class for glow & gradient variants, e.g. 'to-cyan-500' */
  glowTo?: string
  className?: string
  /** Enable hover effects (scale + border brighten + glow intensify) */
  hover?: boolean
  onClick?: () => void
}

// ─── Color Lookup ──────────────────────────────────────────────────
// Maps common Tailwind 500-shade color classes to their hex values so
// the glow/gradient variants can use inline styles (reliable across
// Tailwind purge passes) while still accepting the Tailwind-class API.
const COLOR_MAP: Record<string, string> = {
  'from-violet-500': '#8b5cf6',
  'from-cyan-500': '#06b6d4',
  'from-emerald-500': '#10b981',
  'from-amber-500': '#f59e0b',
  'from-rose-500': '#f43f5e',
  'from-red-500': '#ef4444',
  'from-fuchsia-500': '#d946ef',
  'from-sky-500': '#0ea5e9',
  'to-violet-500': '#8b5cf6',
  'to-cyan-500': '#06b6d4',
  'to-emerald-500': '#10b981',
  'to-amber-500': '#f59e0b',
  'to-rose-500': '#f43f5e',
  'to-red-500': '#ef4444',
  'to-fuchsia-500': '#d946ef',
  'to-sky-500': '#0ea5e9',
}

function resolveColor(cls: string | undefined, fallback: string): string {
  if (!cls) return fallback
  return COLOR_MAP[cls] || fallback
}

// ─── GlassCard ─────────────────────────────────────────────────────
export function GlassCard({
  children,
  variant = 'default',
  glowFrom = 'from-violet-500',
  glowTo = 'to-cyan-500',
  className,
  hover = false,
  onClick,
}: GlassCardProps) {
  const fromColor = resolveColor(glowFrom, '#8b5cf6')
  const toColor = resolveColor(glowTo, '#06b6d4')

  const hoverAnimation: TargetAndTransition = {
    scale: 1.01,
    transition: { duration: 0.2, ease: 'easeOut' },
  }

  const interactive = hover || Boolean(onClick)

  // ── Gradient variant: wrapper technique (1px gradient border) ──
  if (variant === 'gradient') {
    return (
      <motion.div
        whileHover={interactive ? hoverAnimation : undefined}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        className={cn(
          'group relative rounded-xl p-px',
          interactive && 'cursor-pointer',
          className
        )}
        style={{
          background: `linear-gradient(135deg, ${fromColor}, ${toColor})`,
        }}
      >
        <div className="relative rounded-[11px] bg-slate-900/80 backdrop-blur-sm border border-slate-800/30 h-full transition-colors duration-300 group-hover:border-slate-700/60">
          {children}
        </div>
      </motion.div>
    )
  }

  // ── default / glow / bordered variants ──
  const variantClasses: Record<
    Exclude<GlassCardProps['variant'], 'gradient' | undefined>,
    string
  > = {
    default: 'bg-slate-900/40 border border-slate-800/50',
    glow: 'bg-slate-900/40 border border-slate-800/50',
    bordered:
      'bg-slate-900/40 border-2 border-violet-500/40 shadow-[0_0_0_1px_rgba(6,182,212,0.08),inset_0_1px_0_0_rgba(255,255,255,0.04)]',
  }

  const glowStyle =
    variant === 'glow'
      ? ({
          '--glass-glow-from': fromColor,
          '--glass-glow-to': toColor,
        } as React.CSSProperties)
      : undefined

  const glowClasses =
    variant === 'glow'
      ? cn(
          'before:content-[""] before:absolute before:-inset-4 before:rounded-2xl',
          'before:blur-3xl before:opacity-[0.08] before:-z-10 before:pointer-events-none',
          'before:bg-[radial-gradient(circle_at_top_left,var(--glass-glow-from),var(--glass-glow-to))]',
          hover && 'hover:before:opacity-[0.18] before:transition-opacity before:duration-500'
        )
      : ''

  return (
    <motion.div
      whileHover={interactive ? hoverAnimation : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={glowStyle}
      className={cn(
        'relative rounded-xl backdrop-blur-sm',
        variantClasses[variant as 'default' | 'glow' | 'bordered'],
        glowClasses,
        interactive && 'cursor-pointer transition-colors duration-300 hover:border-slate-700/70',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
