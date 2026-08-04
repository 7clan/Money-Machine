'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Tv,
  Handshake,
  Link2,
  Crown,
  Heart,
  ShoppingBag,
  Lightbulb,
  BarChart3,
  Calculator,
  Sparkles,
  Clock,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

export interface RevenueProjectionsProps {
  totalViews: number
  totalSubscribers: number
  estimatedRevenue: number
  videos: number
}

interface RevenueSource {
  id: string
  icon: React.ElementType
  label: string
  amount: number
  percentage: number
  trend: 'up' | 'down' | 'flat'
  trendValue: string
  color: string
  colorFill: string
}

interface ForecastPoint {
  month: string
  adRevenue: number
  sponsorships: number
  affiliates: number
  total: number
}

interface OptimizationTip {
  icon: React.ElementType
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
}

// ─── Animation Variants ────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function formatCurrencyFull(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── Revenue Breakdown Logic ───────────────────────────────────────

function calculateRevenueBreakdown(
  totalViews: number,
  totalSubscribers: number,
  estimatedRevenue: number,
  videos: number
): { sources: RevenueSource[]; totalAnnual: number; growthRate: number } {
  // If no real data, provide placeholder breakdown
  const hasData = estimatedRevenue > 0 || totalViews > 0

  if (!hasData) {
    return {
      sources: [
        { id: 'ad', icon: Tv, label: 'Ad Revenue', amount: 0, percentage: 60, trend: 'flat', trendValue: '—', color: '#f59e0b', colorFill: 'rgba(245,158,11,0.15)' },
        { id: 'sponsor', icon: Handshake, label: 'Sponsorships', amount: 0, percentage: 20, trend: 'flat', trendValue: '—', color: '#10b981', colorFill: 'rgba(16,185,129,0.15)' },
        { id: 'affiliate', icon: Link2, label: 'Affiliates', amount: 0, percentage: 8, trend: 'flat', trendValue: '—', color: '#06b6d4', colorFill: 'rgba(6,182,212,0.15)' },
        { id: 'members', icon: Crown, label: 'Memberships', amount: 0, percentage: 5, trend: 'flat', trendValue: '—', color: '#8b5cf6', colorFill: 'rgba(139,92,246,0.15)' },
        { id: 'thanks', icon: Heart, label: 'Super Thanks', amount: 0, percentage: 4, trend: 'flat', trendValue: '—', color: '#f43f5e', colorFill: 'rgba(244,63,94,0.15)' },
        { id: 'merch', icon: ShoppingBag, label: 'Merch', amount: 0, percentage: 3, trend: 'flat', trendValue: '—', color: '#ec4899', colorFill: 'rgba(236,72,153,0.15)' },
      ],
      totalAnnual: 0,
      growthRate: 0,
    }
  }

  // Distribute estimated revenue across sources
  const adRevenue = estimatedRevenue * 0.60
  const sponsorships = estimatedRevenue * 0.20
  const affiliates = estimatedRevenue * 0.08
  const memberships = estimatedRevenue * 0.05
  const superThanks = estimatedRevenue * 0.04
  const merch = estimatedRevenue * 0.03

  // Estimate growth rate based on subscriber velocity
  const subVelocity = totalSubscribers > 0 ? Math.min(50, totalSubscribers / Math.max(videos, 1) * 0.5) : 0
  const growthRate = Math.round(5 + subVelocity * 0.8)

  const totalAnnual = estimatedRevenue * 12

  return {
    sources: [
      { id: 'ad', icon: Tv, label: 'Ad Revenue', amount: adRevenue, percentage: 60, trend: 'up', trendValue: `+${growthRate}%`, color: '#f59e0b', colorFill: 'rgba(245,158,11,0.15)' },
      { id: 'sponsor', icon: Handshake, label: 'Sponsorships', amount: sponsorships, percentage: 20, trend: 'up', trendValue: `+${Math.max(1, growthRate - 2)}%`, color: '#10b981', colorFill: 'rgba(16,185,129,0.15)' },
      { id: 'affiliate', icon: Link2, label: 'Affiliates', amount: affiliates, percentage: 8, trend: 'up', trendValue: `+${Math.max(1, growthRate - 5)}%`, color: '#06b6d4', colorFill: 'rgba(6,182,212,0.15)' },
      { id: 'members', icon: Crown, label: 'Memberships', amount: memberships, percentage: 5, trend: totalSubscribers > 1000 ? 'up' : 'flat', trendValue: totalSubscribers > 1000 ? `+${Math.max(1, growthRate - 8)}%` : '—', color: '#8b5cf6', colorFill: 'rgba(139,92,246,0.15)' },
      { id: 'thanks', icon: Heart, label: 'Super Thanks', amount: superThanks, percentage: 4, trend: 'up', trendValue: `+${Math.max(1, growthRate - 10)}%`, color: '#f43f5e', colorFill: 'rgba(244,63,94,0.15)' },
      { id: 'merch', icon: ShoppingBag, label: 'Merch', amount: merch, percentage: 3, trend: totalSubscribers > 5000 ? 'up' : 'down', trendValue: totalSubscribers > 5000 ? `+${Math.max(1, growthRate - 12)}%` : '-2%', color: '#ec4899', colorFill: 'rgba(236,72,153,0.15)' },
    ],
    totalAnnual,
    growthRate,
  }
}

