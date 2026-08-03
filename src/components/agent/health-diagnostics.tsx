'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Server,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Brain,
  Mic,
  Image,
  Search,
  PenTool,
  Film,
  Shield,
  Youtube,
  Zap,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

export interface HealthDiagnosticsProps {
  agentState: string
  operatingMode: string
  emergencyStop: boolean
  lastAction: string | null
  youtubeConnected: boolean
  niche: string | null
}

type EngineStatus = 'online' | 'offline' | 'error'

interface EngineModule {
  name: string
  icon: React.ElementType
  status: EngineStatus
  lastActivity: string
  operations: number
  category?: string
}

interface SystemInfo {
  nodeVersion: string
  ffmpegVersion: string
  dbSize: string
  uptime: string
  memoryUsed: string
  memoryTotal: string
  memoryPercent: number
}

// ─── Helpers ───────────────────────────────────────────────────────

function statusColor(status: EngineStatus): string {
  switch (status) {
    case 'online':
      return 'text-emerald-400'
    case 'offline':
      return 'text-slate-500'
    case 'error':
      return 'text-red-400'
  }
}

function statusBg(status: EngineStatus): string {
  switch (status) {
    case 'online':
      return 'bg-emerald-500/15 border-emerald-500/30'
    case 'offline':
      return 'bg-slate-500/10 border-slate-600/30'
    case 'error':
      return 'bg-red-500/15 border-red-500/30'
  }
}

function StatusIcon({ status }: { status: EngineStatus }) {
  switch (status) {
    case 'online':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    case 'offline':
      return <XCircle className="h-3.5 w-3.5 text-slate-500" />
    case 'error':
      return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
  }
}

// ─── Circular Progress ─────────────────────────────────────────────

function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
}: {
  value: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const center = size / 2

  const color = useMemo(() => {
    if (value >= 80) return '#10b981'   // emerald
    if (value >= 50) return '#f59e0b'   // amber
    return '#ef4444'                     // red
  }, [value])

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(100,116,139,0.2)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-bold text-white"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          {Math.round(value)}%
        </motion.span>
        <span className="text-[10px] uppercase tracking-widest text-slate-400">
          Health
        </span>
      </div>
    </div>
  )
}

// ─── Mock Data ─────────────────────────────────────────────────────

function getMockSystemInfo(): SystemInfo {
  return {
    nodeVersion: 'v22.12.0',
    ffmpegVersion: '7.1',
    dbSize: '12.4 MB',
    uptime: '4h 23m 11s',
    memoryUsed: '287 MB',
    memoryTotal: '512 MB',
    memoryPercent: 56,
  }
}

function getMockEngines(youtubeConnected: boolean): EngineModule[] {
  return [
    // Z.AI Provider sub-modules
    { name: 'LLM Chat', icon: Brain, status: 'online', lastActivity: '12s ago', operations: 1847, category: 'Z.AI Provider' },
    { name: 'TTS', icon: Mic, status: 'online', lastActivity: '2m ago', operations: 342, category: 'Z.AI Provider' },
    { name: 'Image Gen', icon: Image, status: 'online', lastActivity: '8m ago', operations: 89, category: 'Z.AI Provider' },
    { name: 'Web Search', icon: Search, status: 'online', lastActivity: '45s ago', operations: 1203, category: 'Z.AI Provider' },
    // Engines
    { name: 'Niche Research', icon: Search, status: 'online', lastActivity: '1h ago', operations: 56, category: 'Engines' },
    { name: 'Strategy', icon: Zap, status: 'online', lastActivity: '15m ago', operations: 124, category: 'Engines' },
    { name: 'Script Writer', icon: PenTool, status: 'online', lastActivity: '30m ago', operations: 87, category: 'Engines' },
    { name: 'Video Renderer', icon: Film, status: 'error', lastActivity: '1h 2m ago', operations: 23, category: 'Engines' },
    { name: 'Quality Review', icon: Shield, status: 'online', lastActivity: '5m ago', operations: 198, category: 'Engines' },
    { name: 'YouTube Client', icon: Youtube, status: youtubeConnected ? 'online' : 'offline', lastActivity: youtubeConnected ? '3m ago' : 'Never', operations: youtubeConnected ? 45 : 0, category: 'Integrations' },
    { name: 'Job Queue', icon: Database, status: 'online', lastActivity: '2s ago', operations: 3421, category: 'Integrations' },
  ]
}

// ─── Component ─────────────────────────────────────────────────────

