'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Eye, Users, DollarSign } from 'lucide-react'

// ─── Deterministic 30-day growth data ───────────────────────────────
function generateGrowthData() {
  const data = []
  for (let i = 0; i < 30; i++) {
    const day = i + 1
    // Deterministic formulas — no Math.random
    const views = Math.round(1200 + day * 85 + Math.sin(day * 0.5) * 200 + day * day * 1.2)
    const subscribers = Math.round(45 + day * 3.8 + Math.cos(day * 0.3) * 8 + day * 0.15)
    const revenue = Math.round((2.4 + day * 0.12 + Math.sin(day * 0.7) * 0.5) * 100) / 100
    data.push({
      day: `Day ${day}`,
      views,
      subscribers,
      revenue,
    })
  }
  return data
}

const GROWTH_DATA = generateGrowthData()

// ─── Growth Trends Chart Component ──────────────────────────────────
interface GrowthTrendsChartProps {
  totalViews?: number
  totalSubscribers?: number
  estimatedRevenue?: number
}

export function GrowthTrendsChart({ totalViews, totalSubscribers, estimatedRevenue }: GrowthTrendsChartProps) {
  // Calculate period-over-period % change (compare last 15 days vs first 15 days)
  const firstHalf = GROWTH_DATA.slice(0, 15)
  const secondHalf = GROWTH_DATA.slice(15)

  const sumViews = (arr: typeof GROWTH_DATA) => arr.reduce((s, d) => s + d.views, 0)
  const sumSubs = (arr: typeof GROWTH_DATA) => arr.reduce((s, d) => s + d.subscribers, 0)
  const sumRevenue = (arr: typeof GROWTH_DATA) => arr.reduce((s, d) => s + d.revenue, 0)

  const viewsChange = firstHalf.length > 0 ? Math.round(((sumViews(secondHalf) - sumViews(firstHalf)) / sumViews(firstHalf)) * 100) : 0
  const subsChange = firstHalf.length > 0 ? Math.round(((sumSubs(secondHalf) - sumSubs(firstHalf)) / sumSubs(firstHalf)) * 100) : 0
  const revenueChange = firstHalf.length > 0 ? Math.round(((sumRevenue(secondHalf) - sumRevenue(firstHalf)) / sumRevenue(firstHalf)) * 100) : 0

  const trendItems = [
    { label: 'Views', change: viewsChange, icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/10', hex: '#3b82f6' },
    { label: 'Subscribers', change: subsChange, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', hex: '#10b981' },
    { label: 'Revenue', change: revenueChange, icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10', hex: '#f59e0b' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl bg-slate-900/90 border border-slate-700/40 overflow-hidden"
    >
      <div className="p-4">
        {/* Header with trend indicators */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Growth Trends
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">30-day views, subscribers & revenue</p>
          </div>
          <div className="flex items-center gap-2">
            {trendItems.map((item) => {
              const Icon = item.icon
              const isUp = item.change >= 0
              return (
                <div key={item.label} className={`flex items-center gap-1 px-2 py-1 rounded-lg ${item.bg} border border-slate-700/20`}>
                  <Icon className={`w-3 h-3 ${item.color}`} />
                  <span className={`text-[10px] font-mono ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isUp ? '+' : ''}{item.change}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Views & Subscribers — Line Chart */}
        <div className="h-52 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={GROWTH_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="viewsLineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 9, fill: '#64748b' }}
                interval={4}
              />
              <YAxis
                yAxisId="views"
                tick={{ fontSize: 9, fill: '#64748b' }}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
              />
              <YAxis
                yAxisId="subs"
                orientation="right"
                tick={{ fontSize: 9, fill: '#64748b' }}
              />
              <RechartsTooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: '#94a3b8' }}
                iconType="line"
              />
              <Line
                yAxisId="views"
                type="monotone"
                dataKey="views"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Views"
              />
              <Line
                yAxisId="subs"
                type="monotone"
                dataKey="subscribers"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Subscribers"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue — Area Chart */}
        <div>
          <p className="text-[10px] text-slate-400 mb-2 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-amber-400" />
            Revenue Growth (30 days)
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={GROWTH_DATA} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  interval={6}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <RechartsTooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f59e0b"
                  fill="url(#revenueAreaGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
