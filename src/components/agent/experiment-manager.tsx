'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  FlaskConical,
  Plus,
  XCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Beaker,
  TestTube2,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────

export type ExperimentType =
  | 'thumbnail'
  | 'title'
  | 'description'
  | 'upload_time'
  | 'format'

export type ExperimentStatus =
  | 'planning'
  | 'running'
  | 'completed'
  | 'cancelled'

export interface Experiment {
  id: string
  title: string
  type: ExperimentType
  hypothesis: string
  status: ExperimentStatus
  startDate: string
  endDate?: string | null
  result?: string | null
  recommendation?: string | null
  resultPositive?: boolean | null
  progress?: number | null
}

export interface ExperimentManagerProps {
  experiments?: Experiment[]
  onCreate?: (exp: Omit<Experiment, 'id'>) => void
  onCancel?: (id: string) => void
  className?: string
}

// ─── Constants ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<ExperimentType, string> = {
  thumbnail: 'Thumbnail',
  title: 'Title',
  description: 'Description',
  upload_time: 'Upload Time',
  format: 'Format',
}

const TYPE_ICONS: Record<ExperimentType, React.ReactNode> = {
  thumbnail: <TestTube2 className="size-4 text-violet-400" />,
  title: <Beaker className="size-4 text-cyan-400" />,
  description: <FlaskConical className="size-4 text-emerald-400" />,
  upload_time: <Clock className="size-4 text-amber-400" />,
  format: <Sparkles className="size-4 text-rose-400" />,
}

const STATUS_CONFIG: Record<ExperimentStatus, { color: string; bg: string; label: string }> = {
  planning: {
    color: 'text-slate-400',
    bg: 'bg-slate-500/15',
    label: 'Planning',
  },
  running: {
    color: 'text-sky-400',
    bg: 'bg-sky-500/15',
    label: 'Running',
  },
  completed: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    label: 'Completed',
  },
  cancelled: {
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    label: 'Cancelled',
  },
}

// ─── Mock Data ───────────────────────────────────────────────────────

const MOCK_EXPERIMENTS: Experiment[] = [
  {
    id: 'exp-1',
    title: 'Thumbnail Style: Minimal vs Bold',
    type: 'thumbnail',
    hypothesis: 'Bold, high-contrast thumbnails with large text will increase CTR by 15%+ compared to minimal clean designs',
    status: 'running',
    startDate: '2025-01-15',
    endDate: null,
    result: null,
    recommendation: null,
    resultPositive: null,
    progress: 62,
  },
  {
    id: 'exp-2',
    title: 'Upload Time: Morning vs Evening',
    type: 'upload_time',
    hypothesis: 'Publishing at 7am EST will generate 20% more initial views than 7pm EST for AI/tech audience',
    status: 'completed',
    startDate: '2025-01-01',
    endDate: '2025-01-14',
    result: '+24% more views at 7am EST (avg 1,847 vs 1,490)',
    recommendation: 'Switch to morning uploads for this audience segment',
    resultPositive: true,
    progress: 100,
  },
  {
    id: 'exp-3',
    title: 'Title Format: Question vs Statement',
    type: 'title',
    hypothesis: 'Question-form titles ("How does X work?") will outperform statement titles ("X Explained") in click-through rate',
    status: 'completed',
    startDate: '2024-12-20',
    endDate: '2025-01-03',
    result: '-3% CTR on question titles (4.2% vs 4.3%)',
    recommendation: 'Statement titles perform slightly better; keep current format',
    resultPositive: false,
    progress: 100,
  },
  {
    id: 'exp-4',
    title: 'Short vs Long Format Comparison',
    type: 'format',
    hypothesis: 'Short-form videos (<60s) will earn 2x more revenue per view through better retention and ad performance',
    status: 'planning',
    startDate: '2025-02-01',
    endDate: null,
    result: null,
    recommendation: null,
    resultPositive: null,
    progress: 0,
  },
]

