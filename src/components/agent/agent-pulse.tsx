'use client'

import { motion } from 'framer-motion'
import { Activity, Loader2, Pause, AlertCircle, CircleDot } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────
interface AgentPulseIndicatorProps {
  state: string
  currentJob: string | null
  nextAction: string | null
}

// ─── State Config ──────────────────────────────────────────────────
const STATE_CONFIG: Record<string, {
  dotColor: string
  ringColor: string
  textColor: string
  bgColor: string
  label: string
  icon: typeof Activity
}> = {
  idle: {
    dotColor: 'bg-slate-400',
    ringColor: 'ring-slate-400/30',
    textColor: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
    label: 'Idle',
    icon: CircleDot,
  },
  running: {
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Running',
    icon: Loader2,
  },
  researching_niches: {
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Researching',
    icon: Loader2,
  },
  creating_strategy: {
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Strategy',
    icon: Loader2,
  },
  researching_topic: {
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Researching',
    icon: Loader2,
  },
  writing_script: {
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Writing',
    icon: Loader2,
  },
  producing_video: {
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Producing',
    icon: Loader2,
  },
  reviewing: {
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Reviewing',
    icon: Loader2,
  },
  uploading: {
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Uploading',
    icon: Loader2,
  },
  cycle_complete: {
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    label: 'Complete',
    icon: Activity,
  },
  error: {
    dotColor: 'bg-red-500',
    ringColor: 'ring-red-500/30',
    textColor: 'text-red-400',
    bgColor: 'bg-red-500/10',
    label: 'Error',
    icon: AlertCircle,
  },
  paused: {
    dotColor: 'bg-amber-500',
    ringColor: 'ring-amber-500/30',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    label: 'Paused',
    icon: Pause,
  },
}

const ACTIVE_STATES = [
  'running', 'researching_niches', 'creating_strategy',
  'researching_topic', 'writing_script', 'producing_video',
  'reviewing', 'uploading', 'cycle_complete',
]

// ─── Cycle Progress ────────────────────────────────────────────────
// Deterministic cycle progress based on state
function cycleProgress(state: string): number {
  const progressMap: Record<string, number> = {
    idle: 0,
    researching_niches: 15,
    creating_strategy: 30,
    researching_topic: 45,
    writing_script: 60,
    producing_video: 75,
    reviewing: 88,
    uploading: 95,
    cycle_complete: 100,
    error: 0,
    paused: 50,
  }
  return progressMap[state] ?? 0
}

// ─── Agent Pulse Indicator ─────────────────────────────────────────
export function AgentPulseIndicator({
  state,
  currentJob,
  nextAction,
}: AgentPulseIndicatorProps) {
  const config = STATE_CONFIG[state] || STATE_CONFIG.idle
  const isActive = ACTIVE_STATES.includes(state)
  const progress = cycleProgress(state)
  const Icon = config.icon

  return (
    <div className="flex items-center gap-3">
      {/* Pulse dot with radiating ring */}
      <div className="relative">
        <motion.div
          animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
          className={`w-8 h-8 rounded-full ${config.dotColor} ring-3 ${config.ring} shadow-lg flex items-center justify-center`}
        >
          {/* Radiating rings when active */}
          {isActive && (
            <>
              <motion.div
                animate={{ scale: [1, 2.2], opacity: [0.35, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                className={`absolute inset-0 rounded-full ${config.dotColor}`}
              />
              <motion.div
                animate={{ scale: [1, 1.8], opacity: [0.25, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                className={`absolute inset-0 rounded-full ${config.dotColor}`}
              />
            </>
          )}
          <Icon className={`w-3.5 h-3.5 text-white ${isActive && state !== 'cycle_complete' ? 'animate-spin' : ''}`} />
        </motion.div>
      </div>

      {/* Info + progress */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${config.textColor}`}>
            {config.label}
          </span>
          {currentJob && (
            <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
              {currentJob}
            </span>
          )}
        </div>

        {/* Next action hint */}
        {nextAction && (
          <p className="text-[10px] text-slate-500 truncate">
            Next: {nextAction.replace(/_/g, ' ')}
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1 w-20 rounded-full bg-slate-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`h-full rounded-full ${config.dotColor}`}
            />
          </div>
          <span className="text-[9px] text-slate-600 font-mono">
            {progress}%
          </span>
        </div>
      </div>
    </div>
  )
}
