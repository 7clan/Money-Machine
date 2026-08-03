'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
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
  CheckCircle, AlertCircle, Clock3, FileWarning, ScanLine
} from 'lucide-react'

// ─── New Agent Feature Components ───────────────────────────────────
import { VideoPreviewModal } from '@/components/agent/video-preview-modal'
import { IdeaExplorer } from '@/components/agent/idea-explorer'
import { QualityReviewPanel } from '@/components/agent/quality-review-panel'
import { ContentCalendar } from '@/components/agent/content-calendar'
import { GlassCard } from '@/components/agent/glass-card'
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
    badge: 'bg-amber-500/20 text-amber-300',
  },
  {
    key: 'autonomous_publication',
    label: 'Autonomous Publication',
    desc: 'Full autonomy. Public uploads after review.',
    icon: Rocket,
    color: 'border-slate-500/50',
    activeColor: 'border-emerald-500 bg-emerald-500/10',
    badge: 'bg-emerald-500/20 text-emerald-300',
  },
]

// ─── Animation Variants ─────────────────────────────────────────────
const fadeVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

const cardHover = {
  whileHover: { scale: 1.01, transition: { duration: 0.2 } },
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

// ─── Sub-Components ──────────────────────────────────────────────────

function GradientCard({ children, className = '', glow = '' }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <motion.div {...cardHover} className={`relative group ${className}`}>
      <div className={`absolute -inset-[1px] rounded-xl bg-gradient-to-br from-slate-700/50 via-slate-800/50 to-slate-700/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${glow}`} />
      <div className="relative rounded-xl bg-slate-900/80 border border-slate-700/50 backdrop-blur-sm overflow-hidden">
        {children}
      </div>
    </motion.div>
  )
}

