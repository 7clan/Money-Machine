'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Keyboard,
  Command,
  AlertOctagon,
  Play,
  Pause,
  RefreshCw,
  Rocket,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

export interface KeyboardShortcutsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCommand: (command: string) => void
}

interface ShortcutEntry {
  keys: string[]
  description: string
  icon: React.ElementType
  command: string
  category: string
}

interface ToastEntry {
  id: number
  message: string
  icon?: React.ElementType
}

// ─── Shortcuts Definition ──────────────────────────────────────────

const SHORTCUTS: ShortcutEntry[] = [
  {
    keys: ['Ctrl', 'K'],
    description: 'Open command palette',
    icon: Command,
    command: 'command-palette',
    category: 'General',
  },
  {
    keys: ['Ctrl', 'E'],
    description: 'Toggle emergency stop',
    icon: AlertOctagon,
    command: 'emergency-stop',
    category: 'General',
  },
  {
    keys: ['Ctrl', 'P'],
    description: 'Produce next video',
    icon: Rocket,
    command: 'produce-next',
    category: 'Actions',
  },
  {
    keys: ['Ctrl', 'R'],
    description: 'Refresh data',
    icon: RefreshCw,
    command: 'refresh',
    category: 'Actions',
  },
  {
    keys: ['Ctrl', '/'],
    description: 'Show keyboard shortcuts',
    icon: Search,
    command: 'show-shortcuts',
    category: 'General',
  },
  {
    keys: ['Space'],
    description: 'Pause / Resume agent',
    icon: Play,
    command: 'toggle-pause',
    category: 'Actions',
  },
  {
    keys: ['Ctrl', '1'],
    description: 'Switch to tab 1',
    icon: Keyboard,
    command: 'tab-1',
    category: 'Navigation',
  },
  {
    keys: ['Ctrl', '2'],
    description: 'Switch to tab 2',
    icon: Keyboard,
    command: 'tab-2',
    category: 'Navigation',
  },
  {
    keys: ['Ctrl', '3'],
    description: 'Switch to tab 3',
    icon: Keyboard,
    command: 'tab-3',
    category: 'Navigation',
  },
  {
    keys: ['Ctrl', '4'],
    description: 'Switch to tab 4',
    icon: Keyboard,
    command: 'tab-4',
    category: 'Navigation',
  },
  {
    keys: ['Ctrl', '5'],
    description: 'Switch to tab 5',
    icon: Keyboard,
    command: 'tab-5',
    category: 'Navigation',
  },
  {
    keys: ['Ctrl', '6'],
    description: 'Switch to tab 6',
    icon: Keyboard,
    command: 'tab-6',
    category: 'Navigation',
  },
  {
    keys: ['Ctrl', '7'],
    description: 'Switch to tab 7',
    icon: Keyboard,
    command: 'tab-7',
    category: 'Navigation',
  },
  {
    keys: ['Ctrl', '8'],
    description: 'Switch to tab 8',
    icon: Keyboard,
    command: 'tab-8',
    category: 'Navigation',
  },
]

// ─── Key Combo Display ─────────────────────────────────────────────

