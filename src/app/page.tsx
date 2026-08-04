'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Play, Pause, Square, AlertTriangle, Activity, Video,
  TrendingUp, DollarSign, Eye, Clock, CheckCircle2,
  XCircle, Loader2, Youtube, Shield, Brain, Zap,
  FileText, Upload, BarChart3, Settings, AlertOctagon,
  ChevronRight, Radio, Search, PenTool, Clapperboard, Compass,
  MessageSquare, Rocket, Sparkles, Globe, Lock,
  ShieldCheck, FileCheck, Flame, Target, Calendar,
  MousePointerClick, ExternalLink, Info, Server,
  CircleDot, Layers, MonitorSmartphone, ToggleLeft,
  Database, CloudUpload, Award, CreditCard, Percent,
  ArrowUpRight, ArrowDownRight, Minus, Megaphone,
  Lightbulb, Wand2, Film, ThumbsUp, Users, Hash, CalendarDays,
  ChevronDown, ChevronLeft, Download, Quote,
  CheckCircle, AlertCircle, Clock3, FileWarning, ScanLine,
  Keyboard, FlaskConical, HeartPulse, Handshake,
  Bell, RefreshCw, Image as ImageIcon, CalendarClock,
  HelpCircle, GitBranch
} from 'lucide-react'

// ─── New Agent Feature Components ───────────────────────────────────
import { VideoPreviewModal } from '@/components/agent/video-preview-modal'
import { IdeaExplorer } from '@/components/agent/idea-explorer'
import { VideoProjectExplorer } from '@/components/agent/video-project-explorer'
import { QualityReviewPanel } from '@/components/agent/quality-review-panel'
import { ContentCalendar } from '@/components/agent/content-calendar'
import { GlassCard } from '@/components/agent/glass-card'
import { YPPProgressTracker } from '@/components/agent/ypp-progress-tracker'
import { RevenueProjections } from '@/components/agent/revenue-projections'
import { RevenueProjectionCalculator } from '@/components/agent/revenue-projection-calculator'
import { SponsorshipDiscovery } from '@/components/agent/sponsorship-discovery'
import { ExperimentManager } from '@/components/agent/experiment-manager'
import { HealthDiagnostics } from '@/components/agent/health-diagnostics'
import { KeyboardShortcuts } from '@/components/agent/keyboard-shortcuts'
import { CommandPalette } from '@/components/agent/command-palette'
import { ActivityFeed } from '@/components/agent/activity-feed'
import { ContentScheduler } from '@/components/agent/content-scheduler'
import { PerformanceMetrics } from '@/components/agent/performance-metrics'
import { NotificationCenter } from '@/components/agent/notification-center'
import { DecisionLog } from '@/components/agent/decision-log'
import { ExportMenu } from '@/components/agent/export-menu'
import { StorageDashboard } from '@/components/agent/storage-dashboard'
import { YouTubeSetupWizard } from '@/components/agent/youtube-setup-wizard'
import { useToast } from '@/components/agent/toast-provider'
import { AgentPulseIndicator } from '@/components/agent/agent-pulse'
import { SmartRecommendations } from '@/components/agent/smart-recommendations'
import { RevenueForecastChart } from '@/components/agent/revenue-forecast-chart'
import { QuickActionsToolbar } from '@/components/agent/quick-actions-toolbar'
import { MiniSparkline } from '@/components/agent/mini-sparkline'
import { PipelineProgress } from '@/components/agent/pipeline-progress'
import { GrowthTrendsChart } from '@/components/agent/growth-trends-chart'
import { CpmRpmDashboard } from '@/components/agent/cpm-rpm-dashboard'
import { PerformanceBreakdown } from '@/components/agent/performance-breakdown'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  StatusCardSkeleton,
  PipelineFlowSkeleton,
  IdeaListSkeleton,
  ChartSkeleton,
  LogListSkeleton,
} from '@/components/agent/skeletons'

// ─── Types ───────────────────────────────────────────────────────────
interface AgentStatus {
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

interface PipelineData {
  ideas: any[]
  projects: any[]
  uploads: any[]
  scripts: any[]
  reviews: any[]
}

interface ChannelData {
  channel: any
  youtubeConnected: boolean
  niches: any[]
  pillars: any[]
}

interface AnalyticsData {
  totalViews?: number
  totalSubscribers?: number
  totalWatchTime?: number
  estimatedRevenue?: number
  recentVideos?: any[]
  dailyStats?: any[]
}

// ─── Pipeline Stages Config ─────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: 'ideas', label: 'Ideas', icon: Lightbulb, color: 'from-violet-500 to-purple-600', textColor: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  { key: 'researched', label: 'Research', icon: Search, color: 'from-blue-500 to-cyan-600', textColor: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { key: 'scripted', label: 'Script', icon: PenTool, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  { key: 'producing', label: 'Produce', icon: Clapperboard, color: 'from-emerald-500 to-green-600', textColor: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { key: 'reviewing', label: 'Review', icon: MessageSquare, color: 'from-rose-500 to-pink-600', textColor: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  { key: 'uploaded', label: 'Upload', icon: CloudUpload, color: 'from-cyan-500 to-teal-600', textColor: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
]

// ─── Mode Config ────────────────────────────────────────────────────
const MODES = [
  {
    key: 'simulation',
    label: 'Simulation',
    desc: 'Safe dry-run. No real uploads or API calls.',
    icon: MonitorSmartphone,
    color: 'border-slate-500/50',
    activeColor: 'border-blue-500 bg-blue-500/10',
    badge: 'bg-blue-500/20 text-blue-300',
  },
  {
    key: 'private_production',
    label: 'Private Production',
    desc: 'Produce & upload as private. No public release.',
    icon: Lock,
    color: 'border-slate-500/50',
    activeColor: 'border-amber-500 bg-amber-500/10',
    badge: 'bg-amber-500/25 text-amber-200',
  },
  {
    key: 'autonomous_publication',
    label: 'Autonomous Publication',
    desc: 'Full autonomy. Public uploads after review.',
    icon: Rocket,
    color: 'border-slate-500/50',
    activeColor: 'border-emerald-500 bg-emerald-500/10',
    badge: 'bg-emerald-500/25 text-emerald-200',
  },
]

// ─── Animation Variants ─────────────────────────────────────────────
const fadeVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

const cardHover = {
  whileHover: { scale: 1.02, y: -2, transition: { duration: 0.2 } },
}

// ─── Helper Functions ───────────────────────────────────────────────
function stateColor(state: string) {
  const activeStates = ['running', 'researching_niches', 'creating_strategy', 'researching_topic', 'writing_script', 'producing_video', 'reviewing', 'uploading', 'cycle_complete']
  if (activeStates.includes(state)) return { dot: 'bg-emerald-500', ring: 'ring-emerald-500/30', shadow: 'shadow-emerald-500/20', text: 'text-emerald-400', label: 'Running' }
  if (state === 'error') return { dot: 'bg-red-500', ring: 'ring-red-500/30', shadow: 'shadow-red-500/20', text: 'text-red-400', label: 'Error' }
  if (state === 'paused') return { dot: 'bg-amber-500', ring: 'ring-amber-500/30', shadow: 'shadow-amber-500/20', text: 'text-amber-400', label: 'Paused' }
  return { dot: 'bg-slate-400', ring: 'ring-slate-400/30', shadow: 'shadow-slate-400/20', text: 'text-slate-400', label: 'Idle' }
}

