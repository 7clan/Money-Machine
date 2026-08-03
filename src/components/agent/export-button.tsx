'use client'

// ───────────────────────────────────────────────────────────────────
// ExportButton — triggers a CSV download from /api/data/export.
//
//   <ExportButton type="ideas" />
//   <ExportButton type="revenue" icon label="Export Revenue CSV" />
//
// Dark theme: outline variant with a violet accent on hover.
// Compact `icon` mode renders only the Download icon (no text label).
// ───────────────────────────────────────────────────────────────────

import * as React from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ExportButtonType =
  | 'ideas'
  | 'projects'
  | 'uploads'
  | 'revenue'
  | 'analytics'
  | 'audit-logs'
  | 'jobs'

export interface ExportButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'onClick'> {
  type: ExportButtonType
  /** Custom button label. Defaults to "Export <Type>". */
  label?: string
  /** When true, renders only the icon (compact mode). Default false. */
  icon?: boolean
}

/** Capitalize a kebab-or-lower type into a friendly label word. */
function defaultLabel(type: ExportButtonType): string {
  const word = type === 'audit-logs' ? 'Audit Logs' : type
  if (word === 'audit-logs') return 'Audit Logs'
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function ExportButton({
  type,
  label,
  icon = false,
  className,
  disabled,
  variant = 'outline',
  size,
  ...props
}: ExportButtonProps) {
  const [loading, setLoading] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleDownload = React.useCallback(() => {
    if (loading || disabled) return
    setLoading(true)
    // Trigger the browser's native download by creating a temporary anchor
    // with `download`. This avoids opening a new tab for CSVs.
    try {
      const url = `/api/data/export?type=${encodeURIComponent(type)}`
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener'
      // Hint the browser to download rather than navigate. The actual
      // filename comes from the server's Content-Disposition header.
      a.download = ''
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('[export-button] download failed', err)
    } finally {
      // Brief loading state for UX feedback. Server controls true duration.
      timerRef.current = setTimeout(() => setLoading(false), 900)
    }
  }, [type, loading, disabled])

  const displayLabel = label ?? `Export ${defaultLabel(type)}`

  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (icon ? 'icon' : 'sm')}
      onClick={handleDownload}
      disabled={loading || disabled}
      aria-label={icon ? displayLabel : undefined}
      title={icon ? displayLabel : undefined}
      className={cn(
        // Dark theme: slate-900 base, violet accent on hover.
        'border-slate-700/60 bg-slate-900/60 text-slate-200',
        'hover:border-violet-500/60 hover:bg-violet-500/10 hover:text-violet-200',
        'focus-visible:ring-violet-500/40',
        'transition-colors duration-200',
        loading && 'cursor-wait',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {!icon && <span>{displayLabel}</span>}
    </Button>
  )
}
