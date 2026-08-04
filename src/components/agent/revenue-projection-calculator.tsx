'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Calculator,
  TrendingUp,
  RefreshCw,
  DollarSign,
  Info,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

interface RevenueProjectionCalculatorProps {
  currentRevenue?: number
  currentViews?: number
  currentSubscribers?: number
  className?: string
}

interface ProjectionPoint {
  month: string
  optimistic: number
  expected: number
  conservative: number
}

interface SliderConfig {
  key: string
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
  formatValue: (v: number) => string
  description: string
}

// ─── Slider Definitions ────────────────────────────────────────────

const SLIDER_CONFIGS: SliderConfig[] = [
  {
    key: 'monthlyGrowthRate',
    label: 'Monthly Growth Rate',
    min: 0,
    max: 30,
    step: 1,
    defaultValue: 15,
    formatValue: (v) => `${v}%`,
    description: 'Expected monthly audience and revenue growth percentage',
  },
  {
    key: 'uploadFrequency',
    label: 'Upload Frequency',
    min: 1,
    max: 30,
    step: 1,
    defaultValue: 4,
    formatValue: (v) => `${v}/mo`,
    description: 'Number of videos published per month',
  },
  {
    key: 'avgRpm',
    label: 'Average RPM',
    min: 0.5,
    max: 15,
    step: 0.1,
    defaultValue: 2.4,
    formatValue: (v) => `$${v.toFixed(2)}`,
    description: 'Revenue per thousand views (your share after YouTube cut)',
  },
  {
    key: 'avgViewsPerVideo',
    label: 'Avg Views/Video',
    min: 100,
    max: 100000,
    step: 100,
    defaultValue: 5000,
    formatValue: (v) => v.toLocaleString(),
    description: 'Average view count per published video',
  },
  {
    key: 'retentionRate',
    label: 'Avg Retention Rate',
    min: 20,
    max: 95,
    step: 1,
    defaultValue: 58,
    formatValue: (v) => `${v}%`,
    description: 'Average audience retention percentage across videos',
  },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ─── Helpers ───────────────────────────────────────────────────────

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  return `$${value.toFixed(0)}`
}

function formatTooltipValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

// ─── Custom Tooltip ────────────────────────────────────────────────

function ProjectionTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload) return null
  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-300 font-medium mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-slate-400 capitalize">{entry.dataKey}</span>
          <span className="font-medium tabular-nums" style={{ color: entry.color }}>
            {formatTooltipValue(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Custom Legend ─────────────────────────────────────────────────

function ProjectionLegend() {
  const items = [
    { label: 'Optimistic', color: '#10b981', dash: 'dashed' },
    { label: 'Expected', color: '#06b6d4', dash: 'solid' },
    { label: 'Conservative', color: '#f59e0b', dash: 'dotted' },
  ]
  return (
    <div className="flex items-center justify-center gap-5 mt-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <svg width="16" height="2" className="inline-block">
            <line
              x1="0" y1="1" x2="16" y2="1"
              stroke={item.color}
              strokeWidth="2"
              strokeDasharray={item.dash === 'dashed' ? '4 2' : item.dash === 'dotted' ? '2 2' : undefined}
            />
          </svg>
          {item.label}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────

export function RevenueProjectionCalculator({
  currentRevenue,
  currentViews,
  currentSubscribers,
  className,
}: RevenueProjectionCalculatorProps) {
  // Slider state
  const [monthlyGrowthRate, setMonthlyGrowthRate] = useState(15)
  const [uploadFrequency, setUploadFrequency] = useState(4)
  const [avgRpm, setAvgRpm] = useState(2.4)
  const [avgViewsPerVideo, setAvgViewsPerVideo] = useState(5000)
  const [retentionRate, setRetentionRate] = useState(58)

  const stateMap: Record<string, number> = {
    monthlyGrowthRate,
    uploadFrequency,
    avgRpm,
    avgViewsPerVideo,
    retentionRate,
  }

  const setterMap: Record<string, (v: number) => void> = {
    monthlyGrowthRate: setMonthlyGrowthRate,
    uploadFrequency: setUploadFrequency,
    avgRpm: setAvgRpm,
    avgViewsPerVideo: setAvgViewsPerVideo,
    retentionRate: setRetentionRate,
  }

  const handleReset = () => {
    SLIDER_CONFIGS.forEach((cfg) => {
      setterMap[cfg.key](cfg.defaultValue)
    })
  }

  // Compute projection data
  const projectionData: ProjectionPoint[] = useMemo(() => {
    const baseRevenue = currentRevenue || 0.01
    const growthRate = monthlyGrowthRate / 100

    return MONTHS.map((month, i) => {
      const optimistic =
        baseRevenue * Math.pow(1 + growthRate + 0.05, i) * uploadFrequency * avgViewsPerVideo * avgRpm / 1000 * (1 + (i % 3) * 0.02)
      const expected =
        baseRevenue * Math.pow(1 + growthRate, i) * uploadFrequency * avgViewsPerVideo * avgRpm / 1000
      const conservative =
        baseRevenue * Math.pow(1 + growthRate - 0.05, i) * uploadFrequency * avgViewsPerVideo * avgRpm / 1000 * (1 - (i % 3) * 0.01)

      return {
        month,
        optimistic: Math.max(0, +optimistic.toFixed(2)),
        expected: Math.max(0, +expected.toFixed(2)),
        conservative: Math.max(0, +conservative.toFixed(2)),
      }
    })
  }, [currentRevenue, monthlyGrowthRate, uploadFrequency, avgRpm, avgViewsPerVideo])

  // Summary metrics
  const { totalExpected, bestCase, breakEvenMonth } = useMemo(() => {
    const totalExp = projectionData.reduce((sum, d) => sum + d.expected, 0)
    const totalOpt = projectionData.reduce((sum, d) => sum + d.optimistic, 0)

    // Break-even: first month where cumulative expected revenue exceeds $1000
    const target = 1000
    let cumulative = 0
    let beMonth: number | null = null
    for (let i = 0; i < projectionData.length; i++) {
      cumulative += projectionData[i].expected
      if (cumulative >= target && beMonth === null) {
        beMonth = i + 1
      }
    }

    return {
      totalExpected: totalExp,
      bestCase: totalOpt,
      breakEvenMonth: beMonth,
    }
  }, [projectionData])

  return (
    <Card className={cn('bg-slate-900/60 border-slate-800 backdrop-blur-sm', className)}>
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Calculator className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Revenue Projection Calculator</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Adjust assumptions to model your growth trajectory</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-slate-400 hover:text-slate-200 h-7 text-[10px] gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Reset
          </Button>
        </div>

        {/* Main Grid: Sliders + Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
          {/* Sliders Section */}
          <div className="space-y-4">
            {SLIDER_CONFIGS.map((cfg) => {
              const value = stateMap[cfg.key]
              return (
                <div key={cfg.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-slate-400">{cfg.label}</label>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono bg-violet-500/10 text-violet-300 border-violet-500/25 px-1.5 py-0"
                    >
                      {cfg.formatValue(value)}
                    </Badge>
                  </div>
                  <Slider
                    min={cfg.min}
                    max={cfg.max}
                    step={cfg.step}
                    value={[value]}
                    onValueChange={(v) => setterMap[cfg.key](v[0])}
                    className={cn(
                      '[&_[role=slider]]:bg-violet-500',
                      '[&_[role=slider]]:border-violet-400',
                      '[&>span]:bg-violet-500/20',
                    )}
                  />
                  <p className="text-[10px] text-slate-600 mt-1">{cfg.description}</p>
                </div>
              )
            })}
          </div>

          {/* Chart Section */}
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="h-64 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradOptimistic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradExpected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradConservative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.12)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(100,116,139,0.2)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatYAxis}
                  />
                  <Tooltip content={<ProjectionTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="optimistic"
                    stroke="#10b981"
                    fill="url(#gradOptimistic)"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                  <Area
                    type="monotone"
                    dataKey="expected"
                    stroke="#06b6d4"
                    fill="url(#gradExpected)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="conservative"
                    stroke="#f59e0b"
                    fill="url(#gradConservative)"
                    strokeWidth={1.5}
                    strokeDasharray="2 2"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Legend */}
            <ProjectionLegend />
          </div>
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30"
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-500">12-Month Revenue</p>
            </div>
            <p className="text-lg font-bold text-cyan-400 tabular-nums">{formatCurrency(totalExpected)}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30"
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Best Case</p>
            </div>
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{formatCurrency(bestCase)}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30"
          >
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Break-even Month</p>
            </div>
            <p className="text-lg font-bold text-amber-400 tabular-nums">
              {breakEvenMonth !== null ? `Month ${breakEvenMonth}` : 'N/A'}
            </p>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