function actionColor(action: string) {
  // New categorized actions
  if (action === 'emergency_stop') return 'text-red-400 bg-red-500/10 border-red-500/30'
  if (action === 'mode_change') return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  if (action === 'upload') return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
  if (action === 'strategy_change') return 'text-violet-400 bg-violet-500/10 border-violet-500/30'
  // Legacy / fallback keyword matching
  if (action.includes('error') || action.includes('fail')) return 'text-red-400 bg-red-500/10 border-red-500/30'
  if (action.includes('upload') || action.includes('complete')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  if (action.includes('produce') || action.includes('render')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
  if (action.includes('script') || action.includes('write')) return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  if (action.includes('research') || action.includes('niche')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
  if (action.includes('review') || action.includes('quality')) return 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  return 'text-slate-400 bg-slate-500/10 border-slate-500/30'
}

/** Pretty-print an audit-log action label */
function actionLabel(action: string): string {
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

function modeLabel(mode: string) {
  const m = MODES.find(m => m.key === mode)
  return m?.label || mode
}

// YPP Thresholds
const YPP_THRESHOLDS = {
  subscribers: { current: 0, target: 1000, label: 'Subscribers', icon: Users },
  watchHours: { current: 0, target: 4000, label: 'Watch Hours', icon: Clock },
  uploads: { current: 0, target: 3, label: 'Public Uploads (30d)', icon: Upload },
}

// ─── Animated Counter Hook ───────────────────────────────────────────
function useAnimatedCounter(end: number, duration: number = 800) {
  const [count, setCount] = useState(end)
  const prevEnd = useRef(end)
  useEffect(() => {
    if (prevEnd.current === end) return
    const start = prevEnd.current
    const startTime = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
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

function GradientCard({ children, className = '', glow = '' }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <motion.div {...cardHover} className={`relative group ${className}`}>
      {/* Animated gradient border */}
      <div className={`absolute -inset-[1px] rounded-xl bg-gradient-to-br from-violet-500/30 via-slate-700/20 to-cyan-500/30 opacity-0 group-hover:opacity-100 transition-all duration-700 blur-[1px] ${glow}`} />
      {/* Main card */}
      <div className="relative rounded-xl bg-slate-900/90 border border-slate-700/40 backdrop-blur-md overflow-hidden shadow-lg shadow-slate-900/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-500 group-hover:shadow-xl group-hover:shadow-slate-900/60">
        {/* Top gradient line - animated */}
        <div className="h-[2.5px] bg-gradient-to-r from-violet-500/60 via-cyan-500/60 to-emerald-500/60 group-hover:via-amber-500/60 group-hover:from-rose-500/40 group-hover:to-violet-500/40 transition-all duration-700" />
        {/* Inner glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        {children}
      </div>
    </motion.div>
  )
}

function StatusCard({ icon: Icon, label, value, sub, trend, color = 'text-emerald-400', valueSuffix, hint, sparklineData }: {
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

function PipelineFlow({ pipeline }: { pipeline: AgentStatus['pipeline'] | null }) {
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

function AgentStateIndicator({ state }: { state: string }) {
  const colors = stateColor(state)
  const isActive = ['running', 'researching_niches', 'creating_strategy', 'researching_topic', 'writing_script', 'producing_video', 'reviewing', 'uploading', 'cycle_complete'].includes(state)
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

function LiveFeed({ logs }: { logs: any[] }) {
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

// ─── Accent Color Map ──────────────────────────────────────────────
const accentColors: Record<string, { bg: string; ring: string; text: string; glow: string; btn: string; btnBorder: string }> = {
  violet:  { bg: 'bg-violet-500/10',  ring: 'ring-violet-500/30',  text: 'text-violet-400',  glow: 'bg-violet-500/20',  btn: 'text-violet-300', btnBorder: 'border-violet-500/30' },
  cyan:    { bg: 'bg-cyan-500/10',     ring: 'ring-cyan-500/30',    text: 'text-cyan-400',    glow: 'bg-cyan-500/20',    btn: 'text-cyan-300',   btnBorder: 'border-cyan-500/30' },
  emerald: { bg: 'bg-emerald-500/10',  ring: 'ring-emerald-500/30', text: 'text-emerald-400', glow: 'bg-emerald-500/20', btn: 'text-emerald-300', btnBorder: 'border-emerald-500/30' },
  amber:   { bg: 'bg-amber-500/10',    ring: 'ring-amber-500/30',   text: 'text-amber-400',   glow: 'bg-amber-500/20',   btn: 'text-amber-300',  btnBorder: 'border-amber-500/30' },
  rose:    { bg: 'bg-rose-500/10',     ring: 'ring-rose-500/30',    text: 'text-rose-400',    glow: 'bg-rose-500/20',    btn: 'text-rose-300',   btnBorder: 'border-rose-500/30' },
}

function EmptyState({
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

  // Enhanced mode when accent is provided
  if (colors) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Icon container with animated glow + colored ring */}
        <div className="relative mb-5">
          {/* Animated pulsing glow behind icon */}
          <motion.div
            aria-hidden
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.15, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className={`absolute inset-0 rounded-full ${colors.glow} blur-xl`}
          />
          {/* Icon with colored ring */}
          <div className={`relative flex items-center justify-center w-16 h-16 rounded-full ${colors.bg} ring-2 ${colors.ring}`}>
            <Icon className={`w-8 h-8 ${colors.text}`} strokeWidth={1.75} />
          </div>
        </div>

        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">{desc}</p>

        {/* Optional CTA button */}
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

  // Original simple fallback (backward compatible)
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

function QuickStatItem({ label, value, icon: Icon, color, bg, delay }: { label: string; value: number; icon: any; color: string; bg: string; delay: number }) {
  const animatedVal = useAnimatedCounter(value)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={`flex items-center gap-2 p-2.5 rounded-lg ${bg} border border-slate-700/30`}
    >
      <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
      <div>
        <p className={`text-sm font-bold font-tabular-nums ${color}`}>{animatedVal}</p>
        <p className="text-[10px] text-slate-400">{label}</p>
      </div>
    </motion.div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────────────
export default function Dashboard() {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [pipeline, setPipeline] = useState<PipelineData | null>(null)
  const [channel, setChannel] = useState<ChannelData | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [lastPoll, setLastPoll] = useState<Date>(new Date())
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null)
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [schedulerIdeas, setSchedulerIdeas] = useState<any[]>([])
  const [estopDialogOpen, setEstopDialogOpen] = useState(false)
  const [ytConnecting, setYtConnecting] = useState(false)
  const [ytDisconnecting, setYtDisconnecting] = useState(false)
  const [ytSetupInfo, setYtSetupInfo] = useState<any>(null)
  const [ytWizardOpen, setYtWizardOpen] = useState(false)
  const [ytDemoMode, setYtDemoMode] = useState(false)
  const { toast } = useToast()

  // ── YouTube OAuth Callback Handler ────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ytAuth = params.get('youtube_auth')
    if (ytAuth) {
      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('youtube_auth')
      url.searchParams.delete('message')
      url.searchParams.delete('channel')
      window.history.replaceState({}, '', url.toString())

      if (ytAuth === 'success') {
        const chName = params.get('channel') || 'YouTube'
        toast({ type: 'success', title: 'YouTube Connected!', description: `Successfully connected to ${chName}`, duration: 5000 })
        fetchChannel()
      } else if (ytAuth === 'error') {
        const errMsg = params.get('message') || 'Unknown error'
        toast({ type: 'error', title: 'Connection Failed', description: decodeURIComponent(errMsg), duration: 7000 })
      }
    }
  }, [])
  // ── Polling ─────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/status')
      if (res.ok) setStatus(await res.json())
    } catch {}
  }, [])

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch('/api/data/pipeline')
      if (res.ok) setPipeline(await res.json())
    } catch {}
  }, [])

  const fetchChannel = useCallback(async () => {
    try {
      const res = await fetch('/api/data/channel')
      if (res.ok) setChannel(await res.json())
    } catch {}
  }, [])

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/data/jobs')
      if (res.ok) setJobs(await res.json())
    } catch {}
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/data/audit-logs')
      if (res.ok) setLogs(await res.json())
    } catch {}
  }, [])

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/data/analytics')
      if (res.ok) setAnalytics(await res.json())
    } catch {}
  }, [])

  const pollAll = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchPipeline(), fetchChannel(), fetchJobs(), fetchLogs(), fetchAnalytics()])
    setLastPoll(new Date())
    setInitialLoaded(true)
  }, [fetchStatus, fetchPipeline, fetchChannel, fetchJobs, fetchLogs, fetchAnalytics])

  useEffect(() => {
    pollAll()
    const interval = setInterval(pollAll, 5000)
    return () => clearInterval(interval)
  }, [pollAll])

  // ── YouTube Connect/Disconnect ────────────────────────────────────
  const connectYouTube = async () => {
    setYtConnecting(true)
    try {
      const res = await fetch('/api/youtube/auth')
      const data = await res.json()

      if (!res.ok) {
        if (data.setupRequired) {
          setYtSetupInfo(data)
          setYtWizardOpen(true) // Open the setup wizard instead of just showing a toast
        } else {
          toast({ type: 'error', title: 'Connection Failed', description: data.error || data.message || 'Unknown error', duration: 5000 })
        }
        return
      }

      if (data.connected) {
        toast({ type: 'info', title: 'Already Connected', description: data.message, duration: 3000 })
        await fetchChannel()
        return
      }

      if (data.authUrl) {
        // Open Google OAuth in a new window
        const width = 600, height = 700
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2
        const popup = window.open(
          data.authUrl,
          'youtube-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
        )

        // Poll for popup closure (user completed or cancelled)
        const pollPopup = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(pollPopup)
            setYtConnecting(false)
            // Re-fetch channel to check if connected
            setTimeout(() => fetchChannel(), 1000)
          }
        }, 500)

        // Auto-timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollPopup)
          setYtConnecting(false)
        }, 300000)
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Connection Error', description: e.message, duration: 5000 })
    } finally {
      setYtConnecting(false)
    }
  }

  const enableDemoMode = async () => {
    setYtConnecting(true)
    try {
      const res = await fetch('/api/youtube/demo-connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast({ type: 'error', title: 'Demo Mode Failed', description: data.error || data.message, duration: 5000 })
        return
      }
      setYtDemoMode(true)
      setYtWizardOpen(false)
      toast({ type: 'success', title: 'Demo Mode Activated', description: data.message, duration: 5000 })
      await fetchChannel()
    } catch (e: any) {
      toast({ type: 'error', title: 'Demo Mode Error', description: e.message, duration: 5000 })
    } finally {
      setYtConnecting(false)
    }
  }

  const handleWizardComplete = async (clientId: string, clientSecret: string) => {
    setYtWizardOpen(false)
    toast({ type: 'success', title: 'Credentials Saved!', description: 'Now click "Connect YouTube" to authorize with Google.', duration: 7000 })
    // Small delay for the env to be picked up
    await new Promise(r => setTimeout(r, 2000))
    // Now try the actual OAuth flow
    await connectYouTube()
  }

  const disconnectYouTube = async () => {
    setYtDisconnecting(true)
    try {
      const res = await fetch('/api/youtube/disconnect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast({ type: 'error', title: 'Disconnect Failed', description: data.error || data.message, duration: 5000 })
        return
      }
      toast({ type: 'success', title: 'YouTube Disconnected', description: 'Your YouTube account has been disconnected.', duration: 4000 })
      await fetchChannel()
    } catch (e: any) {
      toast({ type: 'error', title: 'Disconnect Error', description: e.message, duration: 5000 })
    } finally {
      setYtDisconnecting(false)
    }
  }

  // ── Commands ────────────────────────────────────────────────────
  const COMMAND_LABELS: Record<string, { label: string; success: string; loading: string }> = {
    'start': { label: 'Start Agent', success: 'Agent started', loading: 'Starting agent…' },
    'stop': { label: 'Emergency Stop', success: 'Emergency stop activated', loading: 'Activating emergency stop…' },
    'pause': { label: 'Pause Agent', success: 'Agent paused', loading: 'Pausing agent…' },
    'resume': { label: 'Resume Agent', success: 'Agent resumed', loading: 'Resuming agent…' },
    'initial-setup': { label: 'Run Initial Setup', success: 'Initial setup complete', loading: 'Running initial setup…' },
    'full-cycle': { label: 'Full Cycle', success: 'Full cycle started', loading: 'Starting full autonomous cycle…' },
    'produce-next': { label: 'Produce Next Video', success: 'Production queued', loading: 'Producing next video…' },
    'process-job': { label: 'Process Next Job', success: 'Job processed', loading: 'Processing next job…' },
    'collect-analytics': { label: 'Collect Analytics', success: 'Analytics collection queued', loading: 'Collecting analytics…' },
    'schedule-jobs': { label: 'Schedule Jobs', success: 'Recurring jobs scheduled', loading: 'Scheduling jobs…' },
    'review-strategy': { label: 'Review Strategy', success: 'Strategy review queued', loading: 'Reviewing strategy…' },
    'reset': { label: 'Reset Agent', success: 'Agent reset', loading: 'Resetting agent…' },
  }

  const sendCommand = async (command: string, extra?: any) => {
    const meta = COMMAND_LABELS[command]
    const loadingId = meta ? toast({ type: 'loading', title: meta.loading, duration: 0 }) : null
    setLoading(true)
    try {
      const res = await fetch('/api/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = data?.error || data?.message || `Command failed (${res.status})`
        if (loadingId) toast.dismiss(loadingId)
        toast({ type: 'error', title: `${meta?.label || command} failed`, description: errMsg, duration: 5000 })
        return data
      }
      await fetchStatus()
      if (loadingId) {
        toast.update(loadingId, {
          type: 'success',
          title: meta?.success || `${command} command sent`,
          description: data?.message ? String(data.message).slice(0, 120) : undefined,
          duration: 3000,
        })
      }
      return data
    } catch (e: any) {
      if (loadingId) toast.dismiss(loadingId)
      toast({ type: 'error', title: 'Network error', description: e?.message || 'Failed to reach server', duration: 5000 })
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Scheduler data fetcher ────────────────────────────────────
  const fetchSchedulerIdeas = useCallback(async () => {
    try {
      const res = await fetch('/api/data/pipeline')
      if (res.ok) {
        const data = await res.json()
        const ideas = (data.ideas || []).map((idea: any) => ({
          id: idea.id,
          title: idea.title,
          pillarColor: idea.pillar?.color || '#8b5cf6',
          pillarName: idea.pillar?.name || 'Uncategorized',
          type: idea.type || 'short',
          compositeScore: idea.compositeScore,
          scheduledDate: idea.scheduledDate,
          scheduledTime: null as string | null,
        }))
        setSchedulerIdeas(ideas)
      }
    } catch {}
  }, [])

  // ── Schedule idea API call ────────────────────────────────────
  const handleScheduleIdea = useCallback(async (ideaId: string, dateISO: string, time: string) => {
    try {
      await fetch('/api/data/ideas/' + ideaId + '/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: dateISO, scheduledTime: time }),
      })
      setSchedulerIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, scheduledDate: dateISO, scheduledTime: time } : i))
    } catch {}
  }, [])

  // ── Unschedule idea ───────────────────────────────────────────
  const handleUnscheduleIdea = useCallback(async (ideaId: string) => {
    try {
      await fetch('/api/data/ideas/' + ideaId + '/schedule', {
        method: 'DELETE',
      })
      setSchedulerIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, scheduledDate: null, scheduledTime: null } : i))
    } catch {}
  }, [])

  // Initial load for scheduler data
  useEffect(() => {
    fetchSchedulerIdeas()
  }, [fetchSchedulerIdeas])

  // ── Computed ────────────────────────────────────────────────────
  const totalPipeline = status ? Object.values(status.pipeline).reduce((a: number, b: number) => a + b, 0) : 0
  const selectedNiche = useMemo(() => {
    if (!channel?.niches?.length) return null
    return channel.niches.find((n: any) => n.isSelected) || channel.niches[0] || null
  }, [channel?.niches])
  const selectedNicheScore: number | null = selectedNiche?.compositeScore ?? null
  const pipelineChartData = useMemo(() => {
    if (!logs.length) return []
    // Deterministic synthetic time-series (no Math.random/Date.now to avoid SSR hydration mismatch)
    return Array.from({ length: 12 }, (_, i) => ({
      time: `${String((i + 1) % 24).padStart(2, '0')}:00`,
      ideas: Math.max(0, (status?.pipeline.ideas || 0) - Math.floor((i * 0.7) % 3)),
      produced: Math.max(0, (status?.pipeline.producing || 0) + (i % 2)),
      uploaded: Math.max(0, (status?.pipeline.uploaded || 0) - Math.floor((i * 0.2) % 2)),
    }))
  }, [status?.pipeline, logs.length])

  const nicheBarData = useMemo(() => {
    if (!channel?.niches?.length) return []
    return channel.niches.slice(0, 10).map((n: any) => ({
      name: n.nicheName.length > 16 ? n.nicheName.slice(0, 16) + '…' : n.nicheName,
      score: n.compositeScore || 0,
      selected: n.isSelected,
    }))
  }, [channel?.niches])

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ═══ Decorative Background ═══ */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(100,116,139,0.12)_1px,transparent_0)] [background-size:32px_32px]" />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-violet-500/[0.04] rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[100px]" />
        <div className="absolute top-1/3 left-1/2 w-80 h-80 bg-emerald-500/[0.03] rounded-full blur-[80px]" />
        <div className="absolute top-2/3 right-1/4 w-64 h-64 bg-amber-500/[0.02] rounded-full blur-[80px]" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-rose-500/[0.02] rounded-full blur-[90px]" />
      </div>

      {/* ═══ TOP BAR ═══ */}
      <header className="sticky top-0 z-50 bg-slate-950/70 backdrop-blur-xl shadow-sm shadow-slate-900/50">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20 ${channel?.youtubeConnected ? 'animate-pulse' : ''}`}>
              <Youtube className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Revenue Studio
              </h1>
              <p className="text-[11px] text-slate-400 uppercase tracking-widest">Mission Control</p>
            </div>
          </div>

          {/* Center: Agent State + Pulse + Mode */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            {status && <AgentStateIndicator state={status.state} />}
            {status && (
              <AgentPulseIndicator
                state={status.state}
                currentJob={status.currentJob}
                nextAction={status.nextAction}
              />
            )}
            <Badge className={`text-[10px] ${MODES.find(m => m.key === status?.operatingMode)?.badge || 'bg-slate-500/20 text-slate-300'}`}>
              {modeLabel(status?.operatingMode || 'private_production')}
            </Badge>
          </div>

          {/* Right: Theme + Notifications + Command Palette + Emergency Stop + YT Connection */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Command Palette trigger button (compact, hidden on xs) */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-800/60 bg-slate-900/60 hover:bg-slate-800/60 hover:border-slate-700/60 text-slate-400 hover:text-slate-200 text-xs transition-colors"
              title="Command Palette (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-700/60 bg-slate-800/80 text-[10px] text-slate-400 font-mono">⌘K</kbd>
            </button>

            {/* Export Menu (CSV downloads) - hidden on xs */}
            <div className="hidden md:block">
              <ExportMenu />
            </div>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Notification center */}
            <NotificationCenter onNavigate={(t) => setActiveTab(t)} />

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (!channel?.youtubeConnected) {
                  connectYouTube()
                } else {
                  setActiveTab('settings')
                }
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all cursor-pointer ${
                channel?.youtubeConnected
                  ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 animate-pulse'
              }`}
              title={channel?.youtubeConnected ? 'YouTube connected – click to view settings' : 'Click to connect YouTube'}
            >
              <Youtube className="w-3 h-3" />
              {channel?.youtubeConnected ? 'Connected' : 'Connect'}
            </motion.button>

            {/* EMERGENCY STOP - ALWAYS VISIBLE (with confirmation when activating) */}
            <AlertDialog open={estopDialogOpen} onOpenChange={setEstopDialogOpen}>
              <AlertDialogTrigger asChild>
                <motion.div whileTap={{ scale: 0.95 }} className="inline-block">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      // If resuming (already stopped), no confirmation needed
                      if (status?.emergencyStop) {
                        sendCommand('resume')
                      } else {
                        // Activating emergency stop — show confirmation dialog
                        setEstopDialogOpen(true)
                      }
                    }}
                    className={`relative overflow-hidden transition-shadow duration-200 ${
                      status?.emergencyStop
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-lg shadow-red-500/30 hover:shadow-red-500/40 animate-pulse'
                        : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 shadow-md shadow-red-500/20 hover:shadow-red-500/40'
                    }`}
                  >
                    <AlertOctagon className="w-4 h-4 mr-1.5" />
                    {status?.emergencyStop ? 'RESUME' : 'E-STOP'}
                  </Button>
                </motion.div>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-slate-900 border-red-500/40 text-slate-100">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-red-300">
                    <AlertOctagon className="w-5 h-5" />
                    Activate Emergency Stop?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400">
                    This will <span className="text-red-300 font-semibold">immediately halt</span> all autonomous agent activity:
                    running jobs will be interrupted, no new videos will be produced, and no uploads will occur.
                    The agent will remain stopped until you manually resume.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => sendCommand('stop')}
                    className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white border-0"
                  >
                    <AlertOctagon className="w-4 h-4 mr-1.5" />
                    Activate E-STOP
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {/* Bottom gradient border */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 p-3 md:p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          {/* ── Tab Bar ── */}
          <TabsList className="mb-4 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/90 border border-slate-800/50 backdrop-blur-sm w-full h-auto gap-0.5 p-1 overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/40 [&::-webkit-scrollbar-thumb]:rounded-full relative">
            {[
              { v: 'overview', icon: Activity, label: 'Overview', accent: 'border-emerald-500' },
              { v: 'pipeline', icon: Layers, label: 'Pipeline', accent: 'border-violet-500' },
              { v: 'strategy', icon: Target, label: 'Strategy', accent: 'border-blue-500' },
              { v: 'calendar', icon: CalendarDays, label: 'Calendar', accent: 'border-amber-500' },
              { v: 'scheduler', icon: CalendarClock, label: 'Scheduler', accent: 'border-cyan-500' },
              { v: 'revenue', icon: DollarSign, label: 'Revenue', accent: 'border-emerald-500' },
              { v: 'analytics', icon: BarChart3, label: 'Analytics', accent: 'border-blue-500' },
              { v: 'opportunities', icon: Handshake, label: 'Opportunities', accent: 'border-rose-500' },
              { v: 'experiments', icon: FlaskConical, label: 'Experiments', accent: 'border-violet-500' },
              { v: 'logs', icon: FileText, label: 'Logs', accent: 'border-slate-400' },
              { v: 'decisions', icon: GitBranch, label: 'Decisions', accent: 'border-violet-500' },
              { v: 'settings', icon: Settings, label: 'Settings', accent: 'border-slate-400' },
            ].map(tab => (
              <TabsTrigger
                key={tab.v}
                value={tab.v}
                className="shrink-0 data-[state=active]:bg-slate-700/80 data-[state=active]:text-white data-[state=active]:border-t-2 data-[state=active]:border-t-[currentColor] text-slate-400 text-[11px] px-2 py-1 transition-all duration-200 hover:bg-slate-800/60 whitespace-nowrap border-t-2 border-t-transparent"
              >
                <tab.icon className="w-3 h-3 mr-1" />
                {tab.label}
              </TabsTrigger>
            ))}
            {/* Keyboard Shortcuts Button */}
            <button
              onClick={() => setShortcutsOpen(true)}
              className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-md hover:bg-slate-800/50"
              title="Keyboard Shortcuts (Ctrl+/)"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </TabsList>

          {/* ══════════════════════════════════════════════════════════
              OVERVIEW TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="overview" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="overview-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* YouTube Not Connected Banner */}
                {!channel?.youtubeConnected && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 via-slate-900/80 to-amber-500/10 p-4"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-amber-500/5 animate-pulse" />
                    <div className="relative flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                            <Youtube className="w-6 h-6 text-red-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-100">YouTube Not Connected</p>
                            <p className="text-xs text-slate-400">Connect your channel to enable uploads, analytics, and autonomous publishing.</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          onClick={() => setYtWizardOpen(true)}
                          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-500/20 gap-2"
                        >
                          <Youtube className="w-4 h-4" /> Setup Wizard
                        </Button>
                        <Button
                          onClick={enableDemoMode}
                          disabled={ytConnecting}
                          variant="outline"
                          className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 gap-2"
                        >
                          {ytConnecting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
                          ) : (
                            <><Sparkles className="w-4 h-4" /> Demo Mode</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
                {/* Top Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatusCard
                    icon={Zap}
                    label="Pipeline Items"
                    value={totalPipeline}
                    sub={`${status?.pipeline?.ideas || 0} ideas · ${status?.pipeline?.approved || 0} approved`}
                    color="text-emerald-400"
                    trend="up"
                    hint={`Total items across all pipeline stages:\n${status?.pipeline?.ideas || 0} ideas · ${status?.pipeline?.researched || 0} researched · ${status?.pipeline?.scripted || 0} scripted · ${status?.pipeline?.producing || 0} producing · ${status?.pipeline?.reviewing || 0} reviewing · ${status?.pipeline?.approved || 0} approved · ${status?.pipeline?.uploaded || 0} uploaded`}
                    sparklineData={[2, 5, 3, 8, 6, 12, 9, totalPipeline]}
                  />
                  <StatusCard
                    icon={Video}
                    label="Videos Produced"
                    value={status?.pipeline?.producing || 0}
                    sub={`${status?.pipeline?.approved || 0} approved`}
                    color="text-cyan-400"
                    hint="Videos currently being rendered or in production queue"
                    sparklineData={[0, 1, 1, 2, 1, 3, 2, status?.pipeline?.producing || 0]}
                  />
                  <StatusCard
                    icon={Brain}
                    label="Niche Score"
                    value={selectedNicheScore != null ? selectedNicheScore.toFixed(1) : '—'}
                    valueSuffix={selectedNicheScore != null ? '/10' : undefined}
                    sub={status?.niche || 'No niche'}
                    color="text-violet-400"
                    trend={selectedNicheScore && selectedNicheScore >= 8 ? 'up' : undefined}
                    hint={`Selected niche: ${status?.niche || 'None'}\nComposite score from 18 weighted criteria (demand, audience, monetization, risk, etc.)`}
                    sparklineData={[3, 4.5, 5.2, 6.1, 7, 7.8, 8.2, selectedNicheScore ?? 0]}
                  />
                  <StatusCard
                    icon={Clock}
                    label="Jobs Queued"
                    value={jobs.filter(j => j.status === 'pending' || j.status === 'running').length}
                    sub={`${jobs.filter(j => j.status === 'completed').length} done`}
                    color="text-amber-400"
                    hint="Background jobs waiting or running (production, uploads, analytics collection)"
                    sparklineData={[0, 1, 2, 1, 3, 2, 4, jobs.filter(j => j.status === 'pending' || j.status === 'running').length]}
                  />
                </div>

                {/* Smart Recommendations */}
                <SmartRecommendations
                  agentState={status?.state || 'idle'}
                  niche={status?.niche ?? null}
                  youtubeConnected={channel?.youtubeConnected ?? false}
                  pipeline={{
                    ideas: status?.pipeline?.ideas || 0,
                    approved: status?.pipeline?.approved || 0,
                    uploaded: status?.pipeline?.uploaded || 0,
                  }}
                  onAction={(action) => {
                    if (action === 'pause') sendCommand('pause')
                    else if (action === 'initial-setup') sendCommand('initial-setup')
                    else if (action === 'niche-research') sendCommand('niche-research')
                    else if (action === 'produce-next') sendCommand('produce-next')
                    else if (action === 'upload') sendCommand('upload')
                    else if (action === 'monitor') setActiveTab('pipeline')
                    else if (action === 'strategy-review') setActiveTab('strategy')
                    else sendCommand(action)
                  }}
                />

                {/* Channel Strategy Score — Composite metric */}
                <GradientCard glow="from-violet-500/5 to-emerald-500/5">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2">
                        <Target className="w-4 h-4 text-violet-400" /> Channel Strategy Score
                      </h3>
                      <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">Composite</Badge>
                    </div>
                    {(() => {
                      const nicheScore = selectedNicheScore ?? 0
                      const pipelineEfficiency = totalPipeline > 0
                        ? ((status?.pipeline?.approved || 0) + (status?.pipeline?.uploaded || 0) + (status?.pipeline?.scripted || 0) + (status?.pipeline?.researched || 0)) / totalPipeline * 100
                        : 0
                      const pillarCount = channel?.pillars?.length || 0
                      const pillarScore = Math.min(100, pillarCount * 20)
                      const monetizationReady = channel?.youtubeConnected ? 100 : 0
                      const composite = Math.round(nicheScore * 10 * 0.3 + pipelineEfficiency * 0.3 + pillarScore * 0.2 + monetizationReady * 0.2)
                      const grade = composite >= 80 ? 'A' : composite >= 60 ? 'B' : composite >= 40 ? 'C' : composite >= 20 ? 'D' : 'F'
                      const gradeColor = composite >= 80 ? 'text-emerald-400' : composite >= 60 ? 'text-cyan-400' : composite >= 40 ? 'text-amber-400' : 'text-rose-400'
                      const metrics = [
                        { label: 'Niche Fit', value: Math.round(nicheScore * 10), max: 100, color: 'bg-violet-500', weight: '30%' },
                        { label: 'Pipeline Efficiency', value: Math.round(pipelineEfficiency), max: 100, color: 'bg-cyan-500', weight: '30%' },
                        { label: 'Content Pillars', value: pillarScore, max: 100, color: 'bg-emerald-500', weight: '20%' },
                        { label: 'Monetization', value: monetizationReady, max: 100, color: 'bg-amber-500', weight: '20%' },
                      ]
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-4">
                            <motion.div
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: 'spring', stiffness: 150, delay: 0.2 }}
                              className="relative w-20 h-20 flex items-center justify-center"
                            >
                              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                                <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="6" />
                                <circle cx="40" cy="40" r="34" fill="none" stroke={composite >= 80 ? '#10b981' : composite >= 60 ? '#06b6d4' : composite >= 40 ? '#f59e0b' : '#f43f5e'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${composite * 2.14} 214`} className="transition-all duration-1000" />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-xl font-bold font-tabular-nums ${gradeColor}`}>{grade}</span>
                                <span className="text-[10px] text-slate-400">{composite}%</span>
                              </div>
                            </motion.div>
                            <div className="flex-1 space-y-1.5">
                              {metrics.map((m, i) => (
                                <div key={i} className="space-y-0.5">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400">{m.label} <span className="text-slate-600">({m.weight})</span></span>
                                    <span className="text-slate-300 font-mono">{m.value}%</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${m.value}%` }}
                                      transition={{ delay: i * 0.1 + 0.3, duration: 0.6 }}
                                      className={`h-full rounded-full ${m.color}`}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Composite score combining niche fit (30%), pipeline throughput (30%), content pillar coverage (20%), and monetization readiness (20%).
                            {composite < 40 && ' Focus on connecting YouTube and producing content to improve.'}
                            {composite >= 40 && composite < 70 && ' Good foundation — increase pipeline throughput and pillar coverage.'}
                            {composite >= 70 && ' Strong position — optimize for maximum throughput.'}
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                </GradientCard>

                {/* Quick Stats Summary Bar */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <QuickStatItem label="Ideas" value={status?.pipeline?.ideas || 0} icon={Lightbulb} color="text-violet-400" bg="bg-violet-500/10" delay={0} />
                  <QuickStatItem label="Researched" value={status?.pipeline?.researched || 0} icon={Search} color="text-blue-400" bg="bg-blue-500/10" delay={0.05} />
                  <QuickStatItem label="Scripted" value={status?.pipeline?.scripted || 0} icon={PenTool} color="text-amber-400" bg="bg-amber-500/10" delay={0.1} />
                  <QuickStatItem label="Producing" value={status?.pipeline?.producing || 0} icon={Clapperboard} color="text-emerald-400" bg="bg-emerald-500/10" delay={0.15} />
                  <QuickStatItem label="Approved" value={status?.pipeline?.approved || 0} icon={CheckCircle2} color="text-cyan-400" bg="bg-cyan-500/10" delay={0.2} />
                  <QuickStatItem label="Uploaded" value={status?.pipeline?.uploaded || 0} icon={CloudUpload} color="text-rose-400" bg="bg-rose-500/10" delay={0.25} />
                </div>

                {/* Pipeline Flow Visualization */}
                <GradientCard glow="from-violet-500/5 to-cyan-500/5">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-400" /> Production Pipeline
                      </h3>
                      <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                        {totalPipeline} total
                      </Badge>
                    </div>
                    <PipelineFlow pipeline={status?.pipeline || null} />
                  </div>
                </GradientCard>

                {/* Agent Cycle Visualization */}
                <GradientCard glow="from-cyan-500/5 to-violet-500/5">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2">
                        <Radio className="w-4 h-4 text-cyan-400" /> Autonomous Cycle
                      </h3>
                      <Badge variant="outline" className={`text-[10px] ${
                        ['running', 'researching_niches', 'creating_strategy', 'researching_topic', 'writing_script', 'producing_video', 'reviewing', 'uploading', 'cycle_complete'].includes(status?.state || '')
                          ? 'border-emerald-500/50 text-emerald-400'
                          : 'border-slate-600 text-slate-400'
                      }`}>
                        {['running', 'researching_niches', 'creating_strategy', 'researching_topic', 'writing_script', 'producing_video', 'reviewing', 'uploading', 'cycle_complete'].includes(status?.state || '') ? 'ACTIVE' : 'IDLE'}
                      </Badge>
                    </div>
                    {(() => {
                      const cycleStages = [
                        { key: 'research', label: 'Research', icon: Search, color: 'text-blue-400', ring: 'ring-blue-500/40', bg: 'bg-blue-500/10', states: ['researching_niches', 'researching_topic', 'creating_strategy'] },
                        { key: 'script', label: 'Script', icon: PenTool, color: 'text-amber-400', ring: 'ring-amber-500/40', bg: 'bg-amber-500/10', states: ['writing_script'] },
                        { key: 'produce', label: 'Produce', icon: Clapperboard, color: 'text-emerald-400', ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/10', states: ['producing_video'] },
                        { key: 'review', label: 'Review', icon: MessageSquare, color: 'text-rose-400', ring: 'ring-rose-500/40', bg: 'bg-rose-500/10', states: ['reviewing'] },
                        { key: 'upload', label: 'Upload', icon: CloudUpload, color: 'text-cyan-400', ring: 'ring-cyan-500/40', bg: 'bg-cyan-500/10', states: ['uploading'] },
                        { key: 'analyze', label: 'Analyze', icon: BarChart3, color: 'text-violet-400', ring: 'ring-violet-500/40', bg: 'bg-violet-500/10', states: ['cycle_complete'] },
                      ]
                      const currentState = status?.state || 'idle'
                      const activeIndex = cycleStages.findIndex(s => s.states.includes(currentState))
                      const isActive = activeIndex !== -1
                      return (
                        <div className="relative">
                          {/* Ring visualization */}
                          <div className="flex items-center justify-center py-2">
                            <svg width="180" height="180" viewBox="0 0 180 180" className="opacity-90">
                              {cycleStages.map((stage, i) => {
                                const startAngle = (i * 60 - 90) * (Math.PI / 180)
                                const endAngle = ((i + 1) * 60 - 90) * (Math.PI / 180)
                                const isStageActive = stage.states.includes(currentState)
                                const isPast = isActive && i < activeIndex
                                const midAngle = ((i * 60 + 30) - 90) * (Math.PI / 180)
                                const labelX = 90 + 65 * Math.cos(midAngle)
                                const labelY = 90 + 65 * Math.sin(midAngle)
                                const x1 = 90 + 50 * Math.cos(startAngle)
                                const y1 = 90 + 50 * Math.sin(startAngle)
                                const x2 = 90 + 50 * Math.cos(endAngle)
                                const y2 = 90 + 50 * Math.sin(endAngle)
                                const ix1 = 90 + 30 * Math.cos(startAngle)
                                const iy1 = 90 + 30 * Math.sin(startAngle)
                                const ix2 = 90 + 30 * Math.cos(endAngle)
                                const iy2 = 90 + 30 * Math.sin(endAngle)
                                const segmentColors = ['#3b82f6', '#f59e0b', '#10b981', '#f43f5e', '#06b6d4', '#8b5cf6']
                                return (
                                  <g key={stage.key}>
                                    <path
                                      d={`M ${ix1} ${iy1} A 30 30 0 0 1 ${ix2} ${iy2} L ${x2} ${y2} A 50 50 0 0 0 ${x1} ${y1} Z`}
                                      fill={isStageActive ? segmentColors[i] : isPast ? segmentColors[i] + '80' : '#1e293b'}
                                      stroke={isStageActive ? segmentColors[i] : '#334155'}
                                      strokeWidth={isStageActive ? 2 : 1}
                                      opacity={isStageActive ? 1 : isPast ? 0.7 : 0.4}
                                    />
                                    {isStageActive && (
                                      <circle cx={labelX} cy={labelY} r="3" fill={segmentColors[i]} opacity={0.8}>
                                        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
                                      </circle>
                                    )}
                                  </g>
                                )
                              })}
                              {/* Center text */}
                              <circle cx="90" cy="90" r="26" fill="#0f172a" stroke="#334155" strokeWidth="1" />
                              <text x="90" y="86" textAnchor="middle" fill={isActive ? '#e2e8f0' : '#64748b'} fontSize="9" fontWeight="bold">
                                {isActive ? cycleStages[activeIndex]?.label.toUpperCase() : 'IDLE'}
                              </text>
                              <text x="90" y="98" textAnchor="middle" fill="#64748b" fontSize="7">
                                {isActive ? 'In Progress' : 'Waiting'}
                              </text>
                            </svg>
                          </div>
                          {/* Stage pills */}
                          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                            {cycleStages.map((stage, i) => {
                              const Icon = stage.icon
                              const isStageActive = stage.states.includes(currentState)
                              const isPast = isActive && i < activeIndex
                              return (
                                <motion.div
                                  key={stage.key}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.05, duration: 0.2 }}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-medium border transition-all duration-300 ${
                                    isStageActive
                                      ? `${stage.bg} ${stage.ring} ${stage.color} border-current shadow-sm`
                                      : isPast
                                        ? 'bg-slate-800/40 border-slate-600/30 text-slate-400'
                                        : 'bg-slate-800/20 border-slate-700/30 text-slate-500'
                                  }`}
                                >
                                  <Icon className="w-3 h-3" />
                                  {stage.label}
                                  {isStageActive && (
                                    <motion.div
                                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                                      transition={{ duration: 1.5, repeat: Infinity }}
                                      className="w-1.5 h-1.5 rounded-full bg-current"
                                    />
                                  )}
                                  {isPast && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                </motion.div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </GradientCard>

                {/* Quick Actions Bar */}
                <GradientCard glow="from-emerald-500/5 to-violet-500/5">
                  <div className="p-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider shrink-0 mr-1">Quick:</span>
                      {[
                        { cmd: 'research-niche', label: 'Research Niche', icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
                        { cmd: 'write-script', label: 'Write Script', icon: PenTool, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
                        { cmd: 'produce-video', label: 'Produce Video', icon: Clapperboard, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                        { cmd: 'review-quality', label: 'Review Quality', icon: MessageSquare, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
                        { cmd: 'upload-youtube', label: 'Upload', icon: CloudUpload, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
                        { cmd: 'collect-analytics', label: 'Analytics', icon: BarChart3, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
                      ].map((action, i) => (
                        <motion.button
                          key={action.cmd}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => sendCommand(action.cmd)}
                          disabled={loading || !!status?.emergencyStop}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-medium ${action.bg} ${action.color} shrink-0 transition-all duration-200 hover:shadow-sm disabled:opacity-40 disabled:pointer-events-none`}
                        >
                          <action.icon className="w-3 h-3" />
                          <span className="hidden sm:inline">{action.label}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </GradientCard>

                {/* AI Insights Card */}
                <GradientCard glow="from-amber-500/5 to-emerald-500/5">
                  <div className="p-4">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-200 mb-3 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" /> AI Insights
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {[
                        { icon: Clock3, text: 'Best upload time: 2-4 PM EST for maximum engagement', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                        { icon: TrendingUp, text: `${status?.niche || 'Tech'} content shows 2.3× higher engagement — produce more`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { icon: ShieldCheck, text: 'Quality pass rate improved 12% this week with refined prompts', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                      ].map((insight, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1, duration: 0.3 }}
                          className={`flex items-start gap-2.5 p-3 rounded-lg ${insight.bg} border border-slate-700/30`}
                        >
                          <insight.icon className={`w-4 h-4 ${insight.color} shrink-0 mt-0.5`} />
                          <p className="text-xs text-slate-300 leading-relaxed">{insight.text}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </GradientCard>

                {/* Weekly Summary */}
                <GradientCard glow="from-amber-500/5 to-violet-500/5">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-amber-400" /> Weekly Summary
                      </h3>
                      <span className="text-[11px] text-slate-400">This week</span>
                    </div>
                    {(() => {
                      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      const weekLogs = logs.filter((l: any) => new Date(l.createdAt) >= sevenDaysAgo)
                      const decisions = weekLogs.filter((l: any) => /^(niche_|strategy_|mode_)/.test(l.action)).length
                      const ideasGenerated = weekLogs.filter((l: any) => l.action === 'metadata_update' && /idea/i.test(l.details || '')).length
                      const videosProduced = weekLogs.filter((l: any) => l.action === 'metadata_update' && /produced|producing/i.test(l.details || '')).length
                      const reviewsCompleted = weekLogs.filter((l: any) => l.action === 'metadata_update' && /review|approved|failed/i.test(l.details || '')).length
                      const totalActivity = decisions + ideasGenerated + videosProduced + reviewsCompleted
                      const message = totalActivity === 0
                        ? 'No activity this week. Start the autonomous cycle to begin producing content.'
                        : totalActivity <= 5
                        ? 'Slow week — consider increasing upload frequency or running niche research.'
                        : totalActivity <= 15
                        ? 'Steady progress. Keep the momentum going!'
                        : 'Excellent output this week! The autonomous agent is running at full capacity.'
                      const chips = [
                        { icon: GitBranch, count: decisions, label: 'Decisions', color: 'text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' },
                        { icon: Lightbulb, count: ideasGenerated, label: 'Ideas', color: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' },
                        { icon: Film, count: videosProduced, label: 'Produced', color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
                        { icon: ShieldCheck, count: reviewsCompleted, label: 'Reviews', color: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-500/20' },
                      ]
                      return (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                            {chips.map((chip, i) => (
                              <motion.div
                                key={chip.label}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08, duration: 0.3 }}
                                className={`flex items-center gap-2 p-2 rounded-lg ${chip.bg} ring-1 ${chip.ring}`}
                              >
                                <chip.icon className={`w-3.5 h-3.5 ${chip.color} shrink-0`} />
                                <div className="min-w-0">
                                  <span className={`text-sm font-bold font-tabular-nums ${chip.color}`}>{chip.count}</span>
                                  <span className="text-[10px] text-slate-400 ml-1">{chip.label}</span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                          {/* Mini progress bar */}
                          <div className="w-full h-1.5 rounded-full bg-slate-800/60 mb-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(totalActivity / 20 * 100, 100)}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-violet-500/60"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{message}</p>
                        </>
                      )
                    })()}
                  </div>
                </GradientCard>

                {/* Agent Thinking & Next Steps */}
                <GradientCard glow="from-violet-500/5 to-cyan-500/5">
                  <div className="p-4">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-200 mb-3 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-violet-400" /> Agent Intelligence
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Current State */}
                      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${stateColor(status?.state || 'idle').dot} ${['running', 'researching_niches', 'creating_strategy', 'researching_topic', 'writing_script', 'producing_video', 'reviewing', 'uploading', 'cycle_complete'].includes(status?.state || '') ? 'animate-pulse' : ''}`} />
                          <span className="text-xs font-medium text-slate-300">Current State</span>
                        </div>
                        <p className={`text-sm font-bold font-tabular-nums ${stateColor(status?.state || 'idle').text}`}>
                          {stateColor(status?.state || 'idle').label}
                        </p>
                        <p className="text-[11px] text-slate-400 capitalize">{status?.state?.replace(/_/g, ' ') || 'idle'}</p>
                        {status?.currentJob && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                            <span className="text-[10px] text-violet-300 font-mono truncate">{status.currentJob}</span>
                          </div>
                        )}
                      </div>
                      {/* Next Action */}
                      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs font-medium text-slate-300">Next Action</span>
                        </div>
                        <p className="text-sm font-medium text-emerald-300">
                          {status?.nextAction || 'Awaiting command'}
                        </p>
                        {status?.lastError && (
                          <div className="flex items-start gap-1.5 pt-1">
                            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                            <span className="text-[10px] text-red-300 line-clamp-2">{status.lastError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Pipeline efficiency */}
                    <div className="mt-3 p-2.5 rounded-lg bg-gradient-to-r from-slate-800/40 to-slate-800/20 border border-slate-700/20">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Pipeline Efficiency</span>
                        <span className="text-emerald-400 font-medium">
                          {totalPipeline > 0 ? Math.round(((status?.pipeline?.approved || 0) + (status?.pipeline?.uploaded || 0)) / totalPipeline * 100) : 0}% throughput
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${totalPipeline > 0 ? Math.round(((status?.pipeline?.approved || 0) + (status?.pipeline?.uploaded || 0)) / totalPipeline * 100) : 0}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                </GradientCard>

                {/* Controls + Live Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* Controls */}
                  <GradientCard className="lg:col-span-2" glow="from-emerald-500/5 to-cyan-500/5">
                    <div className="p-4">
                      <h3 className="text-sm font-semibold tracking-tight text-slate-200 mb-3 flex items-center gap-2">
                        <MousePointerClick className="w-4 h-4 text-emerald-400" /> Command Center
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          <Button
                            onClick={() => sendCommand('produce-next')}
                            disabled={loading || status?.emergencyStop || !!status?.emergencyStop}
                            className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-lg shadow-emerald-500/20 font-semibold"
                          >
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                            Produce Next Video
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            onClick={() => sendCommand('full-cycle')}
                            disabled={loading || !!status?.emergencyStop}
                            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-md shadow-violet-500/15"
                          >
                            {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
                            Full Cycle
                          </Button>
                        </motion.div>
                        <Button onClick={() => sendCommand('initial-setup')} disabled={loading || !!status?.emergencyStop} variant="secondary" size="sm">
                          <Brain className="w-3.5 h-3.5 mr-1.5" /> Setup
                        </Button>
                        <Button onClick={() => sendCommand('pause')} disabled={loading} variant="outline" size="sm" className="border-amber-500/30 text-amber-300 font-semibold hover:bg-amber-500/10 hover:text-amber-200">
                          <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause
                        </Button>
                        <Button onClick={() => sendCommand('resume')} disabled={loading} variant="outline" size="sm" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                          <Play className="w-3.5 h-3.5 mr-1.5" /> Resume
                        </Button>
                        <Button onClick={() => sendCommand('process-job')} disabled={loading} variant="outline" size="sm">
                          <Activity className="w-3.5 h-3.5 mr-1.5" /> Process Job
                        </Button>
                      </div>
                      {/* Error display */}
                      {status?.lastError && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          {status.lastError}
                        </motion.div>
                      )}
                      {status?.nextAction && (
                        <div className="mt-2 text-xs text-emerald-400/70 flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3" /> Next: {status.nextAction}
                        </div>
                      )}
                    </div>
                  </GradientCard>

                  {/* Live Feed */}
                  <GradientCard glow="from-amber-500/5 to-emerald-500/5">
                    <div className="p-4">
                      <h3 className="text-sm font-semibold tracking-tight text-slate-200 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Feed
                      </h3>
                      <LiveFeed logs={logs} />
                    </div>
                  </GradientCard>
                </div>

                {/* Performance Metrics dashboard */}
                <PerformanceMetrics
                  kpis={{
                    pipelineVelocity: {
                      current: status?.pipeline?.producing || 0,
                      target: 5,
                      sparkline: [1, 2, 1, 3, 2, 4, 3],
                    },
                    avgProductionTime: {
                      minutes: 8.5,
                      trend: -12,
                      sparkline: [12, 10, 11, 9, 8, 9, 8.5],
                    },
                    qualityPassRate: {
                      rate: pipeline?.reviews?.length
                        ? Math.round((pipeline.reviews.filter((r: any) => r.overallPassed).length / pipeline.reviews.length) * 100)
                        : 0,
                      trend: 5,
                      sparkline: [60, 65, 70, 68, 72, 75, 78],
                    },
                    storageUsed: {
                      mb: 124,
                      capMb: 1024,
                      sparkline: [80, 90, 100, 110, 115, 120, 124],
                    },
                  }}
                  productionTrend={Array.from({ length: 30 }, (_, i) => {
                    // Deterministic pseudo-data using sine waves (no Math.random/Date.now to avoid SSR hydration mismatch)
                    const phase = i / 5
                    const dayNum = i - 29
                    return {
                      date: `D${dayNum}`,
                      approved: Math.max(0, Math.round(1.5 + Math.sin(phase) * 1.2)),
                      failed: Math.max(0, Math.round(0.5 + Math.sin(phase + 1) * 0.7)),
                      inReview: Math.max(0, Math.round(0.8 + Math.cos(phase) * 0.6)),
                    }
                  })}
                  nicheMetrics={(channel?.niches || []).slice(0, 5).map((n: any, i: number) => ({
                    id: n.id,
                    name: n.nicheName,
                    compositeScore: n.compositeScore || 0,
                    videosProduced: 3 + ((i * 7) % 11),
                    avgQuality: 65 + ((i * 13) % 30),
                    revenuePotential: 55 + ((i * 17) % 40),
                  }))}
                  efficiency={{
                    approved: status?.pipeline?.approved || 0,
                    total: (status?.pipeline?.approved || 0) + (status?.pipeline?.producing || 0),
                    target: 80,
                  }}
                  heatmap={Array.from({ length: 42 }, (_, i) => ({
                    day: i % 7,
                    hourBucket: Math.floor(i / 7),
                    avgVideos: 0.3 + ((i * 0.37) % 1.7),
                  }))}
                />
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              PIPELINE TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="pipeline" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="pipeline-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* Pipeline Progress — Funnel bar + Stage detail cards + Quick actions */}
                <PipelineProgress
                  pipelineCounts={{
                    ideas: status?.pipeline?.ideas || 0,
                    researched: status?.pipeline?.researched || 0,
                    scripted: status?.pipeline?.scripted || 0,
                    producing: status?.pipeline?.producing || 0,
                    reviewing: status?.pipeline?.reviewing || 0,
                    uploaded: status?.pipeline?.uploaded || 0,
                  }}
                  onAction={(stageKey) => {
                    const commandMap: Record<string, string> = {
                      ideas: 'niche-research',
                      researched: 'research',
                      scripted: 'write-script',
                      producing: 'produce',
                      reviewing: 'review',
                      uploaded: 'upload',
                    }
                    sendCommand(commandMap[stageKey] || stageKey)
                  }}
                />

                {/* Pipeline Flow (large) with stage progress */}
                <GradientCard glow="from-violet-500/5 to-cyan-500/5">
                  <div className="p-4">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-200 mb-3 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" /> Content Pipeline Flow
                    </h3>
                    <PipelineFlow pipeline={status?.pipeline || null} />
                  </div>
                </GradientCard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Video Ideas — Enhanced with search / filter / detail drawer */}
                  <GlassCard variant="gradient" glowFrom="from-violet-500" glowTo="to-cyan-500" className="lg:col-span-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-violet-400" /> Video Ideas
                        <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{pipeline?.ideas?.length || 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {pipeline?.ideas?.length ? (
                        <IdeaExplorer
                          ideas={pipeline.ideas}
                          onSelectIdea={() => setActiveTab('pipeline')}
                          onBulkAction={() => {
                            pollAll()
                            toast({ type: 'success', title: 'Bulk action complete', description: 'Pipeline refreshed', duration: 2500 })
                          }}
                        />
                      ) : initialLoaded ? (
                        <EmptyState icon={Lightbulb} title="No ideas yet" desc="Run initial setup to generate video ideas from your niche." accent="violet" action={{ label: 'Generate Ideas', onClick: () => sendCommand('niche-research') }} />
                      ) : (
                        <IdeaListSkeleton count={5} />
                      )}
                    </CardContent>
                  </GlassCard>

                  {/* Video Projects — Clickable to open preview modal */}
                  <GlassCard variant="gradient" glowFrom="from-emerald-500" glowTo="to-cyan-500" className="lg:col-span-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Film className="w-4 h-4 text-emerald-400" /> Video Projects
                        <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{pipeline?.projects?.length || 0}</Badge>
                      </CardTitle>
                      <CardDescription className="text-[10px]">Click any project to preview video, script, scenes &amp; review. Use Select mode for bulk actions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {pipeline?.projects?.length ? (
                        <VideoProjectExplorer
                          projects={pipeline.projects}
                          onPreview={(id) => setPreviewVideoId(id)}
                          onBulkAction={() => {
                            pollAll()
                            toast({ type: 'success', title: 'Bulk action complete', description: 'Pipeline refreshed', duration: 2500 })
                          }}
                        />
                      ) : initialLoaded ? (
                        <EmptyState icon={Film} title="No projects yet" desc="Produce a video to see it appear here." accent="emerald" action={{ label: 'Produce Video', onClick: () => sendCommand('produce') }} />
                      ) : (
                        <IdeaListSkeleton count={3} />
                      )}
                    </CardContent>
                  </GlassCard>
                </div>

                {/* Uploads */}
                <GradientCard>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CloudUpload className="w-4 h-4 text-cyan-400" /> Uploads
                      <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{pipeline?.uploads?.length || 0}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-40">
                      {pipeline?.uploads?.length ? (
                        <div className="space-y-1">
                          {pipeline.uploads.map((upload: any) => (
                            <div key={upload.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/30 text-xs">
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${upload.uploadStatus === 'completed' ? 'border-emerald-500/50 text-emerald-400' : 'border-red-500/50 text-red-400'}`}>
                                {upload.uploadStatus}
                              </Badge>
                              <span className="text-slate-300 truncate flex-1">{upload.title}</span>
                              {upload.youtubeVideoId && (
                                <span className="text-[10px] text-slate-400 font-mono">{upload.youtubeVideoId}</span>
                              )}
                              <Badge variant="outline" className="text-[10px] border-slate-600 shrink-0">{upload.privacy}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState icon={CloudUpload} title="No uploads yet" desc="Videos will appear here after YouTube upload." accent="cyan" action={{ label: 'Upload Video', onClick: () => toast({ type: 'info', title: 'YouTube not connected', description: 'Connect your YouTube account to upload videos.', duration: 3000 }) }} />
                      )}
                    </ScrollArea>
                  </CardContent>
                </GradientCard>

                {/* Quality Review Panel */}
                <GlassCard variant="glow" glowFrom="from-rose-500" glowTo="to-violet-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-rose-400" /> Quality Review History
                      <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{pipeline?.reviews?.length || 0}</Badge>
                    </CardTitle>
                    <CardDescription className="text-[10px]">Fact-check, originality, copyright & policy compliance for every produced video</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pipeline?.reviews?.length || pipeline?.projects?.length ? (
                      <QualityReviewPanel
                        reviews={pipeline?.reviews || []}
                        projects={pipeline?.projects || []}
                      />
                    ) : initialLoaded ? (
                      <EmptyState icon={ShieldCheck} title="No quality reviews yet" desc="Produce a video to trigger automated review." accent="rose" action={{ label: 'Produce Video', onClick: () => sendCommand('produce') }} />
                    ) : (
                      <IdeaListSkeleton count={3} />
                    )}
                  </CardContent>
                </GlassCard>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              STRATEGY TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="strategy" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="strategy-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Channel Info */}
                  <GradientCard glow="from-violet-500/5 to-blue-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-400" /> Channel Identity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                      {channel?.channel ? (
                        <>
                          {[
                            { label: 'Name', value: channel.channel.name, icon: Youtube },
                            { label: 'Niche', value: channel.channel.niche, icon: Target },
                            { label: 'Positioning', value: channel.channel.positioning, icon: Compass },
                            { label: 'Target Viewer', value: channel.channel.targetViewer, icon: Users },
                            { label: 'Upload Cadence', value: channel.channel.uploadCadence, icon: Calendar },
                          ].map((item, i) => item.value && (
                            <div key={i} className="flex items-start gap-2.5 text-xs">
                              <item.icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                              <div>
                                <span className="text-slate-400">{item.label}:</span>
                                <span className="text-slate-200 ml-1.5">{item.value}</span>
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <EmptyState icon={Globe} title="Channel not configured" desc="Run initial setup to create your channel strategy." />
                      )}
                    </CardContent>
                  </GradientCard>

                  {/* Content Pillars */}
                  <GradientCard glow="from-amber-500/5 to-emerald-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-400" /> Content Pillars
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {channel?.pillars?.length ? (
                        <div className="space-y-2">
                          {channel.pillars.map((pillar: any, i: number) => (
                            <motion.div
                              key={pillar.id}
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.08 }}
                              className="flex items-start gap-3 p-2 rounded-lg bg-slate-800/40 border border-slate-700/30"
                            >
                              <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: pillar.color || '#6366f1' }} />
                              <div>
                                <p className="text-xs font-medium text-slate-200">{pillar.name}</p>
                                {pillar.description && <p className="text-[10px] text-slate-400 mt-0.5">{pillar.description}</p>}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState icon={Layers} title="No pillars defined" desc="Content pillars are created during initial setup." />
                      )}
                    </CardContent>
                  </GradientCard>
                </div>

                {/* Niche Rankings */}
                <GradientCard glow="from-emerald-500/5 to-cyan-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-400" /> Niche Analysis
                      <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{channel?.niches?.length || 0} niches scored</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {channel?.niches?.length ? (
                      <div className="space-y-3">
                        {/* Bar chart */}
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={nicheBarData} layout="vertical" margin={{ left: 24, right: 36, top: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: '#cbd5e1' }} />
                              <RechartsTooltip
                                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                                labelStyle={{ color: '#e2e8f0' }}
                              />
                              <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={22}>
                                {nicheBarData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.selected ? '#10b981' : '#8b5cf6'} fillOpacity={entry.selected ? 0.9 : 0.55} />
                                ))}
                                <LabelList
                                  dataKey="score"
                                  position="right"
                                  formatter={(v: any) => (typeof v === 'number' ? v.toFixed(1) : v)}
                                  style={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Selected niche highlight */}
                        {channel.niches.find((n: any) => n.isSelected) && (
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-emerald-300">
                              Selected: <strong>{channel.niches.find((n: any) => n.isSelected).nicheName}</strong>
                              {' '}(Score: {channel.niches.find((n: any) => n.isSelected).compositeScore.toFixed(1)})
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <EmptyState icon={Target} title="No niche analysis" desc="Run initial setup to research and score niches." />
                    )}
                  </CardContent>
                </GradientCard>

                {/* Niche Comparison Matrix */}
                <GradientCard glow="from-emerald-500/5 to-violet-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Compass className="w-4 h-4 text-emerald-400" /> Niche Comparison Matrix
                    </CardTitle>
                    <CardDescription className="text-[10px]">Multi-dimensional scoring across key criteria</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {channel?.niches?.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="border-b border-slate-700/50">
                              <th className="text-left py-2 px-2 text-slate-400 font-medium">Niche</th>
                              {['Revenue', 'Audience', 'Competition', 'Evergreen', 'Production', 'Risk'].map(h => (
                                <th key={h} className="text-center py-2 px-1.5 text-slate-400 font-medium">{h}</th>
                              ))}
                              <th className="text-center py-2 px-2 text-slate-400 font-medium">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {channel.niches.slice(0, 8).map((n: any) => (
                              <tr key={n.id} className={`border-b border-slate-800/50 ${n.isSelected ? 'bg-emerald-500/5' : ''}`}>
                                <td className="py-1.5 px-2 text-slate-200 font-medium truncate max-w-[120px]">{n.nicheName}</td>
                                {[
                                  { val: n.revenuePerHour, max: 50 },
                                  { val: n.audienceSize, max: 10 },
                                  { val: 10 - n.competition, max: 10 },
                                  { val: n.evergreenPotential, max: 10 },
                                  { val: 10 - n.productionDifficulty, max: 10 },
                                  { val: 10 - n.copyrightRisk - n.misinformationRisk, max: 10 },
                                ].map(({ val, max }, ci) => {
                                  const pct = Math.min(100, Math.max(0, ((val || 0) / max) * 100))
                                  const color = pct > 70 ? 'bg-emerald-500' : pct > 40 ? 'bg-amber-500' : 'bg-red-500'
                                  return (
                                    <td key={ci} className="py-1.5 px-1.5">
                                      <div className="flex items-center justify-center">
                                        <div className="w-12 h-1.5 rounded-full bg-slate-800">
                                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                                        </div>
                                      </div>
                                    </td>
                                  )
                                })}
                                <td className="py-1.5 px-2 text-center">
                                  <Badge variant="outline" className={`text-[10px] ${n.isSelected ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-600 text-slate-400'}`}>
                                    {(n.compositeScore || 0).toFixed(1)}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState icon={Compass} title="No niches to compare" desc="Run niche research to populate the comparison matrix." />
                    )}
                  </CardContent>
                </GradientCard>

                {/* Agent Health Diagnostics — New Component */}
                <GlassCard variant="gradient" glowFrom="from-cyan-500" glowTo="to-violet-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <HeartPulse className="w-4 h-4 text-cyan-400" /> Agent Health & Diagnostics
                    </CardTitle>
                    <CardDescription className="text-[10px]">System status, engine health, and runtime diagnostics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <HealthDiagnostics
                      agentState={status?.state || 'idle'}
                      operatingMode={status?.operatingMode || 'simulation'}
                      emergencyStop={status?.emergencyStop || false}
                      lastAction={status?.lastAction || null}
                      youtubeConnected={channel?.youtubeConnected || false}
                      niche={status?.niche || null}
                    />
                  </CardContent>
                </GlassCard>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              REVENUE TAB — Enhanced
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="revenue" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="revenue-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* YPP Progress — New Component */}
                <GlassCard variant="gradient" glowFrom="from-amber-500" glowTo="to-emerald-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-400" /> YouTube Partner Program
                    </CardTitle>
                    <CardDescription className="text-[10px]">Track your path toward monetization eligibility</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <YPPProgressTracker
                      subscribers={analytics?.totalSubscribers || 0}
                      watchHours={analytics?.totalWatchTime || 0}
                      publicUploads={status?.pipeline?.uploaded || 0}
                      communityStrikes={0}
                      twoStepVerified={false}
                      adsenseLinked={false}
                    />
                  </CardContent>
                </GlassCard>

                {/* Revenue Projections — New Component */}
                <RevenueProjections
                  totalViews={analytics?.totalViews || 0}
                  totalSubscribers={analytics?.totalSubscribers || 0}
                  estimatedRevenue={analytics?.estimatedRevenue || 0}
                  videos={status?.pipeline?.uploaded || 0}
                />

                {/* Revenue Forecast Chart — 12-Month Projection */}
                <RevenueForecastChart
                  currentRpm={analytics?.estimatedRevenue && analytics?.totalViews ? (analytics.estimatedRevenue / analytics.totalViews) * 1000 : 0}
                  currentViews={analytics?.totalViews || 0}
                  growthRate={0.15}
                />

                {/* Revenue Goal Tracker */}
                <GradientCard glow="from-emerald-500/5 to-violet-500/5">
                  <div className="p-4">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-200 mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-400" /> Revenue Goals
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label: 'First $1', current: analytics?.estimatedRevenue || 0, target: 1, icon: DollarSign, color: 'from-emerald-500 to-cyan-500' },
                        { label: '$100/month', current: (analytics?.estimatedRevenue || 0) * 30, target: 100, icon: TrendingUp, color: 'from-violet-500 to-purple-500' },
                        { label: '$1,000/month', current: (analytics?.estimatedRevenue || 0) * 30, target: 1000, icon: Rocket, color: 'from-amber-500 to-orange-500' },
                      ].map((goal, i) => {
                        const progress = Math.min(100, (goal.current / goal.target) * 100)
                        const Icon = goal.icon
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs text-slate-300 font-medium">{goal.label}</span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                ${goal.current.toFixed(2)} / ${goal.target}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ delay: i * 0.1 + 0.3, duration: 0.8, ease: 'easeOut' }}
                                className={`h-full rounded-full bg-gradient-to-r ${goal.color}`}
                              />
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                </GradientCard>

                {/* Revenue Projection Calculator */}
                <RevenueProjectionCalculator
                  currentRevenue={analytics?.estimatedRevenue || 0}
                  currentViews={analytics?.totalViews || 0}
                  currentSubscribers={analytics?.totalSubscribers || 0}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Revenue Tracking */}
                  <GradientCard glow="from-emerald-500/5 to-green-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" /> Revenue Tracking
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analytics?.estimatedRevenue ? (
                        <div className="space-y-3">
                          <div className="text-3xl font-bold font-tabular-nums tracking-tight text-emerald-400">
                            ${(analytics.estimatedRevenue || 0).toFixed(2)}
                          </div>
                          <p className="text-xs text-slate-400">Estimated lifetime revenue</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded-lg bg-slate-800/40">
                              <p className="text-[11px] text-slate-400">RPM</p>
                              <p className="text-sm font-mono text-slate-200">${(analytics.estimatedRevenue / Math.max(1, analytics.totalViews || 1) * 1000).toFixed(2)}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-800/40">
                              <p className="text-[11px] text-slate-400">Total Views</p>
                              <p className="text-sm font-mono text-slate-200">{(analytics.totalViews || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <EmptyState icon={DollarSign} title="No revenue data" desc="Connect YouTube and enable monetization to see revenue data." />
                      )}
                    </CardContent>
                  </GradientCard>

                  {/* Monetization Opportunities */}
                  <GradientCard glow="from-violet-500/5 to-pink-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-violet-400" /> Monetization Opportunities
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {[
                        { label: 'YouTube Partner Program', status: 'Thresholds not met', icon: Award, met: false },
                        { label: 'Ad Revenue', status: 'Requires YPP', icon: DollarSign, met: false },
                        { label: 'Channel Memberships', status: 'Requires 1K subscribers', icon: Users, met: false },
                        { label: 'Super Chat', status: 'Requires YPP + livestream', icon: MessageSquare, met: false },
                        { label: 'Merch Shelf', status: 'Requires 10K subscribers', icon: CreditCard, met: false },
                        { label: 'Sponsorships', status: 'Available with audience', icon: Megaphone, met: false },
                      ].map((opp, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-colors text-xs"
                        >
                          <opp.icon className={`w-3.5 h-3.5 ${opp.met ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <span className="text-slate-200 flex-1">{opp.label}</span>
                          <Badge variant="outline" className={`text-[10px] ${opp.met ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-600 text-slate-400'}`}>
                            {opp.status}
                          </Badge>
                        </motion.div>
                      ))}
                    </CardContent>
                  </GradientCard>
                </div>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              ANALYTICS TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="analytics" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="analytics-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatusCard icon={Eye} label="Total Views" value={analytics?.totalViews || 0} color="text-blue-400" trend="up" hint="Cumulative views across all uploaded videos" />
                  <StatusCard icon={Users} label="Subscribers" value={analytics?.totalSubscribers || 0} color="text-emerald-400" hint="Total channel subscribers" />
                  <StatusCard icon={Clock} label="Watch Hours" value={Math.round((analytics?.totalWatchTime || 0) / 60)} valueSuffix="hrs" color="text-violet-400" hint="Total watch time in hours" />
                  <StatusCard icon={DollarSign} label="Est. Revenue" value={`$${(analytics?.estimatedRevenue || 0).toFixed(2)}`} color="text-amber-400" trend={(analytics?.estimatedRevenue || 0) > 0 ? 'up' : undefined} hint="Estimated revenue based on current metrics" />
                </div>
                {/* Growth Trends Chart — Views, Subscribers, Revenue over 30 days */}
                <GrowthTrendsChart
                  totalViews={analytics?.totalViews}
                  totalSubscribers={analytics?.totalSubscribers}
                  estimatedRevenue={analytics?.estimatedRevenue}
                />
                {/* CPM/RPM Dashboard — Ad rate analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <CpmRpmDashboard
                    estimatedRevenue={analytics?.estimatedRevenue}
                    totalViews={analytics?.totalViews}
                  />
                  {/* Performance Breakdown — Top videos, traffic sources, retention */}
                  <PerformanceBreakdown uploads={pipeline?.uploads} />
                </div>
                <GradientCard glow="from-blue-500/5 to-violet-500/5">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" /> Performance Trends</CardTitle>
                        <CardDescription className="text-[10px]">Views, engagement, and revenue over time</CardDescription>
                      </div>
                      {!channel?.youtubeConnected && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300 bg-amber-500/10 shrink-0">
                          <Sparkles className="w-3 h-3 mr-1" />Synthetic data
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={pipelineChartData.length ? pipelineChartData : [{time:'00:00',ideas:0,produced:0,uploaded:0}]} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="analyticsGrad1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                            <linearGradient id="analyticsGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                          <RechartsTooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} />
                          <Area type="monotone" dataKey="ideas" stroke="#3b82f6" fill="url(#analyticsGrad1)" strokeWidth={2} />
                          <Area type="monotone" dataKey="produced" stroke="#10b981" fill="url(#analyticsGrad2)" strokeWidth={2} />
                          <Area type="monotone" dataKey="uploaded" stroke="#f59e0b" fillOpacity={0} strokeWidth={2} strokeDasharray="4 4" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </GradientCard>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <GradientCard glow="from-emerald-500/5 to-cyan-500/5">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-emerald-400" /> Traffic Sources</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2.5">
                        {[
                          { source: 'YouTube Search', pct: 42, icon: Search, color: 'bg-blue-500' },
                          { source: 'Suggested Videos', pct: 28, icon: Video, color: 'bg-violet-500' },
                          { source: 'External', pct: 15, icon: ExternalLink, color: 'bg-emerald-500' },
                          { source: 'Browse Features', pct: 10, icon: Compass, color: 'bg-amber-500' },
                          { source: 'Direct/Unknown', pct: 5, icon: HelpCircle, color: 'bg-slate-500' },
                        ].map((src, i) => (
                          <div key={i} className="flex items-center gap-2.5">
                            <src.icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="text-[10px] text-slate-400 w-24 shrink-0 truncate">{src.source}</span>
                            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${src.pct}%` }} transition={{ delay: i * 0.1 + 0.3, duration: 0.6 }} className={`h-full rounded-full ${src.color}`} />
                            </div>
                            <span className="text-[11px] text-slate-400 w-8 text-right font-mono">{src.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </GradientCard>
                  <GradientCard glow="from-amber-500/5 to-violet-500/5">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-amber-400" /> Key Metrics</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'CTR', value: '4.2%', icon: MousePointerClick, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                          { label: 'Avg View', value: '6:32', icon: Clock3, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                          { label: 'Retention', value: '58%', icon: Eye, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                          { label: 'RPM', value: '$2.40', icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                          { label: 'Likes/View', value: '3.2%', icon: ThumbsUp, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                          { label: 'Comments', value: '12', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        ].map((kpi, i) => {
                          const Icon = kpi.icon
                          return (
                            <div key={i} className={`p-2.5 rounded-lg ${kpi.bg} border border-slate-700/20 flex items-center gap-2`}>
                              <Icon className={`w-4 h-4 ${kpi.color} shrink-0`} />
                              <div><p className={`text-sm font-bold font-tabular-nums ${kpi.color}`}>{kpi.value}</p><p className="text-[10px] text-slate-400">{kpi.label}</p></div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </GradientCard>
                </div>
                <GradientCard glow="from-violet-500/5 to-cyan-500/5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Film className="w-4 h-4 text-violet-400" /> Recent Video Performance</CardTitle></CardHeader>
                  <CardContent>
                    {pipeline?.uploads?.length ? (
                      <ScrollArea className="h-48">
                        <div className="space-y-1.5">
                          {pipeline.uploads.slice(0, 8).map((upload: any, i: number) => (
                            <motion.div key={upload.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                              className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30 border border-slate-700/20 text-xs">
                              <Film className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-slate-300 truncate flex-1 font-medium">{upload.title}</span>
                              <Badge variant="outline" className="text-[10px] border-slate-600 shrink-0">{upload.privacy}</Badge>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${upload.uploadStatus === 'completed' ? 'border-emerald-500/50 text-emerald-400' : 'border-amber-500/50 text-amber-400'}`}>{upload.uploadStatus}</Badge>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (<EmptyState icon={Film} title="No upload data" desc="Upload videos to see performance analytics." />)}
                  </CardContent>
                </GradientCard>
              </motion.div>
            </AnimatePresence>
          </TabsContent>
          {/* ══════════════════════════════════════════════════════════
              OPPORTUNITIES TAB — New
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="opportunities" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="opportunities-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <SponsorshipDiscovery
                  onDiscover={() => sendCommand('discover-opportunities')}
                />
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              EXPERIMENTS TAB — New
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="experiments" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="experiments-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <ExperimentManager
                  onCreate={(exp) => sendCommand('create-experiment', { experiment: exp })}
                  onCancel={(id) => sendCommand('cancel-experiment', { experimentId: id })}
                />
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ═════════════════════════════!═════════════════════════════
              LOGS TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="logs" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="logs-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <StatusCard icon={FileText} label="Total Logs" value={logs.length} color="text-slate-400" />
                  <StatusCard icon={AlertTriangle} label="Errors" value={logs.filter((l: any) => l.action === 'emergency_stop').length} color="text-red-400" />
                  <StatusCard icon={Activity} label="Today" value={logs.filter((l: any) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length} color="text-emerald-400" trend="up" />
                </div>
                <GradientCard glow="from-slate-500/5 to-violet-500/5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Audit Trail</CardTitle><CardDescription className="text-[10px]">Complete log of all agent actions and system events</CardDescription></CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      {logs.length ? (
                        <div className="space-y-1">
                          {logs.map((log: any, i: number) => (
                            <motion.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                              className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/30 transition-colors text-xs border-b border-slate-800/30">
                              <span className="text-slate-600 font-mono text-[10px] w-20 shrink-0">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              <Badge variant="outline" className={`text-[10px] h-4 shrink-0 ${actionColor(log.action)}`}>{actionLabel(log.action)}</Badge>
                              <span className="text-slate-500 text-[10px] w-14 shrink-0">{log.actor}</span>
                              <span className="text-slate-300 truncate flex-1 font-mono text-[10px]">{(() => { try { const d = JSON.parse(log.details || '{}'); return d.message || d.detail || log.details } catch { return log.details } })()}</span>
                              {log.target && (<span className="text-slate-500 text-[10px] shrink-0 font-mono">{log.target}</span>)}
                            </motion.div>
                          ))}
                        </div>
                      ) : (<EmptyState icon={FileText} title="No logs" desc="Agent activity will be logged here." />)}
                    </ScrollArea>
                  </CardContent>
                </GradientCard>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              CALENDAR TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="calendar" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="calendar-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {pipeline?.ideas?.length || pipeline?.uploads?.length ? (
                  <ContentCalendar
                    ideas={pipeline?.ideas || []}
                    uploads={pipeline?.uploads || []}
                    className="border-0 bg-transparent shadow-none"
                  />
                ) : (
                  <GlassCard variant="glow" glowFrom="from-violet-500" glowTo="to-cyan-500">
                    <CardContent className="py-10">
                      <EmptyState icon={CalendarDays} title="No calendar data" desc="Produce or schedule videos to populate the calendar." accent="amber" action={{ label: 'Schedule Video', onClick: () => setActiveTab('scheduler') }} />
                    </CardContent>
                  </GlassCard>
                )}
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              SCHEDULER TAB — Content Scheduling UI
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="scheduler" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="scheduler-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <GlassCard variant="glow" glowFrom="from-cyan-500" glowTo="to-emerald-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-cyan-400" /> Content Scheduler
                    </CardTitle>
                    <CardDescription className="text-[10px]">Drag ideas onto the 14-day schedule, or use quick-schedule to assign a date and time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ContentScheduler
                      ideas={schedulerIdeas}
                      onSchedule={handleScheduleIdea}
                      onUnschedule={handleUnscheduleIdea}
                      onAutoFill={() => {
                        // Auto-fill: schedule first N unscheduled ideas into next 7 days at 9am
                        const unscheduled = schedulerIdeas.filter(i => !i.scheduledDate)
                        let dayOffset = 1
                        unscheduled.slice(0, 7).forEach((idea) => {
                          const d = new Date()
                          d.setDate(d.getDate() + dayOffset)
                          dayOffset += 1
                          handleScheduleIdea(idea.id, d.toISOString().slice(0, 10), '09:00')
                        })
                      }}
                      onClearSchedule={() => {
                        schedulerIdeas.filter(i => i.scheduledDate).forEach((idea) => {
                          handleUnscheduleIdea(idea.id)
                        })
                      }}
                    />
                  </CardContent>
                </GlassCard>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              DECISIONS TAB — Agent Autonomous Decision Timeline
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="decisions" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="decisions-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatusCard icon={GitBranch} label="Total Decisions" value={logs.length} color="text-violet-400" hint="All agent decisions and actions" />
                  <StatusCard icon={CheckCircle2} label="Successful" value={logs.filter((l: any) => l.action !== 'emergency_stop' && !(l.details || '').includes('error')).length} color="text-emerald-400" trend="up" />
                  <StatusCard icon={AlertTriangle} label="Errors" value={logs.filter((l: any) => (l.details || '').includes('error') || (l.details || '').includes('fail')).length} color="text-red-400" />
                  <StatusCard icon={Zap} label="Last Action" value={logs[0] ? new Date(logs[0].createdAt).toLocaleTimeString() : 'N/A'} color="text-amber-400" />
                </div>
                <GradientCard glow="from-violet-500/5 to-cyan-500/5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4 text-violet-400" /> Decision Timeline</CardTitle><CardDescription className="text-[10px]">Complete history of agent decisions and actions</CardDescription></CardHeader>
                  <CardContent>
                    {logs.length ? (
                      <ScrollArea className="h-96">
                        <div className="relative">
                          <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-violet-500/30 via-slate-700/30 to-transparent" />
                          <div className="space-y-3">
                            {logs.slice(0, 30).map((log: any, i: number) => {
                              const detail = (() => { try { return JSON.parse(log.details || '{}') } catch { return { message: log.details } } })()
                              return (
                                <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="flex items-start gap-3 pl-1">
                                  <div className={`w-5 h-5 rounded-full border-2 border-slate-800 shrink-0 mt-0.5 flex items-center justify-center ${log.action === 'emergency_stop' ? 'bg-red-500 border-red-500/50' : log.action === 'upload' ? 'bg-cyan-500 border-cyan-500/50' : log.action === 'strategy_change' ? 'bg-violet-500 border-violet-500/50' : 'bg-slate-600 border-slate-600/50'}`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className={`text-[10px] h-4 ${actionColor(log.action)}`}>{actionLabel(log.action)}</Badge>
                                      <span className="text-[10px] text-slate-400 font-mono">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5 truncate">{detail.message || detail.detail || log.details || '—'}</p>
                                  </div>
                                </motion.div>
                              )
                            })}
                          </div>
                        </div>
                      </ScrollArea>
                    ) : (<EmptyState icon={GitBranch} title="No decisions recorded" desc="Agent decisions will appear here as it operates." />)}
                  </CardContent>
                </GradientCard>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              SETTINGS TAB — Enhanced
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="settings" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="settings-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* Operating Mode */}
                <GradientCard glow="from-violet-500/5 to-cyan-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ToggleLeft className="w-4 h-4 text-violet-400" /> Operating Mode
                    </CardTitle>
                    <CardDescription className="text-[10px]">Controls what actions the autonomous agent is permitted to perform</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {MODES.map((mode) => {
                        const Icon = mode.icon
                        const isActive = status?.operatingMode === mode.key
                        return (
                          <motion.button
                            key={mode.key}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => sendCommand('set-mode', { mode: mode.key })}
                            className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                              isActive ? mode.activeColor + ' shadow-lg' : mode.color + ' bg-slate-800/40 hover:bg-slate-800/60'
                            }`}
                          >
                            <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <p className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>{mode.label}</p>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{mode.desc}</p>
                            {isActive && (
                              <Badge className={`mt-2 text-[10px] ${mode.badge}`}>Active</Badge>
                            )}
                          </motion.button>
                        )
                      })}
                    </div>
                  </CardContent>
                </GradientCard>

                {/* YouTube Connection */}
                <GradientCard glow="from-red-500/5 to-amber-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-400" /> YouTube Connection
                    </CardTitle>
                    <CardDescription className="text-[10px]">Google OAuth 2.0 is required for video uploads and analytics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Connection Status */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${channel?.youtubeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <div>
                          <p className="text-xs font-medium text-slate-200">
                            {channel?.youtubeConnected ? 'Connected' : 'Not Connected'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {channel?.youtubeConnected ? `Channel: ${channel.channel?.name || 'Unknown'}` : 'Click below to connect your YouTube account'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={channel?.youtubeConnected ? 'default' : 'outline'} className={`text-[10px] ${channel?.youtubeConnected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'border-red-500/30 text-red-300'}`}>
                        {channel?.youtubeConnected ? 'Active' : 'Required'}
                      </Badge>
                    </div>

                    {/* Connect / Disconnect Button */}
                    {channel?.youtubeConnected ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                          <div className="flex items-center gap-2 mb-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-medium">YouTube Connected Successfully</span>
                          </div>
                          <p className="text-[10px] text-emerald-300/80">
                            {ytDemoMode
                              ? 'Demo mode — uploads and analytics are simulated.'
                              : 'Videos can be uploaded, analytics will be collected, and autonomous publishing is available.'}
                          </p>
                        </div>
                        <Button
                          onClick={disconnectYouTube}
                          disabled={ytDisconnecting}
                          variant="outline"
                          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-2"
                        >
                          {ytDisconnecting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Disconnecting...</>
                          ) : (
                            <><AlertOctagon className="w-4 h-4" /> Disconnect YouTube</>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Setup info */}
                        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/20 text-xs text-slate-300">
                          <p className="font-medium mb-1">Connect your YouTube channel to enable uploads & analytics</p>
                          <p className="text-[10px] text-slate-400">Use the setup wizard for step-by-step guidance, or try demo mode to explore.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => setYtWizardOpen(true)}
                            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-500/20 gap-1.5"
                          >
                            <Youtube className="w-3.5 h-3.5" /> Setup Wizard
                          </Button>
                          <Button
                            onClick={enableDemoMode}
                            disabled={ytConnecting}
                            variant="outline"
                            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 gap-1.5"
                          >
                            {ytConnecting ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting...</>
                            ) : (
                              <><Sparkles className="w-3.5 h-3.5" /> Demo Mode</>
                            )}
                          </Button>
                        </div>
                        <Button
                          onClick={connectYouTube}
                          disabled={ytConnecting}
                          variant="ghost"
                          className="w-full text-slate-400 hover:text-slate-200 gap-1.5 text-xs"
                        >
                          {ytConnecting ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Connecting...</>
                          ) : (
                            <><Youtube className="w-3 h-3" /> Already have credentials? Connect directly</>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </GradientCard>

                {/* Storage Dashboard (real disk usage) */}
                <StorageDashboard />

                {/* Agent Configuration */}
                <GradientCard glow="from-cyan-500/5 to-emerald-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings className="w-4 h-4 text-cyan-400" /> Agent Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Poll Interval', value: '5s', icon: Clock },
                        { label: 'Max Retries', value: '3', icon: RefreshCw },
                        { label: 'AI Provider', value: 'Z.AI', icon: Brain },
                        { label: 'Video Format', value: '1080p', icon: MonitorSmartphone },
                      ].map((config, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
                          <config.icon className="w-4 h-4 mx-auto text-slate-400 mb-1.5" />
                          <p className="text-xs font-bold text-slate-200">{config.value}</p>
                          <p className="text-[11px] text-slate-400">{config.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </GradientCard>

                {/* Job Queue */}
                <GradientCard glow="from-amber-500/5 to-violet-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-400" /> Job Queue
                      <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{jobs.length} jobs</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                      {['pending', 'running', 'completed', 'failed'].map(s => (
                        <div key={s} className="text-center p-2 rounded-lg bg-slate-800/30 border border-slate-700/20">
                          <p className="text-lg font-bold font-tabular-nums text-slate-200">{jobs.filter(j => j.status === s).length}</p>
                          <p className="text-[11px] text-slate-400 capitalize">{s}</p>
                        </div>
                      ))}
                    </div>
                    <ScrollArea className="h-32">
                      {jobs.length ? (
                        <div className="space-y-1">
                          {jobs.slice(0, 10).map((job: any) => (
                            <div key={job.id} className="flex items-center gap-2 p-1.5 rounded bg-slate-800/30 text-[10px]">
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${
                                job.status === 'completed' ? 'border-emerald-500/50 text-emerald-400' :
                                job.status === 'running' ? 'border-amber-500/50 text-amber-400' :
                                job.status === 'failed' ? 'border-red-500/50 text-red-400' :
                                'border-slate-600 text-slate-400'
                              }`}>{job.status}</Badge>
                              <span className="text-slate-300 truncate flex-1 font-mono">{job.type}</span>
                              <span className="text-slate-600 shrink-0">{new Date(job.scheduledAt).toLocaleTimeString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-4">No jobs in queue</p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </GradientCard>

                {/* Danger Zone */}
                <GradientCard glow="from-red-500/5 to-rose-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-300">
                      <AlertOctagon className="w-4 h-4" /> Danger Zone
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => sendCommand('stop')} disabled={!!status?.emergencyStop} variant="outline" size="sm" className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200">
                        <AlertOctagon className="w-3.5 h-3.5 mr-1.5" /> Emergency Stop
                      </Button>
                      <Button onClick={() => {
                        fetch('/api/agent/reset', { method: 'POST' }).then(() => pollAll())
                      }} variant="outline" size="sm" className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset Agent State
                      </Button>
                    </div>
                  </CardContent>
                </GradientCard>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

        </Tabs>

        {/* ═══ VIDEO PREVIEW MODAL ═══ */}
        <VideoPreviewModal
          videoProjectId={previewVideoId}
          onClose={() => setPreviewVideoId(null)}
        />

        {/* ═══ COMMAND PALETTE ═══ */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onAction={(actionId) => {
            setCommandPaletteOpen(false)
            if (actionId === 'produce-next') sendCommand('produce-next')
            else if (actionId === 'full-cycle') sendCommand('full-cycle')
            else if (actionId === 'pause') sendCommand('pause')
            else if (actionId === 'resume') sendCommand('resume')
            else if (actionId === 'process-job') sendCommand('process-job')
            else if (actionId === 'emergency-stop') sendCommand(status?.emergencyStop ? 'resume' : 'stop')
            else if (actionId === 'refresh') pollAll()
            else if (actionId === 'show-shortcuts') setShortcutsOpen(true)
          }}
          onNavigate={(tabValue) => {
            setCommandPaletteOpen(false)
            setActiveTab(tabValue)
          }}
          stats={{
            totalIdeas: status?.pipeline?.ideas || 0,
            approvedVideos: status?.pipeline?.approved || 0,
            uploadedVideos: status?.pipeline?.uploaded || 0,
            jobsQueued: jobs.filter(j => j.status === 'pending' || j.status === 'running').length,
          }}
        />

        {/* ═══ QUICK ACTIONS TOOLBAR (floating) ═══ */}
        <QuickActionsToolbar
          onCommand={(cmd) => {
            if (cmd === 'pause') sendCommand('pause')
            else if (cmd === 'initial-setup') sendCommand('initial-setup')
            else if (cmd === 'produce-next') sendCommand('produce-next')
            else if (cmd === 'collect-analytics') sendCommand('process-job')
            else if (cmd === 'strategy-review') setActiveTab('strategy')
            else if (cmd === 'schedule-jobs') setActiveTab('scheduler')
            else sendCommand(cmd)
          }}
          agentState={status?.state || 'idle'}
          loading={loading}
        />

        {/* ═══ YOUTUBE SETUP WIZARD ═══ */}
        <YouTubeSetupWizard
          open={ytWizardOpen}
          onOpenChange={setYtWizardOpen}
          onComplete={handleWizardComplete}
          onDemoMode={enableDemoMode}
        />

        {/* ═══ KEYBOARD SHORTCUTS ═══ */}
        <KeyboardShortcuts
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
          onCommand={(cmd) => {
            if (cmd === 'emergency-stop') sendCommand(status?.emergencyStop ? 'resume' : 'stop')
            else if (cmd === 'produce-next') sendCommand('produce-next')
            else if (cmd === 'refresh') pollAll()
            else if (cmd === 'pause') sendCommand('pause')
            else if (cmd === 'resume') sendCommand('resume')
            else if (cmd === 'command-palette') setCommandPaletteOpen(true)
            else if (cmd.startsWith('tab-')) {
              const tabs = ['overview', 'pipeline', 'strategy', 'calendar', 'scheduler', 'revenue', 'analytics', 'opportunities', 'experiments', 'logs', 'decisions', 'settings']
              const idx = parseInt(cmd.split('-')[1]) - 1
              if (idx >= 0 && idx < tabs.length) setActiveTab(tabs[idx])
            }
          }}
        />
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-slate-800/60 px-4 md:px-6 py-3 bg-slate-950/90 backdrop-blur-md mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-600">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-400 font-semibold">YouTube Revenue Studio v2.4</span>
            </div>
            <span className="text-slate-700">·</span>
            <span>Z.AI Autonomous Agent</span>
            <span className="text-slate-700">·</span>
            <Badge variant="outline" className={`text-[10px] h-4 ${MODES.find(m => m.key === status?.operatingMode)?.badge || 'border-slate-600 text-slate-400'}`}>
              {modeLabel(status?.operatingMode || 'private_production')}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-slate-600" />
              {totalPipeline} pipeline items
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-600/60" />
              {jobs.filter(j => j.status === 'pending').length} queued
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-slate-600" />
              {lastPoll.toLocaleTimeString()}
            </span>
            <span className="text-slate-700">|</span>
            <span>5s poll</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
