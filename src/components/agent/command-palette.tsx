'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Play,
  Pause,
  RefreshCw,
  Activity,
  Square,
  Home,
  GitBranch,
  Target,
  Calendar,
  DollarSign,
  BarChart3,
  Lightbulb,
  FlaskConical,
  ScrollText,
  Settings,
  Keyboard,
  FileText,
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

export interface CommandPaletteStats {
  totalIdeas: number
  approvedVideos: number
  uploadedVideos: number
  jobsQueued: number
}

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (actionId: string) => void
  onNavigate: (tabValue: string) => void
  stats?: CommandPaletteStats
  className?: string
}

type CommandKind = 'action' | 'navigate' | 'stat' | 'help'

interface Command {
  id: string
  label: string
  group: string
  kind: CommandKind
  shortcut?: string
  icon: React.ElementType
  iconColor: string
  actionId?: string
  tabValue?: string
  statKey?: keyof CommandPaletteStats
  helpId?: string
  selectable: boolean
}

// ─── Constants ─────────────────────────────────────────────────────

const RECENT_STORAGE_KEY = 'cmd-palette-recent-v1'
const MAX_RECENT = 5

const GROUP_ORDER = ['Actions', 'Navigation', 'Quick Stats', 'Help'] as const

// ─── Commands Definition ───────────────────────────────────────────
// Icons are restricted to the lucide-react set enumerated in the task
// brief (Zap, Play, Pause, RefreshCw, Activity, Square, Home, GitBranch,
// Target, Calendar, DollarSign, BarChart3, Lightbulb, FlaskConical,
// ScrollText, Settings, Keyboard, FileText). A small number of icons
// are intentionally reused across commands where the semantic fit is
// natural (e.g. Activity for both Full Cycle and Uploaded Videos).
// Accent colors are limited to violet / cyan / emerald / amber / rose
// per the project palette (no indigo, no blue primary).