// ─── Forecast Data ─────────────────────────────────────────────────

function generateForecast(estimatedRevenue: number, growthRate: number): ForecastPoint[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthlyBase = estimatedRevenue > 0 ? estimatedRevenue : 100

  return months.map((month, i) => {
    const growthMultiplier = 1 + (growthRate / 100 / 12) * i
    const seasonalFactor = 1 + 0.1 * Math.sin(((i + 3) / 12) * Math.PI * 2)
    const total = monthlyBase * growthMultiplier * seasonalFactor
    return {
      month,
      adRevenue: Math.round(total * 0.6),
      sponsorships: Math.round(total * 0.2),
      affiliates: Math.round(total * 0.08),
      total: Math.round(total),
    }
  })
}

// ─── CPM/RPM Calculator ────────────────────────────────────────────

function calculateCPMRPM(totalViews: number, estimatedRevenue: number) {
  const viewsInThousands = totalViews / 1000
  const cpm = viewsInThousands > 0 ? (estimatedRevenue / viewsInThousands) : 0
  const rpm = cpm * 0.55 // YouTube keeps ~45%
  return { cpm: Math.round(cpm * 100) / 100, rpm: Math.round(rpm * 100) / 100 }
}

// ─── Optimization Tips ─────────────────────────────────────────────

const OPTIMIZATION_TIPS: OptimizationTip[] = [
  {
    icon: BarChart3,
    title: 'Optimize Video SEO',
    description: 'Use keyword-rich titles, detailed descriptions, and custom thumbnails to increase CTR and discoverability.',
    impact: 'high',
  },
  {
    icon: Clock,
    title: 'Increase Watch Time',
    description: 'Create longer, engaging content with strong hooks. Videos 8-15 min typically earn 2x more ad revenue.',
    impact: 'high',
  },
  {
    icon: Handshake,
    title: 'Diversify Revenue Streams',
    description: 'Add affiliate links in descriptions, launch channel memberships, and create merch once you hit 5K subs.',
    impact: 'medium',
  },
  {
    icon: Sparkles,
    title: 'Post Consistently',
    description: 'Channels posting 2+ videos/week see 3x faster subscriber growth. Consistency signals the algorithm.',
    impact: 'medium',
  },
]

// ─── Trend Icon ────────────────────────────────────────────────────

function TrendIndicator({ trend, value }: { trend: 'up' | 'down' | 'flat'; value: string }) {
  if (trend === 'up') return <span className="flex items-center gap-0.5 text-emerald-400 text-[11px]"><TrendingUp className="w-3 h-3" />{value}</span>
  if (trend === 'down') return <span className="flex items-center gap-0.5 text-red-400 text-[11px]"><TrendingDown className="w-3 h-3" />{value}</span>
  return <span className="flex items-center gap-0.5 text-slate-500 text-[11px]"><Minus className="w-3 h-3" />{value}</span>
}