export function HealthDiagnostics({
  agentState,
  operatingMode,
  emergencyStop,
  lastAction,
  youtubeConnected,
  niche,
}: HealthDiagnosticsProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [systemInfo] = useState<SystemInfo>(getMockSystemInfo)
  const engines = useMemo(() => getMockEngines(youtubeConnected), [youtubeConnected])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1)
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  const onlineCount = engines.filter((e) => e.status === 'online').length
  const healthScore = (onlineCount / engines.length) * 100

  // Group engines by category
  const categories = useMemo(() => {
    const map = new Map<string, EngineModule[]>()
    for (const engine of engines) {
      const cat = engine.category ?? 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(engine)
    }
    return map
  }, [engines])

  const categoryIcons: Record<string, React.ElementType> = {
    'Z.AI Provider': Wifi,
    'Engines': Cpu,
    'Integrations': Server,
  }

  return (
    <div className="space-y-4">
      {/* ── Header Row: Health Score + System Info ── */}
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        {/* Health Score */}
        <Card className="border-slate-800/60 bg-slate-950/70 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <CircularProgress value={healthScore} size={130} strokeWidth={9} />
            <div className="mt-3 flex items-center gap-2">
              {emergencyStop ? (
                <Badge className="border-red-500/40 bg-red-500/15 text-red-400">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  EMERGENCY STOP
                </Badge>
              ) : (
                <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <Activity className="mr-1 h-3 w-3" />
                  {agentState.toUpperCase()}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Mode: <span className="text-slate-300">{operatingMode}</span>
            </p>
            {niche && (
              <p className="mt-1 text-xs text-slate-500">
                Niche: <span className="text-slate-300">{niche}</span>
              </p>
            )}
            {lastAction && (
              <p className="mt-1 text-[10px] text-slate-600">
                Last: {lastAction}
              </p>
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="border-slate-800/60 bg-slate-950/70 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
              <Server className="h-4 w-4 text-slate-400" />
              System Information
              <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} />
                Auto-refresh
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoTile icon={Cpu} label="Node.js" value={systemInfo.nodeVersion} />
              <InfoTile icon={Film} label="FFmpeg" value={systemInfo.ffmpegVersion} />
              <InfoTile icon={Database} label="DB Size" value={systemInfo.dbSize} />
              <InfoTile icon={Clock} label="Uptime" value={systemInfo.uptime} />
              <InfoTile
                icon={HardDrive}
                label="Memory"
                value={`${systemInfo.memoryUsed} / ${systemInfo.memoryTotal}`}
                sub={
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <motion.div
                      className="h-full rounded-full bg-violet-500/70"
                      initial={{ width: 0 }}
                      animate={{ width: `${systemInfo.memoryPercent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                }
              />
              <InfoTile
                icon={youtubeConnected ? Wifi : WifiOff}
                label="YouTube"
                value={youtubeConnected ? 'Connected' : 'Disconnected'}
                valueClass={youtubeConnected ? 'text-emerald-400' : 'text-red-400'}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Engine Status Sections ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={refreshKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-3"
        >
          {Array.from(categories.entries()).map(([category, modules]) => {
            const CatIcon = categoryIcons[category] ?? Server
            const catOnline = modules.filter((m) => m.status === 'online').length
            return (
              <Card
                key={category}
                className="border-slate-800/60 bg-slate-950/70 backdrop-blur-sm"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
                    <CatIcon className="h-4 w-4 text-slate-400" />
                    {category}
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-2 text-[10px]',
                        catOnline === modules.length
                          ? 'border-emerald-500/30 text-emerald-400'
                          : catOnline === 0
                            ? 'border-red-500/30 text-red-400'
                            : 'border-amber-500/30 text-amber-400'
                      )}
                    >
                      {catOnline}/{modules.length} online
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="max-h-64">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {modules.map((engine) => (
                        <EngineCard key={engine.name} engine={engine} />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Sub-Components ────────────────────────────────────────────────

function InfoTile({
  icon: Icon,
  label,
  value,
  valueClass,
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClass?: string
  sub?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-800/50 bg-slate-900/50 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={cn('mt-1 text-sm font-medium text-slate-200', valueClass)}>
        {value}
      </p>
      {sub}
    </div>
  )
}

function EngineCard({ engine }: { engine: EngineModule }) {
  const Icon = engine.icon
  const isActive = engine.status === 'online'

  return (
    <motion.div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-2.5',
        statusBg(engine.status)
      )}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15 }}
    >
      {/* Icon with pulse for active engines */}
      <div className="relative">
        <Icon className={cn('h-4 w-4', statusColor(engine.status))} />
        {isActive && (
          <motion.div
            className="absolute -inset-1 rounded-full bg-emerald-400/20"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-slate-200">
            {engine.name}
          </span>
          <StatusIcon status={engine.status} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {engine.lastActivity}
          </span>
          <span>·</span>
          <span>{engine.operations.toLocaleString()} ops</span>
        </div>
      </div>
    </motion.div>
  )
}
