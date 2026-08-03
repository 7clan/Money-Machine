'use client'

// ───────────────────────────────────────────────────────────────────
// ExportMenu — dropdown that lets users pick any CSV export.
//
//   <ExportMenu />
//
// Triggered by a single "Export Data" button with a Download icon.
// Lists all 7 supported export types, each with a distinct lucide icon.
// Dark theme: slate-900 surface, violet/cyan accents — no indigo/blue.
// ───────────────────────────────────────────────────────────────────

import * as React from 'react'
import {
  Download,
  Lightbulb,
  Film,
  UploadCloud,
  DollarSign,
  BarChart3,
  ScrollText,
  ListChecks,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

export type ExportMenuType =
  | 'ideas'
  | 'projects'
  | 'uploads'
  | 'revenue'
  | 'analytics'
  | 'audit-logs'
  | 'jobs'

interface ExportOption {
  type: ExportMenuType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  /** Tailwind text color class for the icon. */
  accent: string
}

const OPTIONS: readonly ExportOption[] = [
  {
    type: 'ideas',
    label: 'Video Ideas',
    description: 'Titles, scores, tags, scheduling',
    icon: Lightbulb,
    accent: 'text-amber-400',
  },
  {
    type: 'projects',
    label: 'Video Projects',
    description: 'Render state, approval, files',
    icon: Film,
    accent: 'text-violet-400',
  },
  {
    type: 'uploads',
    label: 'Uploads',
    description: 'YouTube IDs, privacy, AI flags',
    icon: UploadCloud,
    accent: 'text-cyan-400',
  },
  {
    type: 'revenue',
    label: 'Revenue Records',
    description: 'Amounts, sources, finalize state',
    icon: DollarSign,
    accent: 'text-emerald-400',
  },
  {
    type: 'analytics',
    label: 'Analytics Snapshots',
    description: 'Views, CTR, RPM/CPM, retention',
    icon: BarChart3,
    accent: 'text-fuchsia-400',
  },
  {
    type: 'audit-logs',
    label: 'Audit Logs',
    description: 'Actions, actors, targets',
    icon: ScrollText,
    accent: 'text-rose-400',
  },
  {
    type: 'jobs',
    label: 'Job Queue',
    description: 'Schedules, retries, errors',
    icon: ListChecks,
    accent: 'text-sky-400',
  },
]

// ─── Component ─────────────────────────────────────────────────────

export interface ExportMenuProps {
  /** Optional override for the trigger button label. */
  label?: string
  /** Render the trigger as an icon-only button. */
  iconOnly?: boolean
  className?: string
}

export function ExportMenu({
  label = 'Export Data',
  iconOnly = false,
  className,
}: ExportMenuProps) {
  const [activeType, setActiveType] = React.useState<ExportMenuType | null>(
    null
  )

  // Trigger the browser download by creating a temporary anchor with
  // `download`. Filename comes from the server's Content-Disposition.
  const triggerDownload = React.useCallback((type: ExportMenuType) => {
    setActiveType(type)
    try {
      const url = `/api/data/export?type=${encodeURIComponent(type)}`
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener'
      a.download = ''
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('[export-menu] download failed', err)
    } finally {
      // Brief loading feedback; the real download lifecycle is opaque
      // because the browser handles the response as a file save.
      setTimeout(() => setActiveType(null), 900)
    }
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={iconOnly ? 'icon' : 'sm'}
          aria-label={iconOnly ? label : undefined}
          title={iconOnly ? label : undefined}
          className={cn(
            'border-slate-700/60 bg-slate-900/60 text-slate-200',
            'hover:border-violet-500/60 hover:bg-violet-500/10 hover:text-violet-200',
            'focus-visible:ring-violet-500/40',
            'transition-colors duration-200',
            className
          )}
        >
          <Download className="size-4" />
          {!iconOnly && <span>{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className={cn(
          'w-64 border-slate-700/60 bg-slate-900/95 text-slate-200',
          'backdrop-blur-md shadow-2xl shadow-black/40'
        )}
      >
        <DropdownMenuLabel className="text-slate-400 text-xs uppercase tracking-wider">
          Export CSV
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-700/50" />
        {OPTIONS.map((opt) => {
          const Icon = opt.icon
          const isActive = activeType === opt.type
          return (
            <DropdownMenuItem
              key={opt.type}
              onSelect={(e) => {
                // Prevent the default close-then-handle race; we still
                // want the menu to close, so we don't preventDefault.
                e.preventDefault()
                triggerDownload(opt.type)
              }}
              className={cn(
                'group flex items-start gap-3 rounded-md px-2.5 py-2',
                'cursor-pointer focus:bg-slate-800/70 focus:text-slate-100',
                'data-[highlighted]:bg-slate-800/70'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                  'bg-slate-800/60 ring-1 ring-slate-700/40',
                  'group-hover:ring-violet-500/40 transition-colors'
                )}
              >
                {isActive ? (
                  <Loader2 className="size-4 animate-spin text-violet-300" />
                ) : (
                  <Icon className={cn('size-4', opt.accent)} />
                )}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-slate-100">
                  {opt.label}
                </span>
                <span className="text-xs text-slate-400">
                  {opt.description}
                </span>
              </span>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator className="bg-slate-700/50" />
        <div className="px-2.5 py-1.5 text-[11px] text-slate-500">
          Downloads a UTF-8 CSV with Excel-compatible BOM.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
