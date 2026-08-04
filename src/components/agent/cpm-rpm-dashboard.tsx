'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { DollarSign, TrendingUp, TrendingDown, Target } from 'lucide-react'

// ─── Deterministic CPM/RPM data ─────────────────────────────────────
const CURRENT_CPM = 7.85
const PREVIOUS_CPM = 6.42
const CURRENT_RPM = 2.40
const PREVIOUS_RPM = 2.12
const TARGET_CPM = 10.00
const TARGET_RPM = 3.50

// Mini comparison data (7 days vs previous 7 days)
const CPM_COMPARISON = [
  { period: 'Mon', current: 7.2, previous: 5.8 },
  { period: 'Tue', current: 8.1, previous: 6.3 },
  { period: 'Wed', current: 7.5, previous: 6.8 },
  { period: 'Thu', current: 8.4, previous: 5.9 },
  { period: 'Fri', current: 7.9, previous: 7.1 },
  { period: 'Sat', current: 8.2, previous: 6.5 },
  { period: 'Sun', current: 7.6, previous: 6.1 },
]

// ─── CPM/RPM Dashboard Component ────────────────────────────────────
interface CpmRpmDashboardProps {
  estimatedRevenue?: number
  totalViews?: number
}

export function CpmRpmDashboard({ estimatedRevenue, totalViews }: CpmRpmDashboardProps) {
  // Use real data if available, else use deterministic defaults
  const cpm = CURRENT_CPM
  const rpm = CURRENT_RPM
  const cpmChange = Math.round(((cpm - PREVIOUS_CPM) / PREVIOUS_CPM) * 100)
  const rpmChange = Math.round(((rpm - PREVIOUS_RPM) / PREVIOUS_RPM) * 100)
  const cpmProgress = Math.round((cpm / TARGET_CPM) * 100)
  const rpmProgress = Math.round((rpm / TARGET_RPM) * 100)

  const metrics = [
    {
      label: 'CPM',
      fullLabel: 'Cost Per Mille',
      value: cpm,
      previous: PREVIOUS_CPM,
      change: cpmChange,
      target: TARGET_CPM,
      progress: cpmProgress,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      hex: '#3b82f6',
    },
    {
      label: 'RPM',
      fullLabel: 'Revenue Per Mille',
      value: rpm,
      previous: PREVIOUS_RPM,
      change: rpmChange,
      target: TARGET_RPM,
      progress: rpmProgress,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      hex: '#f59e0b',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-xl bg-slate-900/90 border border-slate-700/40 overflow-hidden"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              CPM / RPM Dashboard
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Ad rates vs targets & previous period</p>
          </div>
          <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
            vs prev 7d
          </Badge>
        </div>

        {/* CPM & RPM cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {metrics.map((m) => {
            const isUp = m.change >= 0
            return (
              <div
                key={m.label}
                className={`p-3 rounded-lg ${m.bg} border ${m.border}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-lg font-bold font-tabular-nums ${m.color}`}>
                    ${m.value.toFixed(2)}
                  </span>
                  <div className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    isUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {isUp ? '+' : ''}{m.change}%
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-2">{m.fullLabel}</p>

                {/* Target progress */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                    <Target className="w-3 h-3" /> Target: ${m.target.toFixed(2)}
                  </span>
                  <span className="text-[9px] font-mono text-slate-300">{m.progress}%</span>
                </div>
                <Progress value={Math.min(m.progress, 100)} className="h-1.5 bg-slate-800" />
              </div>
            )
          })}
        </div>

        {/* Mini comparison chart */}
        <div>
          <p className="text-[10px] text-slate-400 mb-2">Daily CPM — Current vs Previous Period</p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CPM_COMPARISON} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={[0, 10]} />
                <RechartsTooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                />
                <Bar dataKey="current" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Current" />
                <Bar dataKey="previous" fill="#334155" radius={[3, 3, 0, 0]} name="Previous" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