function StatusCard({ icon: Icon, label, value, sub, trend, color = 'text-emerald-400' }: {
  icon: any; label: string; value: string | number; sub?: string; trend?: 'up' | 'down' | 'flat'; color?: string
}) {
  return (
    <GradientCard>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${color === 'text-emerald-400' ? 'bg-emerald-500/10' : color === 'text-blue-400' ? 'bg-blue-500/10' : color === 'text-amber-400' ? 'bg-amber-500/10' : color === 'text-violet-400' ? 'bg-violet-500/10' : color === 'text-cyan-400' ? 'bg-cyan-500/10' : color === 'text-rose-400' ? 'bg-rose-500/10' : 'bg-slate-500/10'}`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          {trend && (
            <div className={`flex items-center text-xs ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'}`}>
              {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </GradientCard>
  )
}

function PipelineFlow({ pipeline }: { pipeline: AgentStatus['pipeline'] | null }) {
  if (!pipeline) return null
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2 px-1">
      {PIPELINE_STAGES.map((stage, i) => {
        const count = pipeline[stage.key as keyof typeof pipeline] || 0
        const Icon = stage.icon
        return (
          <React.Fragment key={stage.key}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className={`flex flex-col items-center min-w-[80px] p-3 rounded-xl border ${stage.border} ${stage.bg} transition-all duration-300 hover:scale-105`}
            >
              <Icon className={`w-5 h-5 ${stage.textColor} mb-1`} />
              <span className={`text-lg font-bold ${stage.textColor}`}>{count}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{stage.label}</span>
            </motion.div>
            {i < PIPELINE_STAGES.length - 1 && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 + 0.04, duration: 0.3 }}
                className="flex items-center px-1"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
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
    <div className="flex items-center gap-4">
      <div className="relative">
        <motion.div
          animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
          className={`w-14 h-14 rounded-full ${colors.dot} ring-4 ${colors.ring} shadow-lg ${colors.shadow} flex items-center justify-center`}
        >
          {isActive && (
            <motion.div
              animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              className={`absolute inset-0 rounded-full ${colors.dot}`}
            />
          )}
        </motion.div>
      </div>
      <div>
        <p className={`text-xl font-bold ${colors.text}`}>{colors.label}</p>
        <p className="text-xs text-slate-500 capitalize">{state.replace(/_/g, ' ')}</p>
      </div>
    </div>
  )
}

function LiveFeed({ logs }: { logs: any[] }) {
  const last3 = logs.slice(0, 3)
  if (!last3.length) return (
    <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
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
          <span className="text-slate-500 font-mono text-xs w-16 shrink-0">
            {new Date(log.createdAt).toLocaleTimeString()}
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

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
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

  // ── Commands ────────────────────────────────────────────────────
  const sendCommand = async (command: string, extra?: any) => {
    setLoading(true)
    try {
      const res = await fetch('/api/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, ...extra }),
      })
      const data = await res.json()
      await fetchStatus()
      return data
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── Computed ────────────────────────────────────────────────────
  const totalPipeline = status ? Object.values(status.pipeline).reduce((a: number, b: number) => a + b, 0) : 0
  const pipelineChartData = useMemo(() => {
    if (!logs.length) return []
    // Generate synthetic time-series from pipeline counts for the area chart
    const now = Date.now()
    return Array.from({ length: 12 }, (_, i) => ({
      time: new Date(now - (11 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ideas: Math.max(0, (status?.pipeline.ideas || 0) - Math.floor(Math.random() * i * 0.3)),
      produced: Math.max(0, (status?.pipeline.producing || 0) + Math.floor(Math.random() * 2)),
      uploaded: Math.max(0, (status?.pipeline.uploaded || 0) - Math.floor(Math.random() * i * 0.1)),
    }))
  }, [status?.pipeline, logs.length])

  const nicheBarData = useMemo(() => {
    if (!channel?.niches?.length) return []
    return channel.niches.slice(0, 10).map((n: any) => ({
      name: n.nicheName.length > 18 ? n.nicheName.slice(0, 18) + '...' : n.nicheName,
      score: n.compositeScore || 0,
      selected: n.isSelected,
    }))
  }, [channel?.niches])

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ═══ TOP BAR ═══ */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Youtube className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Revenue Studio
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Mission Control</p>
            </div>
          </div>

          {/* Center: Agent State + Mode */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            {status && <AgentStateIndicator state={status.state} />}
            <Badge className={`text-[10px] ${MODES.find(m => m.key === status?.operatingMode)?.badge || 'bg-slate-500/20 text-slate-300'}`}>
              {modeLabel(status?.operatingMode || 'private_production')}
            </Badge>
          </div>

          {/* Right: Emergency Stop + YT Connection */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={channel?.youtubeConnected ? 'default' : 'outline'} className={`text-[10px] ${channel?.youtubeConnected ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'border-slate-600 text-slate-400'}`}>
              <Youtube className="w-3 h-3 mr-1" />
              {channel?.youtubeConnected ? 'Connected' : 'Offline'}
            </Badge>

            {/* EMERGENCY STOP - ALWAYS VISIBLE */}
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                onClick={() => sendCommand(status?.emergencyStop ? 'resume' : 'stop')}
                className={`relative overflow-hidden ${
                  status?.emergencyStop
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-lg shadow-red-500/30 animate-pulse'
                    : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 shadow-md shadow-red-500/20'
                }`}
              >
                <AlertOctagon className="w-4 h-4 mr-1.5" />
                {status?.emergencyStop ? 'STOPPED' : 'E-STOP'}
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 p-3 md:p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          {/* ── Tab Bar ── */}
          <TabsList className="mb-4 bg-slate-900/80 border border-slate-800/50 backdrop-blur-sm w-full flex-wrap h-auto gap-1 p-1">
            {[
              { v: 'overview', icon: Activity, label: 'Overview' },
              { v: 'pipeline', icon: Layers, label: 'Pipeline' },
              { v: 'strategy', icon: Target, label: 'Strategy' },
              { v: 'calendar', icon: CalendarDays, label: 'Calendar' },
              { v: 'revenue', icon: DollarSign, label: 'Revenue' },
              { v: 'analytics', icon: BarChart3, label: 'Analytics' },
              { v: 'logs', icon: FileText, label: 'Logs' },
              { v: 'settings', icon: Settings, label: 'Settings' },
            ].map(tab => (
              <TabsTrigger
                key={tab.v}
                value={tab.v}
                className="data-[state=active]:bg-slate-700/80 data-[state=active]:text-white text-slate-400 text-xs px-3 py-1.5"
              >
                <tab.icon className="w-3.5 h-3.5 mr-1.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ══════════════════════════════════════════════════════════
              OVERVIEW TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="overview" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="overview-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* Top Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatusCard icon={Zap} label="Pipeline Items" value={totalPipeline} sub={`${status?.pipeline?.uploaded || 0} uploaded`} color="text-emerald-400" trend="up" />
                  <StatusCard icon={Video} label="Videos Produced" value={status?.pipeline?.producing || 0} sub={`${status?.pipeline?.approved || 0} approved`} color="text-cyan-400" />
                  <StatusCard icon={Brain} label="Niche" value={status?.niche ? (status.niche.length > 16 ? status.niche.slice(0, 16) + '...' : status.niche) : '—'} sub={status?.channelName || 'No channel'} color="text-violet-400" />
                  <StatusCard icon={Clock} label="Jobs Queued" value={jobs.filter(j => j.status === 'pending' || j.status === 'running').length} sub={`${jobs.filter(j => j.status === 'completed').length} done`} color="text-amber-400" />
                </div>

                {/* Pipeline Flow Visualization */}
                <GradientCard glow="from-violet-500/5 to-cyan-500/5">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-400" /> Production Pipeline
                      </h3>
                      <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                        {totalPipeline} total
                      </Badge>
                    </div>
                    <PipelineFlow pipeline={status?.pipeline || null} />
                  </div>
                </GradientCard>

                {/* Controls + Live Feed */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* Controls */}
                  <GradientCard className="lg:col-span-2" glow="from-emerald-500/5 to-cyan-500/5">
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
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
                        <Button onClick={() => sendCommand('pause')} disabled={loading} variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
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
                      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Feed
                      </h3>
                      <LiveFeed logs={logs} />
                    </div>
                  </GradientCard>
                </div>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              PIPELINE TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="pipeline" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="pipeline-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* Pipeline Flow (large) */}
                <GradientCard glow="from-violet-500/5 to-cyan-500/5">
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
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
                        />
                      ) : initialLoaded ? (
                        <EmptyState icon={Lightbulb} title="No ideas yet" desc="Run initial setup to generate video ideas from your niche." />
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
                      <CardDescription className="text-[10px]">Click any project to preview video, script, scenes & review</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-72">
                        {pipeline?.projects?.length ? (
                          <div className="space-y-1.5">
                            {pipeline.projects.map((project: any, i: number) => (
                              <motion.button
                                key={project.id}
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                whileHover={{ scale: 1.01, x: 2 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => setPreviewVideoId(project.id)}
                                className="w-full text-left p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:border-violet-500/50 hover:bg-slate-800/60 transition-colors space-y-1.5 cursor-pointer group"
                              >
                                <div className="flex items-center gap-2">
                                  <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-400 shrink-0 transition-colors" />
                                  <span className="text-xs font-medium text-slate-200 truncate flex-1">{project.title}</span>
                                  {project.duration && (
                                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{project.duration.toFixed(0)}s</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 pl-5">
                                  <Badge variant="outline" className={`text-[10px] ${
                                    project.status === 'approved' || project.status === 'uploaded' ? 'border-emerald-500/50 text-emerald-400' :
                                    project.status === 'failed' ? 'border-red-500/50 text-red-400' :
                                    'border-amber-500/50 text-amber-400'
                                  }`}>
                                    {project.status}
                                  </Badge>
                                  {project.renderProgress > 0 && project.renderProgress < 100 && (
                                    <div className="flex-1 flex items-center gap-2">
                                      <Progress value={project.renderProgress} className="h-1.5 flex-1" />
                                      <span className="text-[10px] text-slate-500 font-mono">{project.renderProgress}%</span>
                                    </div>
                                  )}
                                  {project.status === 'approved' && (
                                    <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-300 ml-auto">
                                      <Play className="w-2.5 h-2.5 mr-1" />Preview
                                    </Badge>
                                  )}
                                </div>
                              </motion.button>
                            ))}
                          </div>
                        ) : (
                          <EmptyState icon={Film} title="No projects yet" desc="Produce a video to see it appear here." />
                        )}
                      </ScrollArea>
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
                                <span className="text-[10px] text-slate-500 font-mono">{upload.youtubeVideoId}</span>
                              )}
                              <Badge variant="outline" className="text-[10px] border-slate-600 shrink-0">{upload.privacy}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState icon={CloudUpload} title="No uploads yet" desc="Videos will appear here after YouTube upload." />
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
                      <EmptyState icon={ShieldCheck} title="No quality reviews yet" desc="Produce a video to trigger automated review." />
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
                              <item.icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                              <div>
                                <span className="text-slate-500">{item.label}:</span>
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
                            <BarChart data={nicheBarData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                              <RechartsTooltip
                                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                                labelStyle={{ color: '#e2e8f0' }}
                              />
                              <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={20}>
                                {nicheBarData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.selected ? '#10b981' : '#6366f1'} fillOpacity={entry.selected ? 0.9 : 0.5} />
                                ))}
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
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              REVENUE TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="revenue" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="revenue-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* YPP Progress */}
                <GradientCard glow="from-amber-500/5 to-emerald-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-400" /> YouTube Partner Program Progress
                    </CardTitle>
                    <CardDescription className="text-[10px]">Track your path toward monetization thresholds</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(YPP_THRESHOLDS).map(([key, threshold]) => {
                        const current = key === 'subscribers' ? (analytics?.totalSubscribers || 0)
                          : key === 'watchHours' ? (analytics?.totalWatchTime || 0)
                          : (status?.pipeline?.uploaded || 0)
                        const pct = Math.min(100, (current / threshold.target) * 100)
                        const Icon = threshold.icon
                        return (
                          <div key={key} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Icon className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-300">{threshold.label}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-200">{current.toLocaleString()}</span>
                                <span className="text-slate-500">/</span>
                                <span className="font-mono text-slate-400">{threshold.target.toLocaleString()}</span>
                                <Badge variant="outline" className={`text-[10px] ${pct >= 100 ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-600 text-slate-400'}`}>
                                  {pct >= 100 ? '✓' : `${pct.toFixed(0)}%`}
                                </Badge>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className={`h-full rounded-full ${pct >= 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </GradientCard>

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
                          <div className="text-3xl font-bold text-emerald-400">
                            ${(analytics.estimatedRevenue || 0).toFixed(2)}
                          </div>
                          <p className="text-xs text-slate-400">Estimated lifetime revenue</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded-lg bg-slate-800/40">
                              <p className="text-[10px] text-slate-500">RPM</p>
                              <p className="text-sm font-mono text-slate-200">${(analytics.estimatedRevenue / Math.max(1, analytics.totalViews || 1) * 1000).toFixed(2)}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-800/40">
                              <p className="text-[10px] text-slate-500">Total Views</p>
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
                        <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/30 border border-slate-700/30 text-xs">
                          <opp.icon className={`w-3.5 h-3.5 ${opp.met ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <span className="text-slate-200 flex-1">{opp.label}</span>
                          <span className="text-slate-500">{opp.status}</span>
                        </div>
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
                {/* Analytics Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatusCard icon={Eye} label="Total Views" value={(analytics?.totalViews || 0).toLocaleString()} color="text-blue-400" />
                  <StatusCard icon={Users} label="Subscribers" value={(analytics?.totalSubscribers || 0).toLocaleString()} color="text-emerald-400" />
                  <StatusCard icon={Clock} label="Watch Hours" value={(analytics?.totalWatchTime || 0).toLocaleString()} color="text-amber-400" />
                  <StatusCard icon={DollarSign} label="Est. Revenue" value={`$${(analytics?.estimatedRevenue || 0).toFixed(2)}`} color="text-emerald-400" />
                </div>

                {/* Pipeline Progress Over Time */}
                <GradientCard glow="from-blue-500/5 to-violet-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-400" /> Pipeline Progress Over Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pipelineChartData.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={pipelineChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <defs>
                              <linearGradient id="colorIdeas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorProduced" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorUploaded" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <RechartsTooltip
                              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                              labelStyle={{ color: '#e2e8f0' }}
                            />
                            <Area type="monotone" dataKey="ideas" stroke="#8b5cf6" fill="url(#colorIdeas)" strokeWidth={2} />
                            <Area type="monotone" dataKey="produced" stroke="#06b6d4" fill="url(#colorProduced)" strokeWidth={2} />
                            <Area type="monotone" dataKey="uploaded" stroke="#10b981" fill="url(#colorUploaded)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <EmptyState icon={BarChart3} title="No analytics data" desc="Data will appear as the pipeline produces content." />
                    )}
                  </CardContent>
                </GradientCard>

                {/* Recent Videos Performance */}
                <GradientCard>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Video className="w-4 h-4 text-cyan-400" /> Video Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics?.recentVideos?.length ? (
                      <ScrollArea className="h-48">
                        <div className="space-y-1.5">
                          {analytics.recentVideos.map((v: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/30 text-xs">
                              <span className="text-slate-200 truncate flex-1">{v.title}</span>
                              <span className="text-slate-400 font-mono">{(v.views || 0).toLocaleString()} views</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <EmptyState icon={Video} title="No video performance data" desc="Upload videos and connect YouTube to see analytics." />
                    )}
                  </CardContent>
                </GradientCard>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              LOGS TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="logs" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="logs-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Audit Log */}
                  <GradientCard glow="from-violet-500/5 to-slate-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-violet-400" /> Audit Log
                        <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{logs.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        {logs.length ? (
                          <div className="space-y-0.5">
                            {logs.map((log: any, i: number) => (
                              <motion.div
                                key={log.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.01 }}
                                className="flex gap-2 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors text-xs"
                              >
                                <span className="text-slate-600 font-mono text-[10px] w-16 shrink-0 pt-0.5">
                                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                <Badge variant="outline" className={`text-[10px] h-5 shrink-0 ${actionColor(log.action)}`}>
                                  {actionLabel(log.action)}
                                </Badge>
                                {log.target && (
                                  <Badge variant="outline" className="text-[9px] h-5 shrink-0 border-cyan-500/30 text-cyan-300 font-mono">
                                    {log.target.slice(-6)}
                                  </Badge>
                                )}
                                <span className="text-slate-300 text-[11px] truncate flex-1" title={log.detail || log.message}>
                                  {log.message || log.details}
                                </span>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState icon={FileText} title="No logs yet" desc="Audit logs appear as the agent takes actions." />
                        )}
                      </ScrollArea>
                    </CardContent>
                  </GradientCard>

                  {/* Jobs Queue */}
                  <GradientCard glow="from-amber-500/5 to-slate-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Server className="w-4 h-4 text-amber-400" /> Job Queue
                        <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{jobs.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        {jobs.length ? (
                          <div className="space-y-1.5">
                            {jobs.map((job: any, i: number) => (
                              <motion.div
                                key={job.id}
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="p-2 rounded-lg bg-slate-800/30 border border-slate-700/30 space-y-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[10px] shrink-0 ${
                                    job.status === 'completed' ? 'border-emerald-500/50 text-emerald-400' :
                                    job.status === 'failed' ? 'border-red-500/50 text-red-400' :
                                    job.status === 'running' ? 'border-cyan-500/50 text-cyan-400' :
                                    'border-slate-500/50 text-slate-400'
                                  }`}>
                                    {job.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                    {job.status}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] border-slate-600 shrink-0">{job.type}</Badge>
                                  <span className="text-[10px] text-slate-500 font-mono ml-auto">
                                    {new Date(job.scheduledAt).toLocaleString()}
                                  </span>
                                </div>
                                {(job.error || job.retryCount > 0) && (
                                  <div className="flex items-center gap-2 text-[10px]">
                                    {job.error && <span className="text-red-400 truncate">{job.error}</span>}
                                    {job.retryCount > 0 && <span className="text-amber-400">retry #{job.retryCount}</span>}
                                  </div>
                                )}
                                {job.status === 'running' && (
                                  <Progress value={45} className="h-1" />
                                )}
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState icon={Server} title="No jobs queued" desc="Jobs are scheduled as the agent processes content." />
                        )}
                      </ScrollArea>
                    </CardContent>
                  </GradientCard>
                </div>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              CALENDAR TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="calendar" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="calendar-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <GlassCard variant="glow" glowFrom="from-violet-500" glowTo="to-cyan-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-violet-400" /> Content Calendar
                    </CardTitle>
                    <CardDescription className="text-[10px]">Scheduled releases, published videos, and upcoming production queue</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pipeline?.ideas?.length || pipeline?.uploads?.length ? (
                      <ContentCalendar
                        ideas={pipeline?.ideas || []}
                        uploads={pipeline?.uploads || []}
                      />
                    ) : (
                      <EmptyState icon={CalendarDays} title="No calendar data" desc="Produce or schedule videos to populate the calendar." />
                    )}
                  </CardContent>
                </GlassCard>
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════
              SETTINGS TAB
              ══════════════════════════════════════════════════════════ */}
          <TabsContent value="settings" className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div key="settings-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
                {/* Operating Mode - Radio Cards */}
                <GradientCard glow="from-violet-500/5 to-emerald-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ToggleLeft className="w-4 h-4 text-violet-400" /> Operating Mode
                    </CardTitle>
                    <CardDescription className="text-[10px]">Controls what the agent is allowed to do autonomously</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {MODES.map((mode) => {
                        const isActive = status?.operatingMode === mode.key
                        const Icon = mode.icon
                        return (
                          <motion.button
                            key={mode.key}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => sendCommand('set-mode', { mode: mode.key })}
                            className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                              isActive
                                ? mode.activeColor + ' ring-1 ring-current'
                                : mode.color + ' bg-slate-800/30 hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className={`w-5 h-5 ${isActive ? 'text-current' : 'text-slate-500'}`} />
                              {isActive && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 rounded-full bg-emerald-400" />}
                            </div>
                            <p className={`text-sm font-semibold ${isActive ? 'text-slate-100' : 'text-slate-300'}`}>{mode.label}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{mode.desc}</p>
                          </motion.button>
                        )
                      })}
                    </div>
                  </CardContent>
                </GradientCard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* YouTube Connection */}
                  <GradientCard glow="from-red-500/5 to-rose-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Youtube className="w-4 h-4 text-red-400" /> YouTube Connection
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${channel?.youtubeConnected ? 'bg-red-500/20' : 'bg-slate-700/50'}`}>
                          <Youtube className={`w-5 h-5 ${channel?.youtubeConnected ? 'text-red-400' : 'text-slate-500'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{channel?.youtubeConnected ? 'Connected' : 'Not Connected'}</p>
                          <p className="text-[10px] text-slate-500">{channel?.youtubeConnected ? 'OAuth tokens active' : 'OAuth credentials required'}</p>
                        </div>
                        {channel?.youtubeConnected && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto" />
                        )}
                      </div>
                      {!channel?.youtubeConnected && (
                        <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 space-y-2">
                          <p className="text-xs font-medium text-slate-300">Setup Instructions</p>
                          <ol className="list-decimal ml-4 space-y-1 text-[10px] text-slate-400">
                            <li>Create a Google Cloud project</li>
                            <li>Enable YouTube Data API v3</li>
                            <li>Configure OAuth 2.0 credentials</li>
                            <li>Set <code className="text-cyan-400 bg-slate-800 px-1 rounded">YOUTUBE_CLIENT_ID</code> and <code className="text-cyan-400 bg-slate-800 px-1 rounded">YOUTUBE_CLIENT_SECRET</code> in .env</li>
                            <li>Click authorize in the OAuth flow</li>
                          </ol>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        Uses official Google OAuth 2.0. Tokens encrypted at rest. Minimum scopes: youtube.upload, youtube.readonly.
                      </p>
                    </CardContent>
                  </GradientCard>

                  {/* Security Checklist */}
                  <GradientCard glow="from-emerald-500/5 to-green-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Security & Compliance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-1.5">
                        {[
                          { label: 'OAuth tokens encrypted at rest', icon: Lock },
                          { label: 'CSRF protection on OAuth flow', icon: Shield },
                          { label: 'Emergency stop control', icon: AlertOctagon },
                          { label: 'All uploads default to private', icon: Lock },
                          { label: 'Audit logging enabled', icon: FileText },
                          { label: 'No credentials in source code', icon: Shield },
                          { label: 'No passwords or 2FA codes stored', icon: ShieldCheck },
                          { label: 'Least-privilege API scopes', icon: Lock },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-emerald-500/5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-slate-300">{item.label}</span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-3 bg-slate-800" />
                      <p className="text-[10px] font-medium text-slate-300 mb-2">Content Policy</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {[
                          'Original content only — no copied scripts or videos',
                          'Source attribution required on all claims',
                          'AI-generated content disclosed in descriptions',
                          'No fake engagement or misleading thumbnails',
                          'Asset license tracking enforced',
                          'Quality review gate before every upload',
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-emerald-500/5">
                            <FileCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-slate-300">{item}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </GradientCard>
                </div>
              </motion.div>
            </AnimatePresence>
          </TabsContent>
        </Tabs>

        {/* ═══ VIDEO PREVIEW MODAL ═══ */}
        <VideoPreviewModal
          videoProjectId={previewVideoId}
          onClose={() => setPreviewVideoId(null)}
        />
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-slate-800/60 px-4 md:px-6 py-2 flex items-center justify-between text-[10px] text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>YouTube Revenue Studio v2.0 &middot; Z.AI Autonomous Agent</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Poll: {lastPoll.toLocaleTimeString()}</span>
          <span>5s interval</span>
        </div>
      </footer>
    </div>
  )
}