// ─── Sub-components ──────────────────────────────────────────────────

function StatusIndicator({ status }: { status: ExperimentStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', config.bg, config.color)}>
      {status === 'running' && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-40" />
          <span className="relative inline-flex size-2 rounded-full bg-sky-400" />
        </span>
      )}
      {status === 'completed' && <CheckCircle2 className="size-3" />}
      {status === 'planning' && <Clock className="size-3" />}
      {status === 'cancelled' && <XCircle className="size-3" />}
      {config.label}
    </span>
  )
}

function ExperimentCard({
  data,
  onCancel,
}: {
  data: Experiment
  onCancel?: (id: string) => void
}) {
  const typeIcon = TYPE_ICONS[data.type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="group"
    >
      <Card className="bg-slate-900/80 border-slate-700/50 transition-colors duration-200 hover:border-slate-600/70">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-slate-800/80">
                {typeIcon}
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm text-slate-200 truncate">{data.title}</CardTitle>
                <CardDescription className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-slate-700/50 text-slate-400">
                    {TYPE_LABELS[data.type]}
                  </Badge>
                  <span className="text-slate-500">{data.startDate}</span>
                </CardDescription>
              </div>
            </div>
            <StatusIndicator status={data.status} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Hypothesis */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400">Hypothesis</span>
              <p className="text-xs text-slate-300 leading-relaxed">{data.hypothesis}</p>
            </div>

            {/* Running: Progress */}
            {data.status === 'running' && data.progress != null && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Progress</span>
                  <span className="text-sky-400 font-medium">{data.progress}%</span>
                </div>
                <Progress
                  value={data.progress}
                  className="h-1.5 bg-slate-800/60 [&>[data-slot=progress-indicator]]:bg-sky-500"
                />
              </div>
            )}

            {/* Completed: Results & Recommendation */}
            {data.status === 'completed' && data.result && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-400">Result</span>
                  <div className={cn(
                    'flex items-start gap-2 rounded-md px-2.5 py-2 text-xs',
                    data.resultPositive
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-red-500/10 text-red-300'
                  )}>
                    {data.resultPositive
                      ? <TrendingUp className="size-3.5 mt-0.5 shrink-0" />
                      : <ArrowRight className="size-3.5 mt-0.5 shrink-0" />
                    }
                    <span>{data.result}</span>
                  </div>
                </div>
                {data.recommendation && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-400">Recommendation</span>
                    <div className="flex items-start gap-2 rounded-md bg-slate-800/40 px-2.5 py-2 text-xs text-slate-300">
                      <Sparkles className="size-3.5 mt-0.5 shrink-0 text-violet-400" />
                      <span>{data.recommendation}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dates */}
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span>Start: {data.startDate}</span>
              {data.endDate && <span>End: {data.endDate}</span>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {data.status === 'running' && onCancel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCancel(data.id)}
                  className="h-7 text-xs border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-500/50 hover:bg-red-500/10 bg-transparent"
                >
                  <XCircle className="size-3 mr-1" />
                  Cancel
                </Button>
              )}
              {data.status === 'planning' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-sky-500/30 text-sky-400 hover:text-sky-300 hover:border-sky-500/50 hover:bg-sky-500/10 bg-transparent"
                >
                  <FlaskConical className="size-3 mr-1" />
                  Start
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────

export function ExperimentManager({
  experiments,
  onCreate,
  onCancel,
  className,
}: ExperimentManagerProps) {
  const allExperiments = experiments ?? MOCK_EXPERIMENTS

  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState<ExperimentType>('thumbnail')
  const [formHypothesis, setFormHypothesis] = useState('')

  const stats = useMemo(() => {
    const running = allExperiments.filter((e) => e.status === 'running').length
    const completed = allExperiments.filter((e) => e.status === 'completed').length
    const positiveResults = allExperiments.filter(
      (e) => e.status === 'completed' && e.resultPositive === true
    ).length
    return { running, completed, positiveResults, total: allExperiments.length }
  }, [allExperiments])

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 },
  }

  const handleCreate = () => {
    if (!formTitle.trim() || !formHypothesis.trim()) return
    onCreate?.({
      title: formTitle.trim(),
      type: formType,
      hypothesis: formHypothesis.trim(),
      status: 'planning',
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      result: null,
      recommendation: null,
      resultPositive: null,
      progress: 0,
    })
    setFormTitle('')
    setFormType('thumbnail')
    setFormHypothesis('')
    setShowForm(false)
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <FlaskConical className="size-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-200">A/B Experiment Manager</h2>
            <p className="text-sm text-slate-400">Optimize your strategy with data-driven experiments</p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setShowForm((prev) => !prev)}
          className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
        >
          <Plus className="size-3.5" />
          Create Experiment
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: <FlaskConical className="size-4 text-slate-400" />, color: 'text-slate-200' },
          { label: 'Running', value: stats.running, icon: <TestTube2 className="size-4 text-sky-400" />, color: 'text-sky-400' },
          { label: 'Completed', value: stats.completed, icon: <CheckCircle2 className="size-4 text-emerald-400" />, color: 'text-emerald-400' },
          { label: 'Positive', value: stats.positiveResults, icon: <TrendingUp className="size-4 text-amber-400" />, color: 'text-amber-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-2.5 rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2"
          >
            {stat.icon}
            <div>
              <div className={cn('text-lg font-semibold leading-none', stat.color)}>{stat.value}</div>
              <div className="text-[10px] text-slate-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Separator className="bg-slate-700/30" />

      {/* Create Form (inline) */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <Card className="bg-slate-900/80 border-emerald-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Beaker className="size-4 text-emerald-400" />
                  <CardTitle className="text-sm text-slate-200">New Experiment</CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-400">
                  Define your hypothesis and test type
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Title</label>
                      <Input
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g., Thumbnail Style A vs B"
                        className="h-8 text-xs bg-slate-800/60 border-slate-700/50 text-slate-200 placeholder:text-slate-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Type</label>
                      <Select value={formType} onValueChange={(v) => setFormType(v as ExperimentType)}>
                        <SelectTrigger className="h-8 text-xs bg-slate-800/60 border-slate-700/50 text-slate-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700/50">
                          {(Object.entries(TYPE_LABELS) as [ExperimentType, string][]).map(([key, label]) => (
                            <SelectItem key={key} value={key} className="text-slate-300">
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400">Hypothesis</label>
                    <Input
                      value={formHypothesis}
                      onChange={(e) => setFormHypothesis(e.target.value)}
                      placeholder="e.g., Bold thumbnails will increase CTR by 15%+"
                      className="h-8 text-xs bg-slate-800/60 border-slate-700/50 text-slate-200 placeholder:text-slate-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleCreate}
                      disabled={!formTitle.trim() || !formHypothesis.trim()}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
                    >
                      <FlaskConical className="size-3 mr-1" />
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowForm(false)}
                      className="h-7 text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Experiment List */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TestTube2 className="size-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-200">Experiments</h3>
          <Badge variant="secondary" className="text-[10px] bg-slate-800/60 text-slate-400 border-slate-700/40">
            {allExperiments.length}
          </Badge>
        </div>

        <AnimatePresence mode="wait">
          {allExperiments.length > 0 ? (
            <motion.div
              key="experiment-list"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2"
            >
              {allExperiments.map((exp) => (
                <motion.div key={exp.id} variants={itemVariants}>
                  <ExperimentCard data={exp} onCancel={onCancel} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="experiment-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/50 py-10 text-center"
            >
              <FlaskConical className="size-8 text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">No experiments yet</p>
              <p className="text-xs text-slate-600 mt-1">Create one to start optimizing</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}
