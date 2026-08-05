'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts'
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Eye, Users, Clock, DollarSign, BarChart3,
  Globe, Search, Video, ExternalLink, Compass,
  Flame, MousePointerClick, Clock3, ThumbsUp,
  MessageSquare, Film, HelpCircle, Sparkles,
} from 'lucide-react'
import { GrowthTrendsChart } from '@/components/agent/growth-trends-chart'
import { CpmRpmDashboard } from '@/components/agent/cpm-rpm-dashboard'
import { PerformanceBreakdown } from '@/components/agent/performance-breakdown'
import { fadeVariants, StatusCard, GradientCard, EmptyState } from './shared'
import type { PipelineData, ChannelData, AnalyticsData } from './shared'

interface AnalyticsTabProps {
  analytics: AnalyticsData | null
  pipeline: PipelineData | null
  channel: ChannelData | null
  pipelineChartData: { time: string; ideas: number; produced: number; uploaded: number }[]
}

export function AnalyticsTab({ analytics, pipeline, channel, pipelineChartData }: AnalyticsTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="analytics-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatusCard icon={Eye} label="Total Views" value={analytics?.totalViews || 0} color="text-blue-400" trend="up" hint="Cumulative views across all uploaded videos" />
          <StatusCard icon={Users} label="Subscribers" value={analytics?.totalSubscribers || 0} color="text-emerald-400" hint="Total channel subscribers" />
          <StatusCard icon={Clock} label="Watch Hours" value={Math.round((analytics?.totalWatchTime || 0) / 60)} valueSuffix="hrs" color="text-violet-400" hint="Total watch time in hours" />
          <StatusCard icon={DollarSign} label="Est. Revenue" value={`$${(analytics?.estimatedRevenue || 0).toFixed(2)}`} color="text-amber-400" trend={(analytics?.estimatedRevenue || 0) > 0 ? 'up' : undefined} hint="Estimated revenue based on current metrics" />
        </div>
        {/* Growth Trends Chart */}
        <GrowthTrendsChart
          totalViews={analytics?.totalViews}
          totalSubscribers={analytics?.totalSubscribers}
          estimatedRevenue={analytics?.estimatedRevenue}
        />
        {/* CPM/RPM Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <CpmRpmDashboard
            estimatedRevenue={analytics?.estimatedRevenue}
            totalViews={analytics?.totalViews}
          />
          {/* Performance Breakdown */}
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
  )
}
