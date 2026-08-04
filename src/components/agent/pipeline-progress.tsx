'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Lightbulb, Search, PenTool, Clapperboard, MessageSquare,
  CloudUpload, ChevronRight, ArrowRight, Sparkles
} from 'lucide-react'

// ─── Pipeline Stages Config (matching page.tsx) ─────────────────────
const PIPELINE_STAGES = [
  { key: 'ideas', label: 'Ideas', icon: Lightbulb, color: 'from-violet-500 to-purple-600', textColor: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30', hex: '#8b5cf6' },
  { key: 'researched', label: 'Research', icon: Search, color: 'from-blue-500 to-cyan-600', textColor: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', hex: '#3b82f6' },
  { key: 'scripted', label: 'Script', icon: PenTool, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', hex: '#f59e0b' },
  { key: 'producing', label: 'Produce', icon: Clapperboard, color: 'from-emerald-500 to-green-600', textColor: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', hex: '#10b981' },
  { key: 'reviewing', label: 'Review', icon: MessageSquare, color: 'from-rose-500 to-pink-600', textColor: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', hex: '#f43f5e' },
  { key: 'uploaded', label: 'Upload', icon: CloudUpload, color: 'from-cyan-500 to-teal-600', textColor: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', hex: '#06b6d4' },
]

// ─── Quick Action Labels ────────────────────────────────────────────
const QUICK_ACTIONS: Record<string, string> = {
  ideas: 'Generate More',
  researched: 'Research Next',
  scripted: 'Write Script',
  producing: 'Start Production',
  reviewing: 'Start Review',
  uploaded: 'Upload All',
}

// ─── Sample recent items (deterministic) ────────────────────────────
const SAMPLE_ITEMS: Record<string, Array<{ title: string; status: string }>> = {
  ideas: [
    { title: 'AI Coding Assistants 2025', status: 'new' },
    { title: 'Rust vs Go Performance', status: 'new' },
    { title: 'Zero-Knowledge Proofs', status: 'new' },
  ],
  researched: [
    { title: 'AI Coding Assistants 2025', status: 'complete' },
    { title: 'Rust vs Go Performance', status: 'complete' },
    { title: 'Edge Computing Trends', status: 'in-progress' },
  ],
  scripted: [
    { title: 'AI Coding Assistants 2025', status: 'draft' },
    { title: 'Rust vs Go Performance', status: 'review' },
    { title: 'WebAssembly Deep Dive', status: 'final' },
  ],
  producing: [
    { title: 'AI Coding Assistants 2025', status: 'rendering' },
    { title: 'Rust vs Go Performance', status: 'queued' },
    { title: 'Edge Computing Trends', status: 'rendering' },
  ],
  reviewing: [
    { title: 'AI Coding Assistants 2025', status: 'pending' },
    { title: 'Rust vs Go Performance', status: 'passed' },
    { title: 'WebAssembly Deep Dive', status: 'failed' },
  ],
  uploaded: [
    { title: 'AI Coding Assistants 2025', status: 'published' },
    { title: 'Rust vs Go Performance', status: 'private' },
    { title: 'Edge Computing Trends', status: 'scheduled' },
  ],
}

// ─── Types ──────────────────────────────────────────────────────────
interface PipelineCounts {
  ideas: number
  researched: number
  scripted: number
  producing: number
  reviewing: number
  uploaded: number
}

interface PipelineProgressProps {
  pipelineCounts: PipelineCounts
  onAction?: (stageKey: string) => void
}

// ─── PipelineProgress Component ─────────────────────────────────────
export function PipelineProgress({ pipelineCounts, onAction }: PipelineProgressProps) {
  const counts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: pipelineCounts[stage.key as keyof PipelineCounts] || 0,
  }))

  const total = counts.reduce((sum, s) => sum + s.count, 0)

  // Calculate conversion rates between adjacent stages
  const conversionRates = counts.map((stage, i) => {
    if (i === 0) return 100
    const prev = counts[i - 1].count
    if (prev === 0) return 0
    return Math.round((stage.count / prev) * 100)
  })

  return (
    <div className="space-y-4">
      {/* ── Funnel Progress Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl bg-slate-900/90 border border-slate-700/40 overflow-hidden"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold tracking-tight text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Pipeline Funnel
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">{total} total items</span>
          </div>

          {/* Horizontal funnel bar */}
          <div className="flex h-8 rounded-lg overflow-hidden border border-slate-700/30">
            {counts.map((stage, i) => {
              const widthPct = total > 0 ? (stage.count / total) * 100 : (100 / counts.length)
              return (
                <motion.div
                  key={stage.key}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(widthPct, 2)}%` }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: 'easeOut' }}
                  className={`bg-gradient-to-r ${stage.color} flex items-center justify-center relative group/stage`}
                  title={`${stage.label}: ${stage.count}`}
                >
                  {widthPct > 8 && (
                    <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                      {stage.count}
                    </span>
                  )}
                  {/* Tooltip on hover */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-[10px] text-slate-300 opacity-0 group-hover/stage:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {stage.label}: {stage.count}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Stage labels under the bar */}
          <div className="flex mt-2">
            {counts.map((stage, i) => {
              const widthPct = total > 0 ? (stage.count / total) * 100 : (100 / counts.length)
              const Icon = stage.icon
              return (
                <motion.div
                  key={stage.key}
                  style={{ width: `${Math.max(widthPct, 2)}%` }}
                  className="flex flex-col items-center"
                >
                  <Icon className={`w-3 h-3 ${stage.textColor} mb-0.5`} />
                  <span className="text-[9px] text-slate-400 truncate">{stage.label}</span>
                </motion.div>
              )
            })}
          </div>

          {/* Conversion rates row */}
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {counts.slice(1).map((stage, i) => (
              <React.Fragment key={`conv-${stage.key}`}>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/50 border border-slate-700/30">
                  <span className="text-[10px] text-slate-400">{counts[i].label}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="text-[10px] text-slate-400">{stage.label}</span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] h-4 px-1 ${
                      conversionRates[i + 1] >= 70
                        ? 'border-emerald-500/40 text-emerald-400'
                        : conversionRates[i + 1] >= 40
                        ? 'border-amber-500/40 text-amber-400'
                        : 'border-red-500/40 text-red-400'
                    }`}
                  >
                    {conversionRates[i + 1]}%
                  </Badge>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Stage Detail Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {counts.map((stage, i) => {
          const Icon = stage.icon
          const nextCount = i < counts.length - 1 ? counts[i + 1].count : 0
          const convRate = stage.count > 0 ? Math.round((nextCount / stage.count) * 100) : 0
          const items = SAMPLE_ITEMS[stage.key] || []

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="rounded-xl bg-slate-900/90 border border-slate-700/40 overflow-hidden hover:border-slate-600/60 transition-colors"
            >
              <div className="p-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${stage.bg}`}>
                      <Icon className={`w-4 h-4 ${stage.textColor}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{stage.label}</p>
                      <p className="text-[10px] text-slate-400">{stage.count} items</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${stage.border} ${stage.textColor}`}>
                    {stage.count}
                  </Badge>
                </div>

                {/* Recent items list */}
                <div className="space-y-1 mb-2">
                  {items.slice(0, 3).map((item, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-800/40 text-xs"
                    >
                      <span className="text-slate-300 truncate flex-1">{item.title}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] h-4 px-1 shrink-0 ${
                          item.status === 'complete' || item.status === 'final' || item.status === 'passed' || item.status === 'published'
                            ? 'border-emerald-500/40 text-emerald-400'
                            : item.status === 'failed'
                            ? 'border-red-500/40 text-red-400'
                            : item.status === 'in-progress' || item.status === 'rendering' || item.status === 'review' || item.status === 'pending' || item.status === 'scheduled'
                            ? 'border-amber-500/40 text-amber-400'
                            : 'border-slate-600 text-slate-400'
                        }`}
                      >
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>

                {/* Conversion rate to next stage */}
                {i < counts.length - 1 && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400">→ {counts[i + 1].label} rate</span>
                      <span className="text-[10px] font-mono text-slate-300">{convRate}%</span>
                    </div>
                    <Progress
                      value={convRate}
                      className="h-1.5 bg-slate-800"
                    />
                  </div>
                )}

                {/* Quick action button */}
                <Button
                  size="sm"
                  variant="outline"
                  className={`w-full text-[11px] h-7 ${stage.border} ${stage.textColor} hover:${stage.bg}`}
                  onClick={() => onAction?.(stage.key)}
                >
                  {QUICK_ACTIONS[stage.key]}
                </Button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