// ─── Custom Tooltip ────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload) return null
  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-300 font-medium mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-slate-400 capitalize">{entry.dataKey.replace(/([A-Z])/g, ' $1').trim()}</span>
          <span className="font-medium tabular-nums" style={{ color: entry.color }}>
            ${entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────

function EmptyProjectionState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 150 }}
        className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4"
      >
        <DollarSign className="w-7 h-7 text-amber-400" />
      </motion.div>
      <h4 className="text-sm font-semibold text-slate-200">Revenue Projections</h4>
      <p className="text-xs text-slate-400 mt-1.5 max-w-[260px] leading-relaxed">
        Start publishing videos and collecting analytics to see revenue projections and forecasts here.
      </p>
      <div className="flex items-center gap-2 mt-4">
        {['Ad Revenue', 'Sponsorships', 'Affiliates'].map((label) => (
          <Badge key={label} variant="outline" className="text-[10px] bg-slate-800/50 text-slate-400 border-slate-700/40">
            {label}
          </Badge>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────

export function RevenueProjections({
  totalViews,
  totalSubscribers,
  estimatedRevenue,
  videos,
}: RevenueProjectionsProps) {
  const hasData = estimatedRevenue > 0 || totalViews > 0

  const { sources, totalAnnual, growthRate } = useMemo(
    () => calculateRevenueBreakdown(totalViews, totalSubscribers, estimatedRevenue, videos),
    [totalViews, totalSubscribers, estimatedRevenue, videos]
  )

  const forecast = useMemo(
    () => generateForecast(estimatedRevenue, growthRate),
    [estimatedRevenue, growthRate]
  )

  const { cpm, rpm } = useMemo(
    () => calculateCPMRPM(totalViews, estimatedRevenue),
    [totalViews, estimatedRevenue]
  )

  if (!hasData) {
    return (
      <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            Revenue Projections
          </CardTitle>
          <CardDescription className="text-slate-400">
            Forecasted earnings &amp; revenue breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyProjectionState />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              Revenue Projections
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              Forecasted earnings &amp; revenue breakdown
            </CardDescription>
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 150 }}
            className="flex flex-col items-end"
          >
            <span className="text-2xl font-bold text-amber-400 tabular-nums">
              {formatCurrencyFull(totalAnnual)}
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              +{growthRate}% projected annual growth
            </span>
          </motion.div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Forecast Chart */}
          <motion.div variants={itemVariants} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                12-Month Revenue Forecast
              </h4>
              <Badge variant="outline" className="text-[10px] bg-slate-800/50 text-slate-400 border-slate-700/40">
                Monthly
              </Badge>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSponsor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAffiliate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
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
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="adRevenue"
                    name="Ad Revenue"
                    stroke="#f59e0b"
                    fill="url(#gradAd)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="sponsorships"
                    name="Sponsorships"
                    stroke="#10b981"
                    fill="url(#gradSponsor)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="affiliates"
                    name="Affiliates"
                    stroke="#06b6d4"
                    fill="url(#gradAffiliate)"
                    strokeWidth={1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <Separator className="my-4 bg-slate-700/40" />

          {/* Revenue Breakdown by Source */}
          <motion.div variants={itemVariants}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Revenue by Source
            </h4>
            <ScrollArea className="max-h-72">
              <div className="space-y-1">
                {sources.map((source) => {
                  const SourceIcon = source.icon
                  return (
                    <motion.div
                      key={source.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-800/30 transition-colors"
                    >
                      <div
                        className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                        style={{ backgroundColor: source.colorFill }}
                      >
                        <SourceIcon className="w-4 h-4" style={{ color: source.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-200 font-medium">{source.label}</span>
                          <span className="text-sm text-slate-300 tabular-nums font-semibold">
                            {formatCurrency(source.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center gap-2">
                            {/* Mini progress bar */}
                            <div className="w-16 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${source.percentage}%`, backgroundColor: source.color }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-500">{source.percentage}%</span>
                          </div>
                          <TrendIndicator trend={source.trend} value={source.trendValue} />
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </ScrollArea>
          </motion.div>

          <Separator className="my-4 bg-slate-700/40" />

          {/* CPM / RPM Calculator */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                CPM / RPM Estimates
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">CPM</p>
                <p className="text-xl font-bold text-amber-400 tabular-nums">${cpm.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Cost per 1K impressions</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">RPM</p>
                <p className="text-xl font-bold text-emerald-400 tabular-nums">${rpm.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Revenue per 1K views</p>
              </div>
            </div>
            {totalViews > 0 && (
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Based on {totalViews.toLocaleString()} total views and {formatCurrencyFull(estimatedRevenue)} estimated revenue.
                YouTube retains ~45% of ad revenue; RPM reflects your share.
              </p>
            )}
          </motion.div>

          <Separator className="my-4 bg-slate-700/40" />

          {/* Optimization Tips */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Revenue Optimization Tips
              </h4>
            </div>
            <div className="space-y-2.5">
              {OPTIMIZATION_TIPS.map((tip, i) => {
                const TipIcon = tip.icon
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.35 }}
                    className="flex gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/20 hover:border-slate-700/40 transition-colors"
                  >
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
                      tip.impact === 'high' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700/30 text-slate-400'
                    )}>
                      <TipIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200 font-medium">{tip.title}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] px-1 py-0',
                            tip.impact === 'high'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                              : 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                          )}
                        >
                          {tip.impact === 'high' ? 'High Impact' : 'Medium Impact'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {tip.description}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      </CardContent>
    </Card>
  )
}
