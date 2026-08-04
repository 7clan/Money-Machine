'use client'

import * as React from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  Activity,
  Gauge as GaugeIcon,
  HardDrive,
  CheckCircle2,
  Zap,
  Clock,
  Minus,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  ChevronUp,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────

export interface DailyProduction {
  date: string // ISO date
  approved: number
  failed: number
  inReview: number
}

export interface NicheMetric {
  id: string
  name: string
  compositeScore: number
  videosProduced: number
  avgQuality: number // 0-100
  revenuePotential: number // 0-100
}

export interface HeatmapBucket {
  day: number // 0-6 (Sun-Sat)
  hourBucket: number // 0-5
  avgVideos: number
}

export interface PerformanceMetricsProps {
  kpis?: {
    pipelineVelocity: { current: number; target: number; sparkline: number[] }
    avgProductionTime: { minutes: number; trend: number; sparkline: number[] } // trend = % change
    qualityPassRate: { rate: number; trend: number; sparkline: number[] }
    storageUsed: { mb: number; capMb: number; sparkline: number[] }
  }
  productionTrend?: DailyProduction[]
  nicheMetrics?: NicheMetric[]
  efficiency?: { approved: number; total: number; target: number }
  heatmap?: HeatmapBucket[]
  className?: string
  isLoading?: boolean
}

// ─── Color Tokens ─────────────────────────────────────────────────
// Accent palette strictly restricted to violet/cyan/emerald/amber/rose.
// NO indigo, NO blue primary anywhere.

