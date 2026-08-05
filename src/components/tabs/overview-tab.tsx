'use client'

import React, { Suspense, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Youtube, Zap, Video, Brain, Clock, Loader2,
  Sparkles, Target, Lightbulb, Search, PenTool,
  Clapperboard, CloudUpload, CheckCircle2,
  Flame, Radio, BarChart3, MessageSquare,
  Clock3, TrendingUp, ShieldCheck, CalendarDays,
  GitBranch, Film, AlertTriangle, MousePointerClick,
  ChevronRight, Play, Pause, Rocket, Activity,
} from 'lucide-react'
import { SmartRecommendations } from '@/components/agent/smart-recommendations'
import { PerformanceMetrics } from '@/components/agent/performance-metrics'
import { ChartSkeleton } from '@/components/agent/skeletons'
import {
  fadeVariants, GradientCard, StatusCard, PipelineFlow,
  LiveFeed, EmptyState, QuickStatItem, stateColor,
} from './shared'
import type { AgentStatus, PipelineData, ChannelData, AnalyticsData } from './shared'

// Lazy-load PerformanceMetrics to reduce initial bundle
const LazyPerformanceMetrics = React.lazy(() =>
  Promise.resolve({ default: PerformanceMetrics })
)

interface OverviewTabProps {
  status: AgentStatus | null
  pipeline: PipelineData | null
  channel: ChannelData | null
  analytics: AnalyticsData | null
  jobs: any[]
  logs: any[]
  loading: boolean
  totalPipeline: number
  selectedNicheScore: number | null
  sendCommand: (command: string, extra?: any) => Promise<any>
  setActiveTab: (tab: string) => void
  enableDemoMode: () => Promise<void>
  ytConnecting: boolean
  setYtWizardOpen: (open: boolean) => void
}

export function OverviewTab({
  status, pipeline, channel, analytics, jobs, logs,
  loading, totalPipeline, selectedNicheScore,
  sendCommand, setActiveTab, enableDemoMode, ytConnecting, setYtWizardOpen,
}: OverviewTabProps) {
  return (
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

        {/* Channel Strategy Score */}
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
                      <circle cx="90" cy="90" r="26" fill="#0f172a" stroke="#334155" strokeWidth="1" />
                      <text x="90" y="86" textAnchor="middle" fill={isActive ? '#e2e8f0' : '#64748b'} fontSize="9" fontWeight="bold">
                        {isActive ? cycleStages[activeIndex]?.label.toUpperCase() : 'IDLE'}
                      </text>
                      <text x="90" y="98" textAnchor="middle" fill="#64748b" fontSize="7">
                        {isActive ? 'In Progress' : 'Waiting'}
                      </text>
                    </svg>
                  </div>
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
                    <span className="text-[10px] text-red-300 line-clamp-2">{status.lastError.replace(/Token refresh failed:.*$/i, 'YouTube token expired — reconnect in Settings')}</span>
                  </div>
                )}
              </div>
            </div>
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
              {status?.lastError && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`mt-3 p-2 rounded-lg text-xs flex items-center gap-2 ${
                  status.lastError.includes('YouTube')
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                    : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}>
                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${status.lastError.includes('YouTube') ? 'text-amber-400' : 'text-red-400'}`} />
                  {status.lastError.replace(/Token refresh failed:.*$/i, 'YouTube token expired — reconnect in Settings')}
                </motion.div>
              )}
              {status?.nextAction && (
                <div className="mt-2 text-xs text-emerald-400/70 flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3" /> Next: {status.nextAction}
                </div>
              )}
            </div>
          </GradientCard>

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

        {/* Performance Metrics dashboard — lazy loaded */}
        <Suspense fallback={<ChartSkeleton />}>
          <LazyPerformanceMetrics
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
              const phase = i / 5
              const dayOffset = i - 29
              const d = new Date()
              d.setDate(d.getDate() + dayOffset)
              const dateStr = d.toISOString().slice(0, 10)
              return {
                date: dateStr,
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
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}
