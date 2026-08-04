'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { TrendingUp, Target, DollarSign, Award } from 'lucide-react'
import { GlassCard } from '@/components/agent/glass-card'
import { Badge } from '@/components/ui/badge'

// ─── Types ─────────────────────────────────────────────────────────
interface RevenueForecastChartProps {
  currentRpm: number
  currentViews: number
  growthRate: number
}

// ─── Milestone markers ─────────────────────────────────────────────
const MILESTONES = [
  { month: 3, label: 'YPP Eligible', amount: 0, color: '#f59e0b' },
  { month: 6, label: 'First $100', amount: 100, color: '#06b6d4' },
  { month: 9, label: '$500/mo', amount: 500, color: '#8b5cf6' },
  { month: 12, label: '$1K/mo', amount: 1000, color: '#10b981' },
]

// ─── Custom Tooltip (outside render) ─────────────────────────────
function ForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900/95 border border-slate-700/60 rounded-lg p-2.5 shadow-xl backdrop-blur-sm">
      <p className="text-xs font-semibold text-slate-300 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[10px]">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400">{entry.name}:</span>
          <span className="font-mono text-slate-200">${entry.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Revenue Forecast Chart ────────────────────────────────────────
export function RevenueForecastChart({
  currentRpm,
  currentViews,
  growthRate,
}: RevenueForecastChartProps) {
  // Build deterministic 12-month forecast data
  const data = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const baseMonthlyRevenue = currentRpm > 0 && currentViews > 0
      ? (currentRpm / 1000) * currentViews
      : 0.50 // Small baseline if no data

    const effectiveGrowth = growthRate > 0 ? growthRate : 0.15 // Default 15% monthly growth
    const targetMonthly = 1000 // Target $1K/mo

    return months.map((month, i) => {
      const projected = baseMonthlyRevenue * Math.pow(1 + effectiveGrowth, i)
      const target = targetMonthly * ((i + 1) / 12) // Linear ramp to target
      return {
        month,
        projected: Math.round(projected * 100) / 100,
        target: Math.round(target * 100) / 100,
      }
    })
  }, [currentRpm, currentViews, growthRate])

  const finalProjected = data[data.length - 1]?.projected ?? 0

  return (
    <GlassCard variant="gradient" glowFrom="from-emerald-500" glowTo="to-cyan-500" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200">12-Month Revenue Forecast</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] h-4 border-emerald-500/30 text-emerald-300">
            <DollarSign className="w-2.5 h-2.5 mr-0.5" />
            {finalProjected.toFixed(0)}/mo projected
          </Badge>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="targetGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <RechartsTooltip content={<ForecastTooltip />} />

            {/* Target line */}
            <Area
              type="monotone"
              dataKey="target"
              name="Target"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#targetGradient)"
            />

            {/* Projected revenue */}
            <Area
              type="monotone"
              dataKey="projected"
              name="Projected"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />

            {/* Milestone markers */}
            {MILESTONES.map((ms) => (
              <ReferenceLine
                key={ms.label}
                x={data[ms.month - 1]?.month}
                stroke={ms.color}
                strokeDasharray="2 2"
                strokeWidth={1}
                label={{
                  value: ms.label,
                  position: 'top',
                  fill: ms.color,
                  fontSize: 9,
                }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Milestone cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        {MILESTONES.map((ms, i) => {
          const reached = data[ms.month - 1] && data[ms.month - 1].projected >= (ms.amount || 1)
          return (
            <motion.div
              key={ms.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                reached
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-slate-800/60 bg-slate-900/30'
              }`}
            >
              <Award className={`w-3.5 h-3.5 ${reached ? 'text-emerald-400' : 'text-slate-600'}`} />
              <div>
                <p className={`text-[10px] font-medium ${reached ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {ms.label}
                </p>
                <p className="text-[9px] text-slate-600">
                  Month {ms.month}
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </GlassCard>
  )
}
