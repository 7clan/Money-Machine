'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Film, Eye, DollarSign, Globe, Search, Video,
  ExternalLink, Compass, HelpCircle, TrendingUp
} from 'lucide-react'

// ─── Deterministic Data ─────────────────────────────────────────────

// Top performing videos
const TOP_VIDEOS = [
  { title: 'AI Coding Assistants 2025', views: 45200, revenue: 108.48, ctr: 5.2 },
  { title: 'Rust vs Go Performance', views: 32100, revenue: 77.04, ctr: 4.8 },
  { title: 'Zero-Knowledge Proofs Explained', views: 28500, revenue: 68.40, ctr: 6.1 },
  { title: 'Edge Computing Deep Dive', views: 19800, revenue: 47.52, ctr: 3.9 },
  { title: 'WebAssembly in Production', views: 15400, revenue: 36.96, ctr: 4.5 },
  { title: 'Microservices vs Monoliths', views: 12300, revenue: 29.52, ctr: 3.7 },
  { title: 'GraphQL Performance Tips', views: 9800, revenue: 23.52, ctr: 4.1 },
  { title: 'DevOps Automation Guide', views: 7200, revenue: 17.28, ctr: 3.4 },
]

// Traffic source distribution (pie chart)
const TRAFFIC_SOURCES = [
  { name: 'YouTube Search', value: 42, color: '#3b82f6' },
  { name: 'Suggested', value: 28, color: '#8b5cf6' },
  { name: 'External', value: 15, color: '#10b981' },
  { name: 'Browse', value: 10, color: '#f59e0b' },
  { name: 'Direct', value: 5, color: '#64748b' },
]

// Audience retention curve data (deterministic)
const RETENTION_DATA = (() => {
  const data = []
  for (let i = 0; i <= 100; i += 5) {
    // Typical retention curve: high at start, drops, then stabilizes
    const retention = Math.round(
      100 * Math.exp(-0.015 * i) * (1 - 0.3 * (1 - Math.exp(-0.05 * i)))
    )
    data.push({
      time: `${i}%`,
      retention: Math.max(retention, 15),
    })
  }
  return data
})()

// ─── Performance Breakdown Component ────────────────────────────────
interface PerformanceBreakdownProps {
  uploads?: any[]
}

export function PerformanceBreakdown({ uploads }: PerformanceBreakdownProps) {
  return (
    <div className="space-y-4">
      {/* ── Top Performing Videos ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-xl bg-slate-900/90 border border-slate-700/40 overflow-hidden"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2">
              <Film className="w-4 h-4 text-violet-400" />
              Top Performing Videos
            </h3>
            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
              By views
            </Badge>
          </div>

          <ScrollArea className="h-52">
            <div className="space-y-1.5">
              {TOP_VIDEOS.map((video, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30 border border-slate-700/20 text-xs"
                >
                  <span className="text-[10px] font-bold text-slate-400 w-5 text-right shrink-0">
                    #{i + 1}
                  </span>
                  <Film className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-300 truncate flex-1 font-medium">
                    {video.title}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Eye className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-mono text-blue-400">
                      {(video.views / 1000).toFixed(1)}k
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <DollarSign className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] font-mono text-amber-400">
                      ${video.revenue.toFixed(2)}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-emerald-500/30 text-emerald-400 shrink-0">
                    {video.ctr}% CTR
                  </Badge>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </motion.div>

      {/* ── Traffic Source Distribution + Retention ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Traffic Sources Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-xl bg-slate-900/90 border border-slate-700/40 overflow-hidden"
        >
          <div className="p-4">
            <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-emerald-400" />
              Traffic Source Distribution
            </h3>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={TRAFFIC_SOURCES}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {TRAFFIC_SOURCES.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value: number) => [`${value}%`, 'Share']}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, color: '#94a3b8' }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Audience Retention Curve */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="rounded-xl bg-slate-900/90 border border-slate-700/40 overflow-hidden"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-400" />
                Audience Retention
              </h3>
              <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                Avg curve
              </Badge>
            </div>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={RETENTION_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    label={{ value: 'Video Progress', position: 'insideBottom', offset: -2, style: { fontSize: 9, fill: '#64748b' } }}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    tickFormatter={(v: number) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value: number) => [`${value}%`, 'Retention']}
                  />
                  <Area
                    type="monotone"
                    dataKey="retention"
                    stroke="#f43f5e"
                    fill="url(#retentionGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