const COMMANDS: Command[] = [
  // ── Actions ──
  {
    id: 'act-produce-next',
    label: 'Produce Next Video',
    group: 'Actions',
    kind: 'action',
    shortcut: 'Ctrl+P',
    icon: Zap,
    iconColor: 'text-amber-400',
    actionId: 'produce-next',
    selectable: true,
  },
  {
    id: 'act-full-cycle',
    label: 'Full Cycle',
    group: 'Actions',
    kind: 'action',
    shortcut: 'Ctrl+Shift+C',
    icon: Activity,
    iconColor: 'text-emerald-400',
    actionId: 'full-cycle',
    selectable: true,
  },
  {
    id: 'act-pause',
    label: 'Pause Agent',
    group: 'Actions',
    kind: 'action',
    shortcut: 'Space',
    icon: Pause,
    iconColor: 'text-amber-400',
    actionId: 'pause',
    selectable: true,
  },
  {
    id: 'act-resume',
    label: 'Resume Agent',
    group: 'Actions',
    kind: 'action',
    shortcut: 'Space',
    icon: Play,
    iconColor: 'text-emerald-400',
    actionId: 'resume',
    selectable: true,
  },
  {
    id: 'act-process-job',
    label: 'Process Job',
    group: 'Actions',
    kind: 'action',
    shortcut: 'Ctrl+J',
    icon: Activity,
    iconColor: 'text-cyan-400',
    actionId: 'process-job',
    selectable: true,
  },
  {
    id: 'act-emergency-stop',
    label: 'Emergency Stop',
    group: 'Actions',
    kind: 'action',
    shortcut: 'Ctrl+E',
    icon: Square,
    iconColor: 'text-rose-400',
    actionId: 'emergency-stop',
    selectable: true,
  },
  {
    id: 'act-refresh',
    label: 'Refresh Data',
    group: 'Actions',
    kind: 'action',
    shortcut: 'Ctrl+R',
    icon: RefreshCw,
    iconColor: 'text-cyan-400',
    actionId: 'refresh',
    selectable: true,
  },

  // ── Navigation ──
  {
    id: 'nav-overview',
    label: 'Go to Overview',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+1',
    icon: Home,
    iconColor: 'text-violet-400',
    tabValue: 'overview',
    selectable: true,
  },
  {
    id: 'nav-pipeline',
    label: 'Go to Pipeline',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+2',
    icon: GitBranch,
    iconColor: 'text-cyan-400',
    tabValue: 'pipeline',
    selectable: true,
  },
  {
    id: 'nav-strategy',
    label: 'Go to Strategy',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+3',
    icon: Target,
    iconColor: 'text-violet-400',
    tabValue: 'strategy',
    selectable: true,
  },
  {
    id: 'nav-calendar',
    label: 'Go to Calendar',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+4',
    icon: Calendar,
    iconColor: 'text-cyan-400',
    tabValue: 'calendar',
    selectable: true,
  },
  {
    id: 'nav-revenue',
    label: 'Go to Revenue',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+5',
    icon: DollarSign,
    iconColor: 'text-emerald-400',
    tabValue: 'revenue',
    selectable: true,
  },
  {
    id: 'nav-analytics',
    label: 'Go to Analytics',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+6',
    icon: BarChart3,
    iconColor: 'text-cyan-400',
    tabValue: 'analytics',
    selectable: true,
  },
  {
    id: 'nav-opportunities',
    label: 'Go to Opportunities',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+7',
    icon: Lightbulb,
    iconColor: 'text-amber-400',
    tabValue: 'opportunities',
    selectable: true,
  },
  {
    id: 'nav-experiments',
    label: 'Go to Experiments',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+8',
    icon: FlaskConical,
    iconColor: 'text-violet-400',
    tabValue: 'experiments',
    selectable: true,
  },
  {
    id: 'nav-logs',
    label: 'Go to Logs',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+9',
    icon: ScrollText,
    iconColor: 'text-cyan-400',
    tabValue: 'logs',
    selectable: true,
  },
  {
    id: 'nav-settings',
    label: 'Go to Settings',
    group: 'Navigation',
    kind: 'navigate',
    shortcut: 'Ctrl+0',
    icon: Settings,
    iconColor: 'text-slate-400',
    tabValue: 'settings',
    selectable: true,
  },

  // ── Quick Stats (read-only, non-selectable) ──
  {
    id: 'stat-total-ideas',
    label: 'Total Ideas',
    group: 'Quick Stats',
    kind: 'stat',
    icon: Lightbulb,
    iconColor: 'text-amber-400',
    statKey: 'totalIdeas',
    selectable: false,
  },
  {
    id: 'stat-approved',
    label: 'Approved Videos',
    group: 'Quick Stats',
    kind: 'stat',
    icon: Play,
    iconColor: 'text-emerald-400',
    statKey: 'approvedVideos',
    selectable: false,
  },
  {
    id: 'stat-uploaded',
    label: 'Uploaded Videos',
    group: 'Quick Stats',
    kind: 'stat',
    icon: Activity,
    iconColor: 'text-emerald-400',
    statKey: 'uploadedVideos',
    selectable: false,
  },
  {
    id: 'stat-jobs',
    label: 'Jobs Queued',
    group: 'Quick Stats',
    kind: 'stat',
    icon: ScrollText,
    iconColor: 'text-cyan-400',
    statKey: 'jobsQueued',
    selectable: false,
  },

  // ── Help ──
  {
    id: 'help-shortcuts',
    label: 'Show Keyboard Shortcuts',
    group: 'Help',
    kind: 'help',
    shortcut: 'Ctrl+/',
    icon: Keyboard,
    iconColor: 'text-violet-400',
    helpId: 'show-shortcuts',
    selectable: true,
  },
  {
    id: 'help-docs',
    label: 'View Documentation',
    group: 'Help',
    kind: 'help',
    icon: FileText,
    iconColor: 'text-cyan-400',
    helpId: 'view-docs',
    selectable: true,
  },
]

// ─── localStorage helpers (recent commands) ────────────────────────

function loadRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is string => typeof x === 'string')
      .slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

function saveRecent(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify(ids.slice(0, MAX_RECENT))
    )
  } catch {
    // ignore quota / private-mode errors
  }
}

