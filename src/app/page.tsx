'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Youtube, AlertOctagon, Search, Activity, Layers,
  Target, DollarSign, BarChart3, Handshake, FlaskConical,
  FileText, GitBranch, Settings, CalendarDays, CalendarClock,
  Keyboard, Database, Zap, RefreshCw, Loader2,
} from 'lucide-react'
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
import { VideoPreviewModal } from '@/components/agent/video-preview-modal'
import { CommandPalette } from '@/components/agent/command-palette'
import { NotificationCenter } from '@/components/agent/notification-center'
import { ExportMenu } from '@/components/agent/export-menu'
import { KeyboardShortcuts } from '@/components/agent/keyboard-shortcuts'
import { YouTubeSetupWizard } from '@/components/agent/youtube-setup-wizard'
import { AgentPulseIndicator } from '@/components/agent/agent-pulse'
import { QuickActionsToolbar } from '@/components/agent/quick-actions-toolbar'
import { useToast } from '@/components/agent/toast-provider'

// ── Shared types & helpers ───────────────────────────────────────────
import {
  AgentStatus, PipelineData, ChannelData, AnalyticsData,
  MODES, modeLabel, AgentStateIndicator,
} from '@/components/tabs/shared'

// ── Lazy-loaded tab components ───────────────────────────────────────
const OverviewTab = React.lazy(() =>
  import('@/components/tabs/overview-tab').then(m => ({ default: m.OverviewTab }))
)
const PipelineTab = React.lazy(() =>
  import('@/components/tabs/pipeline-tab').then(m => ({ default: m.PipelineTab }))
)
const StrategyTab = React.lazy(() =>
  import('@/components/tabs/strategy-tab').then(m => ({ default: m.StrategyTab }))
)
const CalendarTab = React.lazy(() =>
  import('@/components/tabs/calendar-tab').then(m => ({ default: m.CalendarTab }))
)
const SchedulerTab = React.lazy(() =>
  import('@/components/tabs/scheduler-tab').then(m => ({ default: m.SchedulerTab }))
)
const RevenueTab = React.lazy(() =>
  import('@/components/tabs/revenue-tab').then(m => ({ default: m.RevenueTab }))
)
const AnalyticsTab = React.lazy(() =>
  import('@/components/tabs/analytics-tab').then(m => ({ default: m.AnalyticsTab }))
)
const OpportunitiesTab = React.lazy(() =>
  import('@/components/tabs/opportunities-tab').then(m => ({ default: m.OpportunitiesTab }))
)
const ExperimentsTab = React.lazy(() =>
  import('@/components/tabs/experiments-tab').then(m => ({ default: m.ExperimentsTab }))
)
const LogsTab = React.lazy(() =>
  import('@/components/tabs/logs-tab').then(m => ({ default: m.LogsTab }))
)
const DecisionsTab = React.lazy(() =>
  import('@/components/tabs/decisions-tab').then(m => ({ default: m.DecisionsTab }))
)
const SettingsTab = React.lazy(() =>
  import('@/components/tabs/settings-tab').then(m => ({ default: m.SettingsTab }))
)

// ── Tab loading skeleton ─────────────────────────────────────────────
import { TabLoadingSkeleton } from '@/components/tabs/tab-skeleton'

