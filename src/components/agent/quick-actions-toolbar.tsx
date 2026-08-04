'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, Wand2, BarChart3, Compass, CalendarClock,
  Loader2
} from 'lucide-react'
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip'

// ─── Types ─────────────────────────────────────────────────────────
interface QuickActionsToolbarProps {
  onCommand: (cmd: string) => void
  agentState: string
  loading: boolean
}

// ─── Action definitions ────────────────────────────────────────────
const ACTIONS = [
  {
    id: 'toggle-agent',
    label: 'Start / Pause',
    icon: Play,
    shortcut: '⌘⇧P',
    activeIcon: Pause,
    cmd: 'toggle',
  },
  {
    id: 'produce-next',
    label: 'Produce Next',
    icon: Wand2,
    shortcut: '⌘⇧N',
    cmd: 'produce-next',
  },
  {
    id: 'collect-analytics',
    label: 'Collect Analytics',
    icon: BarChart3,
    shortcut: '⌘⇧A',
    cmd: 'collect-analytics',
  },
  {
    id: 'review-strategy',
    label: 'Review Strategy',
    icon: Compass,
    shortcut: '⌘⇧R',
    cmd: 'strategy-review',
  },
  {
    id: 'schedule-jobs',
    label: 'Schedule Jobs',
    icon: CalendarClock,
    shortcut: '⌘⇧J',
    cmd: 'schedule-jobs',
  },
]

// ─── Active states ─────────────────────────────────────────────────
const ACTIVE_STATES = [
  'running', 'researching_niches', 'creating_strategy',
  'researching_topic', 'writing_script', 'producing_video',
  'reviewing', 'uploading', 'cycle_complete',
]

// ─── Quick Actions Toolbar ─────────────────────────────────────────
export function QuickActionsToolbar({
  onCommand,
  agentState,
  loading,
}: QuickActionsToolbarProps) {
  const isActive = ACTIVE_STATES.includes(agentState)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
      className="fixed bottom-4 right-4 z-40"
    >
      <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-700/50 backdrop-blur-xl shadow-2xl shadow-slate-900/50">
        {ACTIONS.map((action) => {
          const isToggle = action.id === 'toggle-agent'
          const Icon = isToggle && isActive ? action.activeIcon : action.icon
          const isDisabled = loading && !isToggle

          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    if (isDisabled) return
                    if (isToggle) {
                      onCommand(isActive ? 'pause' : 'initial-setup')
                    } else {
                      onCommand(action.cmd)
                    }
                  }}
                  disabled={isDisabled}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200
                    ${isToggle
                      ? isActive
                        ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent'
                    }
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {loading && isToggle ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}

                  {/* Active indicator for toggle */}
                  {isToggle && isActive && (
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500"
                    />
                  )}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-800 border-slate-700/60 text-slate-200">
                <div className="flex items-center gap-2">
                  <span>{action.label}</span>
                  <kbd className="px-1 py-0.5 rounded border border-slate-600/60 bg-slate-700/60 text-[9px] text-slate-400 font-mono">
                    {action.shortcut}
                  </kbd>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </motion.div>
  )
}
