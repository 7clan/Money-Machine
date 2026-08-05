'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronRight, ArrowUpRight, ArrowDownRight, Minus,
  Lightbulb, Search, PenTool, Clapperboard, CloudUpload,
  Activity,
} from 'lucide-react'
import { MiniSparkline } from '@/components/agent/mini-sparkline'

// ─── Types ───────────────────────────────────────────────────────────
export interface AgentStatus {
  state: string
  currentJob: string | null
  operatingMode: string
  emergencyStop: boolean
  niche: string | null
  channelName: string | null
  pipeline: { ideas: number; researched: number; scripted: number; producing: number; reviewing: number; approved: number; uploaded: number }
  lastAction: string | null
  lastError: string | null
  nextAction: string | null
}

export interface PipelineData {
  ideas: any[]
  projects: any[]
  uploads: any[]
  scripts: any[]
  reviews: any[]
}

export interface ChannelData {
  channel: any
  youtubeConnected: boolean
  niches: any[]
  pillars: any[]
}

export interface AnalyticsData {
  totalViews?: number
  totalSubscribers?: number
  totalWatchTime?: number
  estimatedRevenue?: number
  recentVideos?: any[]
  dailyStats?: any[]
}

// ─── Pipeline Stages Config ─────────────────────────────────────────
export const PIPELINE_STAGES = [
  { key: 'ideas', label: 'Ideas', icon: Lightbulb, color: 'from-violet-500 to-purple-600', textColor: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  { key: 'researched', label: 'Research', icon: Search, color: 'from-blue-500 to-cyan-600', textColor: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { key: 'scripted', label: 'Script', icon: PenTool, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  { key: 'producing', label: 'Produce', icon: Clapperboard, color: 'from-emerald-500 to-green-600', textColor: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { key: 'reviewing', label: 'Review', icon: Activity, color: 'from-rose-500 to-pink-600', textColor: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  { key: 'uploaded', label: 'Upload', icon: CloudUpload, color: 'from-cyan-500 to-teal-600', textColor: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
]

// ─── Mode Config ────────────────────────────────────────────────────
export const MODES = [
  {
    key: 'simulation',
    label: 'Simulation',
    desc: 'Safe dry-run. No real uploads or API calls.',
    icon: ChevronRight,
    color: 'border-slate-500/50',
    activeColor: 'border-blue-500 bg-blue-500/10',
    badge: 'bg-blue-500/20 text-blue-300',
  },
  {
    key: 'private_production',
    label: 'Private Production',
    desc: 'Produce & upload as private. No public release.',
    icon: ChevronRight,
    color: 'border-slate-500/50',
    activeColor: 'border-amber-500 bg-amber-500/10',
    badge: 'bg-amber-500/25 text-amber-200',
  },
  {
    key: 'autonomous_publication',
    label: 'Autonomous Publication',
    desc: 'Full autonomy. Public uploads after review.',
    icon: ChevronRight,
    color: 'border-slate-500/50',
    activeColor: 'border-emerald-500 bg-emerald-500/10',
    badge: 'bg-emerald-500/25 text-emerald-200',
  },
]

// ─── Animation Variants ─────────────────────────────────────────────
export const fadeVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

export const cardHover = {
  whileHover: { scale: 1.02, y: -2, transition: { duration: 0.2 } },
}

// ─── Helper Functions ───────────────────────────────────────────────
export function stateColor(state: string) {
  const activeStates = ['running', 'researching_niches', 'creating_strategy', 'researching_topic', 'writing_script', 'producing_video', 'reviewing', 'uploading']
  if (activeStates.includes(state)) return { dot: 'bg-emerald-500', ring: 'ring-emerald-500/30', shadow: 'shadow-emerald-500/20', text: 'text-emerald-400', label: 'Running' }
  if (state === 'error') return { dot: 'bg-red-500', ring: 'ring-red-500/30', shadow: 'shadow-red-500/20', text: 'text-red-400', label: 'Error' }
  if (state === 'paused') return { dot: 'bg-amber-500', ring: 'ring-amber-500/30', shadow: 'shadow-amber-500/20', text: 'text-amber-400', label: 'Paused' }
  if (state === 'ready') return { dot: 'bg-emerald-400', ring: 'ring-emerald-400/30', shadow: 'shadow-emerald-400/20', text: 'text-emerald-300', label: 'Ready' }
  return { dot: 'bg-slate-400', ring: 'ring-slate-400/30', shadow: 'shadow-slate-400/20', text: 'text-slate-400', label: 'Idle' }
}

export function actionColor(action: string) {
  if (action === 'emergency_stop') return 'text-red-400 bg-red-500/10 border-red-500/30'
  if (action === 'mode_change') return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  if (action === 'upload') return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
  if (action === 'strategy_change') return 'text-violet-400 bg-violet-500/10 border-violet-500/30'
  if (action.includes('error') || action.includes('fail')) return 'text-red-400 bg-red-500/10 border-red-500/30'
  if (action.includes('upload') || action.includes('complete')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  if (action.includes('produce') || action.includes('render')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
  if (action.includes('script') || action.includes('write')) return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  if (action.includes('research') || action.includes('niche')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
  if (action.includes('review') || action.includes('quality')) return 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
}

export function actionLabel(action: string): string {
  const map: Record<string, string> = {
    emergency_stop: 'E-STOP',
    mode_change: 'MODE',
    upload: 'UPLOAD',
    metadata_update: 'UPDATE',
    strategy_change: 'STRATEGY',
    token_refresh: 'TOKEN',
    token_revoke: 'REVOKE',
    publish: 'PUBLISH',
  }
  return map[action] || action.slice(0, 10).toUpperCase()
}

export function modeLabel(mode: string) {
  const m = MODES.find(m => m.key === mode)
  return m?.label || mode
}

// ─── Animated Counter Hook ───────────────────────────────────────────
export function useAnimatedCounter(end: number, duration: number = 800) {
  const [count, setCount] = useState(end)
  const prevEnd = useRef(end)
  useEffect(() => {
    if (prevEnd.current === end) return
    const start = prevEnd.current
    const startTime = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    prevEnd.current = end
    return () => {}
  }, [end, duration])
  return count
}

// ─── Sub-Components ──────────────────────────────────────────────────

export function GradientCard({ children, className = '', glow = '' }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <motion.div {...cardHover} className={`relative group ${className}`}>
      <div className={`absolute -inset-[1px] rounded-xl bg-gradient-to-br from-violet-500/30 via-slate-700/20 to-cyan-500/30 opacity-0 group-hover:opacity-100 transition-all duration-700 blur-[1px] ${glow}`} />
      <div className="relative rounded-xl bg-slate-900/90 border border-slate-700/40 backdrop-blur-md overflow-hidden shadow-lg shadow-slate-900/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-500 group-hover:shadow-xl group-hover:shadow-slate-900/60">
        <div className="h-[2.5px] bg-gradient-to-r from-violet-500/60 via-cyan-500/60 to-emerald-500/60 group-hover:via-amber-500/60 group-hover:from-rose-500/40 group-hover:to-violet-500/40 transition-all duration-700" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        {children}
      </div>
    </motion.div>
  )
}

export function StatusCard({ icon: Icon, label, value, sub, trend, color = 'text-emerald-400', valueSuffix, hint, sparklineData }: {
  icon: any; label: string; value: string | number; sub?: string; trend?: 'up' | 'down' | 'flat'; color?: string; valueSuffix?: string; hint?: string; sparklineData?: number[]
}) {
  const numericValue = typeof value === 'number' ? value : 0
  const animatedValue = useAnimatedCounter(numericValue)
  const displayValue = typeof value === 'number' ? animatedValue : value
  const bgForColor = (c: string) => c === 'text-emerald-400' ? 'bg-emerald-500/10' : c === 'text-blue-400' ? 'bg-blue-500/10' : c === 'text-amber-400' ? 'bg-amber-500/10' : c === 'text-violet-400' ? 'bg-violet-500/10' : c === 'text-cyan-400' ? 'bg-cyan-500/10' : c === 'text-rose-400' ? 'bg-rose-500/10' : 'bg-slate-500/10'
  const trendConfig = trend === 'up' ? { icon: ArrowUpRight, color: 'text-emerald-400', bg: 'bg-emerald-500/20' } : trend === 'down' ? { icon: ArrowDownRight, color: 'text-red-400', bg: 'bg-red-500/20' } : trend === 'flat' ? { icon: Minus, color: 'text-slate-400', bg: 'bg-slate-500/20' } : null
  return (
    <GradientCard>
      <div className="p-4 group cursor-default" title={hint}>
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-xl ${bgForColor(color)} transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:${bgForColor(color).replace('/10', '/15')}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          {trendConfig && (
            <div className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full ${trendConfig.bg} ${trendConfig.color}`}>
              <trendConfig.icon className="w-3 h-3" />
            </div>
          )}
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-1">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight leading-none font-tabular-nums truncate" title={String(value)}>{displayValue}</p>
            {valueSuffix && <span className={`text-sm font-semibold ${color}`}>{valueSuffix}</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">{label}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={sub}>{sub}</p>}
          {sparklineData && sparklineData.length >= 2 && (
            <div className="mt-1.5">
              <MiniSparkline
                data={sparklineData}
                color={color === 'text-emerald-400' ? '#10b981' : color === 'text-blue-400' ? '#3b82f6' : color === 'text-amber-400' ? '#f59e0b' : color === 'text-violet-400' ? '#8b5cf6' : color === 'text-cyan-400' ? '#06b6d4' : color === 'text-rose-400' ? '#f43f5e' : '#94a3b8'}
              />
            </div>
          )}
        </div>
      </div>
    </GradientCard>
  )
}

export function PipelineFlow({ pipeline }: { pipeline: AgentStatus['pipeline'] | null }) {
  if (!pipeline) return null
  const total = pipeline ? Object.values(pipeline).reduce((a: number, b: number) => a + b, 0) : 0
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2 px-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const count = pipeline[stage.key as keyof typeof pipeline] || 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        const Icon = stage.icon
        const isEmpty = count === 0
        return (
          <React.Fragment key={stage.key}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className={`flex flex-col items-center min-w-[80px] p-3 rounded-xl border ${stage.border} ${stage.bg} transition-all duration-300 hover:scale-105 hover:shadow-lg ${isEmpty ? 'opacity-60' : ''}`}
            >
              <Icon className={`w-5 h-5 ${stage.textColor} mb-1`} />
              <span className={`text-xl font-bold ${stage.textColor} font-tabular-nums`}>{isEmpty ? '+' : count}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{stage.label}</span>
              {pct > 0 && (
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">{pct}%</span>
              )}
            </motion.div>
            {i < PIPELINE_STAGES.length - 1 && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 + 0.04, duration: 0.3 }}
                className="flex items-center px-1"
              >
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover/stage:text-slate-400 transition-colors" />
              </motion.div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Accent Color Map ──────────────────────────────────────────────
const accentColors: Record<string, { bg: string; ring: string; text: string; glow: string; btn: string; btnBorder: string }> = {
  violet:  { bg: 'bg-violet-500/10',  ring: 'ring-violet-500/30',  text: 'text-violet-400',  glow: 'bg-violet-500/20',  btn: 'text-violet-300', btnBorder: 'border-violet-500/30' },
  cyan:    { bg: 'bg-cyan-500/10',     ring: 'ring-cyan-500/30',    text: 'text-cyan-400',    glow: 'bg-cyan-500/20',    btn: 'text-cyan-300',   btnBorder: 'border-cyan-500/30' },
  emerald: { bg: 'bg-emerald-500/10',  ring: 'ring-emerald-500/30', text: 'text-emerald-400', glow: 'bg-emerald-500/20', btn: 'text-emerald-300', btnBorder: 'border-emerald-500/30' },
  amber:   { bg: 'bg-amber-500/10',    ring: 'ring-amber-500/30',   text: 'text-amber-400',   glow: 'bg-amber-500/20',   btn: 'text-amber-300',  btnBorder: 'border-amber-500/30' },
  rose:    { bg: 'bg-rose-500/10',     ring: 'ring-rose-500/30',    text: 'text-rose-400',    glow: 'bg-rose-500/20',    btn: 'text-rose-300',   btnBorder: 'border-rose-500/30' },
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  accent,
  action,
}: {
  icon: any
  title: string
  desc: string
  accent?: 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose'
  action?: { label: string; onClick: () => void }
}) {
  const colors = accent ? accentColors[accent] : null

  if (colors) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="relative mb-5">
          <motion.div
            aria-hidden
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.15, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className={`absolute inset-0 rounded-full ${colors.glow} blur-xl`}
          />
          <div className={`relative flex items-center justify-center w-16 h-16 rounded-full ${colors.bg} ring-2 ${colors.ring}`}>
            <Icon className={`w-8 h-8 ${colors.text}`} strokeWidth={1.75} />
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">{desc}</p>
        {action && (
          <Button
            variant="outline"
            size="sm"
            onClick={action.onClick}
            className={`mt-4 ${colors.btnBorder} ${colors.btn} hover:${colors.bg}`}
          >
            {action.label}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-4 rounded-2xl bg-slate-800/50 mb-4">
        <Icon className="w-8 h-8 text-slate-500" />
      </div>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-xs">{desc}</p>
    </div>
  )
}

export function QuickStatItem({ label, value, icon: Icon, color, bg, delay }: { label: string; value: number; icon: any; color: string; bg: string; delay: number }) {
  const animatedVal = useAnimatedCounter(value)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl ${bg} border border-slate-700/30`}
    >
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={`text-lg font-bold font-tabular-nums ${color}`}>{animatedVal}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </motion.div>
  )
}

export function AgentStateIndicator({ state }: { state: string }) {
  const colors = stateColor(state)
  const isActive = ['running', 'researching_niches', 'creating_strategy', 'researching_topic', 'writing_script', 'producing_video', 'reviewing', 'uploading'].includes(state)
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <motion.div
          animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
          transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
          className={`w-10 h-10 rounded-full ${colors.dot} ring-4 ${colors.ring} shadow-lg ${colors.shadow} ${isActive ? 'shadow-[0_0_12px_rgba(16,185,129,0.3)]' : ''} flex items-center justify-center`}
        >
          {isActive && (
            <>
              <motion.div
                animate={{ scale: [1, 2], opacity: [0.4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                className={`absolute inset-0 rounded-full ${colors.dot}`}
              />
              <motion.div
                animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                className={`absolute inset-0 rounded-full ${colors.dot}`}
              />
            </>
          )}
        </motion.div>
      </div>
      <div>
        <p className={`text-lg font-bold tracking-tight ${colors.text}`}>{colors.label}</p>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider">{state.replace(/_/g, ' ')}</p>
      </div>
    </div>
  )
}

export function LiveFeed({ logs }: { logs: any[] }) {
  const last3 = logs.slice(0, 3)
  if (!last3.length) return (
    <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
      <Activity className="w-4 h-4" />
      <span>No recent activity</span>
    </div>
  )
  return (
    <div className="space-y-2">
      {last3.map((log: any, i: number) => (
        <motion.div
          key={log.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-2 text-sm"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-400 font-mono text-xs w-20 shrink-0 whitespace-nowrap">
            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <Badge variant="outline" className={`text-[10px] h-5 ${actionColor(log.action)}`}>
            {log.action}
          </Badge>
          <span className="text-slate-300 text-xs truncate flex-1">{log.details}</span>
        </motion.div>
      ))}
    </div>
  )
}