function KeyCombo({ keys }: { keys: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          {i > 0 && (
            <span className="text-[10px] text-slate-600">+</span>
          )}
          <Badge
            className={cn(
              'min-w-[28px] justify-center border border-slate-600 bg-slate-800',
              'px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-200',
              'shadow-[0_1px_0_0_rgba(0,0,0,0.3)]'
            )}
          >
            {key}
          </Badge>
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Toast Notification ────────────────────────────────────────────

function ToastNotification({ toast }: { toast: ToastEntry }) {
  const Icon = toast.icon ?? Command
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border border-slate-700/60',
        'bg-slate-900/90 px-4 py-2.5 shadow-xl shadow-black/30',
        'backdrop-blur-md'
      )}
    >
      <Icon className="h-3.5 w-3.5 text-violet-400" />
      <span className="text-xs font-medium text-slate-200">{toast.message}</span>
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────

export function KeyboardShortcuts({
  open,
  onOpenChange,
  onCommand,
}: KeyboardShortcutsProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const toastIdRef = React.useRef(0)

  // Show a toast for 3 seconds
  const showToast = useCallback(
    (message: string, icon?: React.ElementType) => {
      const id = ++toastIdRef.current
      setToasts((prev) => [...prev, { id, message, icon }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3000)
    },
    []
  )

  // ── Keyboard listener ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+K → command palette
      if (ctrl && e.key === 'k') {
        e.preventDefault()
        onCommand('command-palette')
        showToast('Command palette opened', Command)
        return
      }

      // Ctrl+E → emergency stop
      if (ctrl && e.key === 'e') {
        e.preventDefault()
        onCommand('emergency-stop')
        showToast('Emergency stop toggled', AlertOctagon)
        return
      }

      // Ctrl+P → produce next
      if (ctrl && e.key === 'p') {
        e.preventDefault()
        onCommand('produce-next')
        showToast('Producing next video…', Rocket)
        return
      }

      // Ctrl+R → refresh
      if (ctrl && e.key === 'r') {
        e.preventDefault()
        onCommand('refresh')
        showToast('Data refreshed', RefreshCw)
        return
      }

      // Ctrl+/ → show shortcuts
      if (ctrl && e.key === '/') {
        e.preventDefault()
        onOpenChange(!open)
        return
      }

      // Ctrl+1-8 → tab switching
      if (ctrl && e.key >= '1' && e.key <= '8') {
        e.preventDefault()
        const tabNum = e.key
        onCommand(`tab-${tabNum}`)
        showToast(`Switched to tab ${tabNum}`, Keyboard)
        return
      }

      // Space → toggle pause
      if (e.key === ' ' && !ctrl) {
        e.preventDefault()
        onCommand('toggle-pause')
        showToast('Agent paused / resumed', Play)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange, onCommand, showToast])

  // ── Group shortcuts by category ──
  const grouped = React.useMemo(() => {
    const map = new Map<string, ShortcutEntry[]>()
    for (const s of SHORTCUTS) {
      if (!map.has(s.category)) map.set(s.category, [])
      map.get(s.category)!.push(s)
    }
    return map
  }, [])

  return (
    <>
      {/* ── Sheet Overlay ── */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="border-slate-800 bg-slate-950/95 backdrop-blur-lg"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-slate-100">
              <Keyboard className="h-5 w-5 text-violet-400" />
              Keyboard Shortcuts
            </SheetTitle>
            <SheetDescription className="text-slate-500">
              Press the key combination to trigger an action.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {Array.from(grouped.entries()).map(([category, items], catIdx) => (
              <div key={category} className="mt-4 first:mt-0">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {category}
                </h3>
                <div className="space-y-1.5">
                  {items.map((shortcut) => {
                    const Icon = shortcut.icon
                    return (
                      <motion.button
                        key={shortcut.command}
                        onClick={() => {
                          onCommand(shortcut.command)
                          onOpenChange(false)
                          showToast(shortcut.description, Icon)
                        }}
                        whileHover={{ scale: 1.02, x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border border-slate-800/50',
                          'bg-slate-900/40 p-3 text-left transition-colors',
                          'hover:border-slate-700/60 hover:bg-slate-800/40'
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-800/60">
                          <Icon className="h-4 w-4 text-slate-400" />
                        </div>
                        <span className="flex-1 text-xs font-medium text-slate-300">
                          {shortcut.description}
                        </span>
                        <KeyCombo keys={shortcut.keys} />
                      </motion.button>
                    )
                  })}
                </div>
                {catIdx < grouped.size - 1 && (
                  <Separator className="mt-3 bg-slate-800/40" />
                )}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="border-t border-slate-800/40 px-4 py-3">
            <p className="text-center text-[10px] text-slate-600">
              Press <KeyCombo keys={['Ctrl', '/']} /> to toggle this panel
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Toast Stack (bottom-right) ── */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastNotification key={toast.id} toast={toast} />
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}