const ACCENT = {
  violet: { hex: '#8b5cf6', text: 'text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20', grad: 'from-violet-500 to-violet-700' },
  cyan: { hex: '#06b6d4', text: 'text-cyan-400', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/20', grad: 'from-cyan-500 to-cyan-700' },
  emerald: { hex: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', grad: 'from-emerald-500 to-emerald-700' },
  amber: { hex: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20', grad: 'from-amber-500 to-amber-700' },
  rose: { hex: '#f43f5e', text: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-500/20', grad: 'from-rose-500 to-rose-700' },
} as const

type AccentKey = keyof typeof ACCENT

// ─── Animation Variants ───────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${Math.round(mb)} MB`
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${Math.round(minutes)}m`
}

function formatISODate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

// ─── Demo Data (used when props are undefined) ────────────────────

type KPIs = NonNullable<PerformanceMetricsProps['kpis']>

function generateDemoKPIs(): KPIs {
  const spark = (base: number, variance: number) =>
    Array.from({ length: 7 }, (_, i) => Math.max(0, Math.round(base + Math.sin(i * 0.9) * variance + (Math.random() - 0.5) * variance)))
  return {
    pipelineVelocity: { current: 3, target: 5, sparkline: spark(3, 1) },
    avgProductionTime: { minutes: 42, trend: -8, sparkline: spark(45, 6) },
    qualityPassRate: { rate: 78, trend: 5, sparkline: spark(76, 4) },
    storageUsed: { mb: 612, capMb: 1024, sparkline: spark(580, 40) },
  }
}

function generateDemoProductionTrend(): DailyProduction[] {
  const out: DailyProduction[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const day = d.getDay()
    // Weekday bias toward more production
    const base = day === 0 || day === 6 ? 1 : 2
    const approved = Math.max(0, base + Math.round(Math.random() * 2 - 0.5))
    const failed = Math.max(0, Math.round(Math.random() * 1.4))
    const inReview = Math.max(0, Math.round(Math.random() * 1.2))
    out.push({
      date: d.toISOString().slice(0, 10),
      approved,
      failed,
      inReview,
    })
  }
  return out
}

function generateDemoNicheMetrics(): NicheMetric[] {
  return [
    { id: 'n1', name: 'AI Tools & Automation', compositeScore: 92, videosProduced: 18, avgQuality: 88, revenuePotential: 95 },
    { id: 'n2', name: 'Personal Finance', compositeScore: 84, videosProduced: 14, avgQuality: 82, revenuePotential: 90 },
    { id: 'n3', name: 'Productivity Systems', compositeScore: 79, videosProduced: 11, avgQuality: 76, revenuePotential: 78 },
    { id: 'n4', name: 'SaaS Reviews', compositeScore: 71, videosProduced: 9, avgQuality: 81, revenuePotential: 65 },
    { id: 'n5', name: 'Indie Maker Stories', compositeScore: 65, videosProduced: 7, avgQuality: 73, revenuePotential: 58 },
  ]
}

function generateDemoEfficiency(): { approved: number; total: number; target: number } {
  return { approved: 42, total: 56, target: 80 }
}

function generateDemoHeatmap(): HeatmapBucket[] {
  const out: HeatmapBucket[] = []
  for (let day = 0; day < 7; day++) {
    for (let bucket = 0; bucket < 6; bucket++) {
      // Bias: more production in 8-12 and 16-20 buckets, weekdays
      const peak = bucket === 2 || bucket === 4 ? 1 : 0
      const weekday = day >= 1 && day <= 5 ? 1 : 0
      const base = peak * 1.5 + weekday * 0.7
      const v = Math.max(0, +(base + (Math.random() - 0.4) * 1.6).toFixed(1))
      out.push({ day, hourBucket: bucket, avgVideos: v })
    }
  }
  return out
}

// ─── Custom Recharts Tooltip ──────────────────────────────────────

interface TooltipPayloadItem {
  value: number
  dataKey: string
  color: string
  name?: string
}

function ProductionTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 text-slate-100 rounded-lg p-3 shadow-xl text-xs min-w-[160px]">
      <p className="text-slate-200 font-medium mb-2">{formatISODate(label || '')}</p>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-400 capitalize">
              <span
                className="inline-block w-2 h-2 rounded-sm"
                style={{ backgroundColor: p.color }}
              />
              {p.name || p.dataKey}
            </span>
            <span className="font-medium tabular-nums" style={{ color: p.color }}>
              {p.value}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-slate-800">
          <span className="text-slate-300 font-medium">Total</span>
          <span className="font-semibold tabular-nums text-slate-100">{total}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Sparkline (KPI mini-chart) ───────────────────────────────────

function Sparkline({
  data,
  color,
  id,
}: {
  data: number[]
  color: AccentKey
  id: string
}) {
  const c = ACCENT[color]
  const chartData = data.map((v, i) => ({ i, v }))
  const gradientId = `spark-grad-${id}-${color}`
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.hex} stopOpacity={0.45} />
              <stop offset="100%" stopColor={c.hex} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={c.hex}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={true}
            animationDuration={650}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Trend Indicator ──────────────────────────────────────────────

function TrendPill({
  trend,
  suffix = '%',
}: {
  trend: number
  suffix?: string
}) {
  if (trend > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400 text-[11px] font-medium">
        <TrendingUp className="w-3 h-3" />
        {Math.abs(trend)}
        {suffix}
      </span>
    )
  }
  if (trend < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-rose-400 text-[11px] font-medium">
        <TrendingDown className="w-3 h-3" />
        {Math.abs(trend)}
        {suffix}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-slate-500 text-[11px] font-medium">
      <Minus className="w-3 h-3" />
      0{suffix}
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────

interface KPICardProps {
  icon: LucideIcon
  accent: AccentKey
  value: string
  subValue?: string
  label: string
  trend?: number
  trendSuffix?: string
  sparkline: number[]
  footer?: React.ReactNode
  index: number
}

function KPICard({
  icon: Icon,
  accent,
  value,
  subValue,
  label,
  trend,
  trendSuffix = '%',
  sparkline,
  footer,
  index,
}: KPICardProps) {
  const c = ACCENT[accent]
  return (
    <motion.div variants={itemVariants} custom={index}>
      <motion.div
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className={cn(
          'group relative rounded-xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm p-4',
          'transition-shadow hover:shadow-lg hover:shadow-slate-950/40',
          'hover:border-slate-700/70'
        )}
      >
        {/* Header: icon + trend */}
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ring-1',
              c.grad,
              c.ring
            )}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          {trend !== undefined && <TrendPill trend={trend} suffix={trendSuffix} />}
        </div>

        {/* Big value */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold text-slate-100 tabular-nums tracking-tight">
            {value}
          </span>
          {subValue && (
            <span className="text-xs text-slate-400 font-medium">{subValue}</span>
          )}
        </div>

        {/* Label */}
        <p className="text-xs text-slate-400 mt-0.5 mb-3">{label}</p>

        {/* Optional footer (e.g. storage progress bar) */}
        {footer && <div className="mb-2">{footer}</div>}

        {/* Sparkline */}
        <Sparkline data={sparkline} color={accent} id={`kpi-${index}`} />
      </motion.div>
    </motion.div>
  )
}

// ─── KPI Grid Section ─────────────────────────────────────────────

function KPIGrid({ kpis }: { kpis: KPIs }) {
  const storagePct = Math.min(100, Math.round((kpis.storageUsed.mb / kpis.storageUsed.capMb) * 100))
  const storageColor: AccentKey = storagePct >= 90 ? 'rose' : storagePct >= 70 ? 'amber' : 'emerald'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Pipeline Velocity */}
      <KPICard
        index={0}
        icon={Zap}
        accent="violet"
        value={`${kpis.pipelineVelocity.current} / ${kpis.pipelineVelocity.target}`}
        label="Pipeline Velocity"
        sparkline={kpis.pipelineVelocity.sparkline}
        footer={
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>videos this week</span>
            <span className="text-violet-400 font-medium">
              {Math.round((kpis.pipelineVelocity.current / kpis.pipelineVelocity.target) * 100)}%
            </span>
          </div>
        }
      />

      {/* Avg Production Time */}
      <KPICard
        index={1}
        icon={Clock}
        accent="cyan"
        value={formatMinutes(kpis.avgProductionTime.minutes)}
        label="Avg Production Time"
        trend={kpis.avgProductionTime.trend}
        trendSuffix="%"
        sparkline={kpis.avgProductionTime.sparkline}
      />

      {/* Quality Pass Rate */}
      <KPICard
        index={2}
        icon={CheckCircle2}
        accent="emerald"
        value={`${kpis.qualityPassRate.rate}%`}
        label="Quality Pass Rate"
        trend={kpis.qualityPassRate.trend}
        trendSuffix="%"
        sparkline={kpis.qualityPassRate.sparkline}
      />

      {/* Storage Used */}
      <KPICard
        index={3}
        icon={HardDrive}
        accent={storageColor}
        value={formatMB(kpis.storageUsed.mb)}
        subValue={`/ ${formatMB(kpis.storageUsed.capMb)}`}
        label="Storage Used"
        sparkline={kpis.storageUsed.sparkline}
        footer={
          <div className="space-y-1">
            <Progress
              value={storagePct}
              className={cn(
                'h-1.5 bg-slate-800/80',
                storageColor === 'rose' && '[&>[data-slot=progress-indicator]]:bg-rose-500',
                storageColor === 'amber' && '[&>[data-slot=progress-indicator]]:bg-amber-500',
                storageColor === 'emerald' && '[&>[data-slot=progress-indicator]]:bg-emerald-500'
              )}
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{storagePct}% of cap</span>
              <span className={cn('font-medium', ACCENT[storageColor].text)}>
                {formatMB(kpis.storageUsed.capMb - kpis.storageUsed.mb)} free
              </span>
            </div>
          </div>
        }
      />
    </div>
  )
}

// ─── Production Trend Chart (30-day stacked bars) ─────────────────

function ProductionTrendChart({ data }: { data: DailyProduction[] }) {
  const chartData = data.map((d) => ({
    date: d.date,
    Approved: d.approved,
    Failed: d.failed,
    InReview: d.inReview,
  }))

  const maxStacked = chartData.reduce(
    (max, d) => Math.max(max, d.Approved + d.Failed + d.InReview),
    0
  )
  const yMax = Math.max(1, maxStacked)

  // Smart ticks: 0, mid, max (rounded up)
  const yMid = Math.ceil(yMax / 2)
  const yTop = yMax
  const ticks = [0, yMid, yTop]

  // X-axis labels every 5 days
  const dayCount = chartData.length

  return (
    <motion.div variants={itemVariants}>
      <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              Production Trend
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Videos produced per day, stacked by review outcome
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="bg-slate-800/60 text-slate-300 border-slate-700/50 text-[10px] font-medium"
          >
            Last 30 days
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <LegendItem color={ACCENT.emerald.hex} label="Approved" />
            <LegendItem color={ACCENT.amber.hex} label="In Review" />
            <LegendItem color={ACCENT.rose.hex} label="Failed" />
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
                barCategoryGap="20%"
              >
                <defs>
                  <linearGradient id="bar-approved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT.emerald.hex} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={ACCENT.emerald.hex} stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="bar-review" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT.amber.hex} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={ACCENT.amber.hex} stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="bar-failed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT.rose.hex} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={ACCENT.rose.hex} stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  strokeOpacity={0.5}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#1e293b' }}
                  interval={4}
                  tickFormatter={(v: string) => formatISODate(v)}
                />
                <YAxis
                  ticks={ticks}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                  domain={[0, yTop]}
                />
                <RechartsTooltip
                  content={<ProductionTrendTooltip />}
                  cursor={{ fill: '#334155', fillOpacity: 0.25 }}
                />
                <Bar
                  dataKey="Approved"
                  stackId="a"
                  fill="url(#bar-approved)"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="InReview"
                  name="In Review"
                  stackId="a"
                  fill="url(#bar-review)"
                  maxBarSize={28}
                />
                <Bar
                  dataKey="Failed"
                  stackId="a"
                  fill="url(#bar-failed)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-[11px] text-slate-400 font-medium">{label}</span>
    </div>
  )
}

// ─── Niche Performance Table (sortable) ───────────────────────────

type SortKey = 'compositeScore' | 'videosProduced' | 'avgQuality' | 'revenuePotential' | 'name'
type SortDir = 'asc' | 'desc'

interface SortHeaderProps {
  label: string
  k: SortKey
  align?: 'left' | 'right' | 'center'
  sortKey: SortKey
  sortDir: SortDir
  onToggle: (k: SortKey) => void
}

function SortHeader({ label, k, align = 'left', sortKey, sortDir, onToggle }: SortHeaderProps) {
  const active = sortKey === k
  return (
    <button
      type="button"
      onClick={() => onToggle(k)}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
        active ? 'text-violet-300' : 'text-slate-400 hover:text-slate-200',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center'
      )}
    >
      {label}
      {active ? (
        sortDir === 'asc' ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ChevronDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  )
}

function NichePerformanceTable({ niches }: { niches: NicheMetric[] }) {
  const [sortKey, setSortKey] = React.useState<SortKey>('compositeScore')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const sorted = React.useMemo(() => {
    const arr = [...niches]
    arr.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      let cmp: number
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else {
        cmp = String(av).localeCompare(String(bv))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [niches, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const scoreColor = (s: number): AccentKey =>
    s >= 80 ? 'emerald' : s >= 60 ? 'amber' : 'rose'

  return (
    <motion.div variants={itemVariants}>
      <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            Niche Performance
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Top {sorted.length} niches ranked by composite score
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800/60 hover:bg-transparent">
                <TableHead className="text-slate-400 w-[40%]">
                  <SortHeader label="Niche" k="name" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </TableHead>
                <TableHead className="text-slate-400">
                  <SortHeader label="Score" k="compositeScore" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </TableHead>
                <TableHead className="text-slate-400 text-right">
                  <SortHeader label="Videos" k="videosProduced" align="right" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </TableHead>
                <TableHead className="text-slate-400 text-right">
                  <SortHeader label="Quality" k="avgQuality" align="right" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </TableHead>
                <TableHead className="text-slate-400 text-right">
                  <SortHeader label="Revenue" k="revenuePotential" align="right" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((n, idx) => {
                const isTop = idx === 0
                const sc = scoreColor(n.compositeScore)
                return (
                  <TableRow
                    key={n.id}
                    className={cn(
                      'border-slate-800/40',
                      isTop && 'bg-violet-500/5 ring-1 ring-inset ring-violet-500/30'
                    )}
                  >
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2">
                        {isTop && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30">
                            <Sparkles className="w-3 h-3" />
                          </span>
                        )}
                        <span
                          className={cn(
                            'text-sm font-medium',
                            isTop ? 'text-violet-200' : 'text-slate-200'
                          )}
                        >
                          {n.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            ACCENT[sc].text
                          )}
                        >
                          {n.compositeScore}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full bg-gradient-to-r',
                              ACCENT[sc].grad
                            )}
                            style={{ width: `${n.compositeScore}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <span className="text-sm text-slate-300 tabular-nums">{n.videosProduced}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <span
                        className={cn(
                          'text-sm tabular-nums font-medium',
                          n.avgQuality >= 80
                            ? 'text-emerald-400'
                            : n.avgQuality >= 60
                              ? 'text-amber-400'
                              : 'text-rose-400'
                        )}
                      >
                        {n.avgQuality}%
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                            style={{ width: `${n.revenuePotential}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-300 tabular-nums w-8 text-right">
                          {n.revenuePotential}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Efficiency Gauge (SVG semicircle + animated needle) ──────────

function EfficiencyGauge({
  approved,
  total,
  target,
}: {
  approved: number
  total: number
  target: number
}) {
  const pct = total > 0 ? Math.round((approved / total) * 100) : 0
  const clamped = Math.max(0, Math.min(100, pct))

  // Color shift: red <40, amber 40-70, emerald >70
  const color: AccentKey = clamped < 40 ? 'rose' : clamped <= 70 ? 'amber' : 'emerald'
  const c = ACCENT[color]

  // Needle rotation: -90deg at 0%, +90deg at 100%
  const needleAngle = -90 + (clamped / 100) * 180

  // Arc geometry: semicircle radius 80, center (100, 100), from (20,100) to (180,100)
  // Background arc (full semicircle, slate)
  // Foreground arc (progress, colored) — drawn with stroke-dasharray
  const radius = 80
  const cx = 100
  const cy = 100
  const semicircleLength = Math.PI * radius // ~251.3

  return (
    <motion.div variants={itemVariants}>
      <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-sm h-full">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <GaugeIcon className="w-4 h-4 text-emerald-400" />
            Agent Efficiency
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Approved videos / total produced
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col items-center">
          <div className="relative w-full max-w-[260px]">
            <svg viewBox="0 0 200 130" className="w-full h-auto" role="img" aria-label={`Efficiency ${pct}%`}>
              <defs>
                <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={ACCENT.rose.hex} />
                  <stop offset="50%" stopColor={ACCENT.amber.hex} />
                  <stop offset="100%" stopColor={ACCENT.emerald.hex} />
                </linearGradient>
              </defs>

              {/* Background track (full semicircle) */}
              <path
                d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                fill="none"
                stroke="#1e293b"
                strokeWidth={14}
                strokeLinecap="round"
              />

              {/* Progress arc (colored by current band, animated draw) */}
              <motion.path
                d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                fill="none"
                stroke={c.hex}
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={semicircleLength}
                initial={{ strokeDashoffset: semicircleLength }}
                animate={{ strokeDashoffset: semicircleLength * (1 - clamped / 100) }}
                transition={{ duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              />

              {/* Tick marks at 0, 25, 50, 75, 100 */}
              {[0, 25, 50, 75, 100].map((tick) => {
                const angle = Math.PI + (tick / 100) * Math.PI // 180° to 360°
                const inner = radius - 18
                const outer = radius - 10
                const x1 = cx + inner * Math.cos(angle)
                const y1 = cy + inner * Math.sin(angle)
                const x2 = cx + outer * Math.cos(angle)
                const y2 = cy + outer * Math.sin(angle)
                return (
                  <line
                    key={tick}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#475569"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                )
              })}

              {/* Tick labels */}
              {[0, 50, 100].map((tick) => {
                const angle = Math.PI + (tick / 100) * Math.PI
                const r = radius + 12
                const x = cx + r * Math.cos(angle)
                const y = cy + r * Math.sin(angle) + 3
                return (
                  <text
                    key={tick}
                    x={x}
                    y={y}
                    fill="#64748b"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {tick}
                  </text>
                )
              })}

              {/* Animated needle */}
              <motion.g
                initial={{ rotate: -90 }}
                animate={{ rotate: needleAngle }}
                transition={{ duration: 1.1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
                style={{ originX: `${cx}px`, originY: `${cy}px` }}
              >
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx}
                  y2={cy - radius + 18}
                  stroke={c.hex}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <circle cx={cx} cy={cy} r={6} fill={c.hex} />
                <circle cx={cx} cy={cy} r={3} fill="#0f172a" />
              </motion.g>
            </svg>

            {/* Centered big % value */}
            <div className="absolute inset-x-0 bottom-1 flex flex-col items-center pointer-events-none">
              <span className={cn('text-3xl font-bold tabular-nums', c.text)}>{pct}%</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">efficiency</span>
            </div>
          </div>

          {/* Below: target line */}
          <div className="w-full mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Target className="w-3 h-3 text-violet-400" />
                Target: {target}%
              </span>
              <span
                className={cn(
                  'font-medium tabular-nums',
                  pct >= target ? 'text-emerald-400' : 'text-amber-400'
                )}
              >
                {pct >= target ? '+' : ''}
                {pct - target}%
              </span>
            </div>
            <Progress
              value={Math.min(100, (pct / target) * 100)}
              className="h-1.5 bg-slate-800/80 [&>[data-slot=progress-indicator]]:bg-violet-500"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>0%</span>
              <span>{approved} of {total} approved</span>
              <span>{target}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Time-of-Day Heatmap ──────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_BUCKET_LABELS = ['0-4', '4-8', '8-12', '12-16', '16-20', '20-24']

function TimeOfDayHeatmap({ buckets }: { buckets: HeatmapBucket[] }) {
  const [hovered, setHovered] = React.useState<{ day: number; bucket: number; value: number } | null>(null)

  // Build lookup map
  const lookup = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const b of buckets) {
      m.set(`${b.day}-${b.hourBucket}`, b.avgVideos)
    }
    return m
  }, [buckets])

  const maxValue = React.useMemo(() => {
    let max = 0
    for (const b of buckets) if (b.avgVideos > max) max = b.avgVideos
    return max || 1
  }, [buckets])

  const getIntensity = (value: number) => {
    if (value <= 0) return 0
    return Math.min(1, value / maxValue)
  }

  const getColor = (value: number): { bg: string; border: string; text: string } => {
    if (value <= 0) {
      return {
        bg: 'transparent',
        border: 'border-dashed border-slate-700/50',
        text: 'text-slate-600',
      }
    }
    const intensity = getIntensity(value)
    // violet-based ramp: low → faint, high → saturated
    const opacity = 0.15 + intensity * 0.7
    return {
      bg: `rgba(139, 92, 246, ${opacity.toFixed(2)})`,
      border: 'border-violet-500/20',
      text: intensity > 0.5 ? 'text-violet-100' : 'text-slate-300',
    }
  }

  return (
    <motion.div variants={itemVariants}>
      <Card className="bg-slate-900/60 border-slate-800/60 backdrop-blur-sm h-full">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Time-of-Day Production
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Historical avg videos per 4-hour bucket
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Heatmap grid */}
          <div className="space-y-1">
            {/* Column headers */}
            <div className="grid grid-cols-[28px_repeat(6,1fr)] gap-1 mb-1">
              <div />
              {HOUR_BUCKET_LABELS.map((h) => (
                <div
                  key={h}
                  className="text-[9px] text-slate-500 font-medium text-center"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {DAY_LABELS.map((dayLabel, dayIdx) => (
              <div
                key={dayLabel}
                className="grid grid-cols-[28px_repeat(6,1fr)] gap-1 items-center"
              >
                <div className="text-[10px] text-slate-500 font-medium pr-1 text-right">
                  {dayLabel}
                </div>
                {HOUR_BUCKET_LABELS.map((_, bucketIdx) => {
                  const value = lookup.get(`${dayIdx}-${bucketIdx}`) ?? 0
                  const color = getColor(value)
                  const isHovered =
                    hovered?.day === dayIdx && hovered?.bucket === bucketIdx
                  return (
                    <div
                      key={`${dayIdx}-${bucketIdx}`}
                      onMouseEnter={() => setHovered({ day: dayIdx, bucket: bucketIdx, value })}
                      onMouseLeave={() => setHovered(null)}
                      className={cn(
                        'relative h-7 rounded-md border text-[10px] flex items-center justify-center cursor-default transition-all',
                        color.border,
                        value > 0 ? color.text : '',
                        isHovered && 'ring-2 ring-violet-400/60 scale-[1.06] z-10'
                      )}
                      style={{
                        backgroundColor: value > 0 ? color.bg : undefined,
                      }}
                      title={`${dayLabel} ${HOUR_BUCKET_LABELS[bucketIdx]}: ${value.toFixed(1)} avg`}
                    >
                      {value > 0 ? value.toFixed(1) : ''}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Hover readout */}
          <div className="mt-3 h-5 flex items-center justify-between text-[11px]">
            {hovered ? (
              <span className="text-slate-300">
                <span className="font-medium text-violet-300">
                  {DAY_LABELS[hovered.day]} {HOUR_BUCKET_LABELS[hovered.bucket]}
                </span>
                : <span className="tabular-nums">{hovered.value.toFixed(1)}</span> avg videos
              </span>
            ) : (
              <span className="text-slate-500">Hover a cell for details</span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Less</span>
              <div className="flex items-center gap-0.5">
                {[0.15, 0.35, 0.55, 0.75, 0.9].map((o) => (
                  <div
                    key={o}
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: `rgba(139, 92, 246, ${o})` }}
                  />
                ))}
              </div>
              <span className="text-slate-500">More</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────

function PerformanceMetricsSkeleton() {
  return (
    <div className="space-y-4">
      {/* KPI skeleton row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 h-[160px]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800/60 animate-pulse" />
              <div className="w-8 h-3 rounded bg-slate-800/60 animate-pulse" />
            </div>
            <div className="h-7 w-20 rounded bg-slate-800/60 animate-pulse mb-2" />
            <div className="h-3 w-16 rounded bg-slate-800/60 animate-pulse mb-3" />
            <div className="h-8 w-full rounded bg-slate-800/40 animate-pulse" />
          </div>
        ))}
      </div>
      {/* Big chart skeleton */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6 h-[340px]">
        <div className="h-4 w-32 rounded bg-slate-800/60 animate-pulse mb-3" />
        <div className="h-[260px] w-full rounded bg-slate-800/30 animate-pulse" />
      </div>
      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6 h-[280px]">
          <div className="h-4 w-28 rounded bg-slate-800/60 animate-pulse mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-full rounded bg-slate-800/30 animate-pulse mb-2" />
          ))}
        </div>
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6 h-[280px]">
          <div className="h-4 w-28 rounded bg-slate-800/60 animate-pulse mb-4" />
          <div className="h-32 w-32 mx-auto rounded-full bg-slate-800/30 animate-pulse mb-4" />
          <div className="h-3 w-full rounded bg-slate-800/30 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────

export function PerformanceMetrics({
  kpis,
  productionTrend,
  nicheMetrics,
  efficiency,
  heatmap,
  className,
  isLoading = false,
}: PerformanceMetricsProps) {
  // Demo-data fallback: when a section prop is undefined, use synthetic data
  // and surface a small "demo data" badge so users know it's not real telemetry.
  const isDemo =
    !kpis || !productionTrend || !nicheMetrics || !efficiency || !heatmap

  const effectiveKpis = kpis ?? generateDemoKPIs()
  const effectiveTrend = productionTrend ?? generateDemoProductionTrend()
  const effectiveNiches = nicheMetrics ?? generateDemoNicheMetrics()
  const effectiveEfficiency = efficiency ?? generateDemoEfficiency()
  const effectiveHeatmap = heatmap ?? generateDemoHeatmap()

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <PerformanceMetricsSkeleton />
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn('space-y-4', className)}
    >
      {/* Header row */}
      <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-600 ring-1 ring-violet-500/30">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Performance Metrics</h3>
            <p className="text-[11px] text-slate-400">
              KPIs, production trends, and efficiency overview
            </p>
          </div>
        </div>
        {isDemo && (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-300 border-amber-500/30 text-[10px] font-medium gap-1"
          >
            <Sparkles className="w-2.5 h-2.5" />
            demo data
          </Badge>
        )}
      </motion.div>

      {/* 1. KPI Grid */}
      <KPIGrid kpis={effectiveKpis} />

      {/* 2. Production Trend (full width) */}
      <ProductionTrendChart data={effectiveTrend} />

      {/* 3. Niche Performance Table (full width) */}
      <NichePerformanceTable niches={effectiveNiches} />

      {/* 4 + 5. Efficiency Gauge + Heatmap side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EfficiencyGauge
          approved={effectiveEfficiency.approved}
          total={effectiveEfficiency.total}
          target={effectiveEfficiency.target}
        />
        <TimeOfDayHeatmap buckets={effectiveHeatmap} />
      </div>
    </motion.div>
  )
}

export default PerformanceMetrics