// ════════════════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [pipeline, setPipeline] = useState<PipelineData | null>(null)
  const [channel, setChannel] = useState<ChannelData | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [lastPoll, setLastPoll] = useState<Date | null>(null)
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
  const { toast, dismiss, update } = useToast()

  // ── YouTube OAuth Callback Handler ────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ytAuth = params.get('youtube_auth')
    if (ytAuth) {
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
    setYtWizardOpen(true)
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

  const handleWizardComplete = async () => {
    setYtWizardOpen(false)
    toast({ type: 'success', title: 'YouTube Connected!', description: 'Your YouTube account is now connected.', duration: 5000 })
    await fetchChannel()
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
    // Pipeline-stage buttons (in pipeline-progress.tsx)
    'niche-research': { label: 'Generate Ideas', success: 'Idea generation started', loading: 'Researching niches & generating ideas…' },
    'research':       { label: 'Research Topic', success: 'Topic research started',   loading: 'Researching the next topic…' },
    'write-script':   { label: 'Write Script',   success: 'Script writing started',   loading: 'Writing the next script…' },
    'produce':        { label: 'Produce Video',  success: 'Video production started', loading: 'Producing the next video…' },
    'review':         { label: 'Quality Review', success: 'Quality review started',   loading: 'Running quality review…' },
    'upload':         { label: 'Upload All',     success: 'Upload started',           loading: 'Uploading approved videos to YouTube…' },
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
        if (loadingId) dismiss(loadingId)
        toast({ type: 'error', title: `${meta?.label || command} failed`, description: errMsg, duration: 5000 })
        return data
      }
      await fetchStatus()
      if (loadingId) {
        update(loadingId, {
          type: 'success',
          title: meta?.success || `${command} command sent`,
          description: data?.message ? String(data.message).slice(0, 120) : undefined,
          duration: 3000,
        })
      }
      return data
    } catch (e: any) {
      if (loadingId) dismiss(loadingId)
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

  const handleUnscheduleIdea = useCallback(async (ideaId: string) => {
    try {
      await fetch('/api/data/ideas/' + ideaId + '/schedule', {
        method: 'DELETE',
      })
      setSchedulerIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, scheduledDate: null, scheduledTime: null } : i))
    } catch {}
  }, [])

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
    return Array.from({ length: 12 }, (_, i) => ({
      time: `${String((i + 1) % 24).padStart(2, '0')}:00`,
      ideas: Math.max(0, (status?.pipeline.ideas || 0) - Math.floor((i * 0.7) % 3)),
      produced: Math.max(0, (status?.pipeline.producing || 0) + (i % 2)),
      uploaded: Math.max(0, (status?.pipeline.uploaded || 0) - Math.floor((i * 0.2) % 2)),
    }))
  }, [status?.pipeline, logs.length])

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
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-800/60 bg-slate-900/60 hover:bg-slate-800/60 hover:border-slate-700/60 text-slate-400 hover:text-slate-200 text-xs transition-colors"
              title="Command Palette (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-700/60 bg-slate-800/80 text-[10px] text-slate-400 font-mono">⌘K</kbd>
            </button>

            <div className="hidden md:block">
              <ExportMenu />
            </div>

            <ThemeToggle />

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

            {/* EMERGENCY STOP */}
            <AlertDialog open={estopDialogOpen} onOpenChange={setEstopDialogOpen}>
              <AlertDialogTrigger asChild>
                <motion.div whileTap={{ scale: 0.95 }} className="inline-block">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      if (status?.emergencyStop) {
                        sendCommand('resume')
                      } else {
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
        <div className="h-[1px] bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="flex-1 p-3 md:p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          {/* ── Tab Bar ── */}
          <TabsList className="mb-4 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/90 border border-slate-800/50 backdrop-blur-sm w-full h-auto gap-0.5 p-1 overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/40 [&::-webkit-scrollbar-thumb]:rounded-full relative">
            {[
              { v: 'overview', icon: Activity, label: 'Overview' },
              { v: 'pipeline', icon: Layers, label: 'Pipeline' },
              { v: 'strategy', icon: Target, label: 'Strategy' },
              { v: 'calendar', icon: CalendarDays, label: 'Calendar' },
              { v: 'scheduler', icon: CalendarClock, label: 'Scheduler' },
              { v: 'revenue', icon: DollarSign, label: 'Revenue' },
              { v: 'analytics', icon: BarChart3, label: 'Analytics' },
              { v: 'opportunities', icon: Handshake, label: 'Opportunities' },
              { v: 'experiments', icon: FlaskConical, label: 'Experiments' },
              { v: 'logs', icon: FileText, label: 'Logs' },
              { v: 'decisions', icon: GitBranch, label: 'Decisions' },
              { v: 'settings', icon: Settings, label: 'Settings' },
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
            <button
              onClick={() => setShortcutsOpen(true)}
              className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-md hover:bg-slate-800/50"
              title="Keyboard Shortcuts (Ctrl+/)"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          </TabsList>

          {/* ── Tab Content (all lazy-loaded) ── */}
          <TabsContent value="overview" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <OverviewTab
                status={status}
                pipeline={pipeline}
                channel={channel}
                analytics={analytics}
                jobs={jobs}
                logs={logs}
                loading={loading}
                totalPipeline={totalPipeline}
                selectedNicheScore={selectedNicheScore}
                sendCommand={sendCommand}
                setActiveTab={setActiveTab}
                enableDemoMode={enableDemoMode}
                ytConnecting={ytConnecting}
                setYtWizardOpen={setYtWizardOpen}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <PipelineTab
                status={status}
                pipeline={pipeline}
                initialLoaded={initialLoaded}
                sendCommand={sendCommand}
                setActiveTab={setActiveTab}
                pollAll={pollAll}
                toast={toast}
                setPreviewVideoId={setPreviewVideoId}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="strategy" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <StrategyTab
                status={status}
                channel={channel}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <CalendarTab
                pipeline={pipeline}
                setActiveTab={setActiveTab}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="scheduler" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <SchedulerTab
                schedulerIdeas={schedulerIdeas}
                handleScheduleIdea={handleScheduleIdea}
                handleUnscheduleIdea={handleUnscheduleIdea}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <RevenueTab
                status={status}
                analytics={analytics}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <AnalyticsTab
                analytics={analytics}
                pipeline={pipeline}
                channel={channel}
                pipelineChartData={pipelineChartData}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="opportunities" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <OpportunitiesTab sendCommand={sendCommand} />
            </Suspense>
          </TabsContent>

          <TabsContent value="experiments" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <ExperimentsTab sendCommand={sendCommand} />
            </Suspense>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <LogsTab logs={logs} />
            </Suspense>
          </TabsContent>

          <TabsContent value="decisions" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <DecisionsTab logs={logs} />
            </Suspense>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Suspense fallback={<TabLoadingSkeleton />}>
              <SettingsTab
                status={status}
                channel={channel}
                jobs={jobs}
                sendCommand={sendCommand}
                connectYouTube={connectYouTube}
                enableDemoMode={enableDemoMode}
                disconnectYouTube={disconnectYouTube}
                ytConnecting={ytConnecting}
                ytDisconnecting={ytDisconnecting}
                ytDemoMode={ytDemoMode}
                setYtWizardOpen={setYtWizardOpen}
                pollAll={pollAll}
              />
            </Suspense>
          </TabsContent>
        </Tabs>

        {/* ═══ VIDEO PREVIEW MODAL ═══ */}
        <VideoPreviewModal
          videoProjectId={previewVideoId}
          onClose={() => setPreviewVideoId(null)}
          onStatusChange={pollAll}
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
              {lastPoll ? lastPoll.toLocaleTimeString() : '—'}
            </span>
            <span className="text-slate-700">|</span>
            <span>5s poll</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