// ─── Small UI bits ─────────────────────────────────────────────────

function KeyHint({ shortcut }: { shortcut: string }) {
  return (
    <Badge
      className={cn(
        'h-5 shrink-0 select-none border-slate-700/60 bg-slate-800/80 px-1.5',
        'font-mono text-[10px] font-semibold text-slate-400',
        'shadow-[0_1px_0_0_rgba(0,0,0,0.3)]'
      )}
    >
      {shortcut}
    </Badge>
  )
}

function FooterKeyHint({ children }: { children: React.ReactNode }) {
  return (
    <Badge
      className={cn(
        'h-4 select-none border-slate-700/40 bg-slate-800/40 px-1',
        'font-mono text-[9px] font-semibold text-slate-500'
      )}
    >
      {children}
    </Badge>
  )
}

// ─── Main Component ────────────────────────────────────────────────

const CommandPalette = React.forwardRef<HTMLDivElement, CommandPaletteProps>(
  function CommandPalette(
    { open, onOpenChange, onAction, onNavigate, stats, className },
    forwardedRef
  ) {
    const [query, setQuery] = React.useState('')
    const [selectedIdx, setSelectedIdx] = React.useState(0)
    const [recentIds, setRecentIds] = React.useState<string[]>([])
    const inputRef = React.useRef<HTMLInputElement>(null)
    const listRef = React.useRef<HTMLDivElement>(null)
    const previousActiveRef = React.useRef<HTMLElement | null>(null)

    // Load recent commands on mount (client-only).
    React.useEffect(() => {
      setRecentIds(loadRecent())
    }, [])

    // Reset query + selection + autofocus input when the palette opens.
    // Also lock body scroll and restore focus to the previous active
    // element when closed.
    React.useEffect(() => {
      if (!open) return

      previousActiveRef.current =
        (document.activeElement as HTMLElement | null) ?? null
      setQuery('')
      setSelectedIdx(0)

      const focusTimer = window.setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 60)

      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'

      return () => {
        window.clearTimeout(focusTimer)
        document.body.style.overflow = prevOverflow
        try {
          previousActiveRef.current?.focus()
        } catch {
          // ignore
        }
      }
    }, [open])

    // Filter commands (case-insensitive substring match on label + group).
    const filtered = React.useMemo(() => {
      const q = query.trim().toLowerCase()
      if (!q) return COMMANDS
      return COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q)
      )
    }, [query])

    // Resolve recent command objects.
    const recentCmds = React.useMemo(() => {
      return recentIds
        .map((id) => COMMANDS.find((c) => c.id === id))
        .filter((c): c is Command => Boolean(c))
    }, [recentIds])

    const showRecent = !query.trim() && recentCmds.length > 0
    const recentIdSet = React.useMemo(
      () => new Set(recentCmds.map((c) => c.id)),
      [recentCmds]
    )

    // Build the ordered list of sections to render.
    const displaySections = React.useMemo(() => {
      const sections: { heading: string | null; commands: Command[] }[] = []

      if (showRecent) {
        sections.push({ heading: 'Recent', commands: recentCmds })
      }

      const grouped = new Map<string, Command[]>()
      for (const cmd of filtered) {
        // When the Recent section is visible (no query), exclude recent
        // items from their normal groups so they aren't duplicated in
        // the keyboard-navigation list.
        if (showRecent && recentIdSet.has(cmd.id)) continue
        if (!grouped.has(cmd.group)) grouped.set(cmd.group, [])
        grouped.get(cmd.group)!.push(cmd)
      }

      for (const g of GROUP_ORDER) {
        const cmds = grouped.get(g)
        if (cmds && cmds.length > 0) {
          sections.push({ heading: g, commands: cmds })
        }
      }
      return sections
    }, [filtered, showRecent, recentCmds, recentIdSet])

    // Flat list of selectable commands (for arrow-key navigation).
    const flatSelectable = React.useMemo(() => {
      const flat: Command[] = []
      for (const sec of displaySections) {
        for (const cmd of sec.commands) {
          if (cmd.selectable) flat.push(cmd)
        }
      }
      return flat
    }, [displaySections])

    // Map command id → flat index (for highlighting in render).
    const selectableIndexMap = React.useMemo(() => {
      const m = new Map<string, number>()
      flatSelectable.forEach((c, i) => m.set(c.id, i))
      return m
    }, [flatSelectable])

    // Keep selectedIdx within bounds when the list shrinks.
    React.useEffect(() => {
      if (selectedIdx >= flatSelectable.length) {
        setSelectedIdx(
          flatSelectable.length > 0 ? flatSelectable.length - 1 : 0
        )
      }
    }, [flatSelectable, selectedIdx])

    // Scroll the highlighted command into view.
    React.useEffect(() => {
      if (!open) return
      const el = listRef.current?.querySelector<HTMLDivElement>(
        `[data-cmd-idx="${selectedIdx}"]`
      )
      el?.scrollIntoView({ block: 'nearest' })
    }, [selectedIdx, open])

    // Execute a command (called on Enter or click).
    const executeCommand = React.useCallback(
      (cmd: Command) => {
        if (!cmd.selectable) return

        if (cmd.kind === 'action' && cmd.actionId) {
          onAction(cmd.actionId)
        } else if (cmd.kind === 'navigate' && cmd.tabValue) {
          onNavigate(cmd.tabValue)
        } else if (cmd.kind === 'help' && cmd.helpId) {
          // Help commands route through onAction with their helpId.
          onAction(cmd.helpId)
        }

        // Push to recent list (dedupe + cap at MAX_RECENT).
        setRecentIds((prev) => {
          const next = [cmd.id, ...prev.filter((id) => id !== cmd.id)].slice(
            0,
            MAX_RECENT
          )
          saveRecent(next)
          return next
        })

        onOpenChange(false)
      },
      [onAction, onNavigate, onOpenChange]
    )

    // Keyboard handler attached to the palette root (events bubble from
    // the focused search input).
    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          if (flatSelectable.length === 0) return
          setSelectedIdx((i) => (i + 1) % flatSelectable.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          if (flatSelectable.length === 0) return
          setSelectedIdx(
            (i) => (i - 1 + flatSelectable.length) % flatSelectable.length
          )
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const cmd = flatSelectable[selectedIdx]
          if (cmd) executeCommand(cmd)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onOpenChange(false)
        } else if (e.key === 'Home') {
          e.preventDefault()
          setSelectedIdx(0)
        } else if (e.key === 'End') {
          e.preventDefault()
          setSelectedIdx(Math.max(0, flatSelectable.length - 1))
        }
      },
      [flatSelectable, selectedIdx, executeCommand, onOpenChange]
    )

    const totalCount = filtered.length

    return (
      <AnimatePresence>
        {open && (
          <motion.div
            className={cn(
              'fixed inset-0 z-[200] flex items-start justify-center',
              'p-3 pt-[8vh] sm:p-4 sm:pt-[15vh]'
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {/* Backdrop (click outside to close) */}
            <div
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => onOpenChange(false)}
              aria-hidden="true"
            />

            {/* Palette */}
            <motion.div
              ref={forwardedRef}
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onKeyDown={handleKeyDown}
              className={cn(
                'relative z-10 flex max-h-[82vh] w-[95vw] max-w-2xl flex-col overflow-hidden',
                'rounded-xl border border-slate-800/60 bg-slate-950/95 backdrop-blur-xl',
                'shadow-2xl shadow-black/50',
                className
              )}
            >
              {/* ── Search Input ── */}
              <div className="flex items-center gap-3 border-b border-slate-800/60 px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedIdx(0)
                  }}
                  placeholder="Type a command or search…"
                  className={cn(
                    'flex-1 bg-transparent text-sm text-slate-100',
                    'placeholder:text-slate-500 outline-none'
                  )}
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  aria-label="Search commands"
                  aria-autocomplete="list"
                  aria-controls="command-palette-list"
                />
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                    'text-slate-500 transition-colors',
                    'hover:bg-slate-800/60 hover:text-slate-300'
                  )}
                  aria-label="Close command palette"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* ── Command List (scrollable) ── */}
              <div
                id="command-palette-list"
                ref={listRef}
                role="listbox"
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2"
              >
                {displaySections.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <Search className="mx-auto mb-3 h-7 w-7 text-slate-700" />
                    <p className="text-sm text-slate-500">
                      No commands found for
                      <span className="ml-1 font-mono text-slate-400">
                        &ldquo;{query}&rdquo;
                      </span>
                    </p>
                  </div>
                ) : (
                  displaySections.map((section) => {
                    const sectionKey = section.heading ?? 'recent'
                    return (
                      <div key={sectionKey} className="mb-1.5 last:mb-0">
                        {section.heading && (
                          <div
                            className={cn(
                              'px-3 py-2 text-[10px] font-semibold uppercase tracking-wider',
                              'text-slate-500'
                            )}
                          >
                            {section.heading}
                          </div>
                        )}
                        <div className="px-1.5">
                          {section.commands.map((cmd) => {
                            const idx = cmd.selectable
                              ? selectableIndexMap.get(cmd.id)
                              : undefined
                            const isSelected =
                              idx !== undefined && idx === selectedIdx
                            const Icon = cmd.icon
                            const statValue =
                              cmd.statKey && stats
                                ? stats[cmd.statKey]
                                : undefined

                            return (
                              <div
                                key={cmd.id}
                                data-cmd-idx={idx ?? -1}
                                data-selected={isSelected}
                                role="option"
                                aria-selected={isSelected}
                                onMouseEnter={() => {
                                  if (
                                    cmd.selectable &&
                                    idx !== undefined &&
                                    idx !== selectedIdx
                                  ) {
                                    setSelectedIdx(idx)
                                  }
                                }}
                                onClick={() => {
                                  if (cmd.selectable) executeCommand(cmd)
                                }}
                                className={cn(
                                  'group flex select-none items-center gap-3 rounded-md px-2.5 py-2',
                                  'text-sm transition-colors',
                                  cmd.selectable
                                    ? cn(
                                        'cursor-pointer hover:bg-slate-800/60',
                                        'data-[selected=true]:bg-violet-500/15 data-[selected=true]:text-violet-200'
                                      )
                                    : 'cursor-default'
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                                    'bg-slate-800/50 transition-colors',
                                    cmd.selectable && isSelected &&
                                      'bg-violet-500/15'
                                  )}
                                >
                                  <Icon
                                    className={cn(
                                      'h-4 w-4',
                                      cmd.iconColor
                                    )}
                                  />
                                </span>
                                <span className="flex-1 truncate text-slate-200">
                                  {cmd.label}
                                </span>
                                {cmd.kind === 'stat' && (
                                  <span
                                    className={cn(
                                      'shrink-0 font-mono text-xs tabular-nums',
                                      isSelected
                                        ? 'text-violet-200'
                                        : 'text-slate-400'
                                    )}
                                  >
                                    {statValue ?? '—'}
                                  </span>
                                )}
                                {cmd.shortcut && (
                                  <KeyHint shortcut={cmd.shortcut} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* ── Sticky Footer ── */}
              <div
                className={cn(
                  'flex items-center justify-between gap-3 px-4 py-2',
                  'border-t border-slate-800/60 text-[11px] text-slate-500'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-400">
                    {totalCount}
                  </span>
                  <span>{totalCount === 1 ? 'result' : 'results'}</span>
                  {flatSelectable.length > 0 &&
                    flatSelectable.length !== totalCount && (
                      <span className="text-slate-600">
                        ({flatSelectable.length} selectable)
                      </span>
                    )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" />
                    <ArrowDown className="h-3 w-3" />
                    <span className="hidden sm:inline">to navigate</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CornerDownLeft className="h-3 w-3" />
                    <span className="hidden sm:inline">to select</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <FooterKeyHint>esc</FooterKeyHint>
                    <span className="hidden sm:inline">to close</span>
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }
)

export { CommandPalette }
export default CommandPalette
