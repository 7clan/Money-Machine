'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Film,
  Quote,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Clapperboard,
  Gavel,
  Sparkles,
  Megaphone,
  Clock,
  HardDrive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Hash,
  Type as TypeIcon,
  Layers,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RefreshCcw } from 'lucide-react'
import { useToast } from '@/components/agent/toast-provider'

// ─── Types ──────────────────────────────────────────────────────────

interface Pillar {
  id: string
  name: string
  color?: string | null
  icon?: string | null
}

interface Idea {
  id: string
  title: string
  description?: string | null
  type: string // longform | short
  status: string
  pillar: Pillar | null
}

interface SceneItem {
  id: string
  index: number
  title: string
  description?: string | null
  durationMs: number | null
  durationSec: number | null
  visualType: string
  visualNotes?: string | null
  narration?: string | null
  transitionType?: string | null
}

interface ScriptItem {
  id: string
  content: string
  outline?: string | null
  hook?: string | null
  callToAction?: string | null
  wordCount: number
  estimatedMinutes?: number | null
  originalityScore?: number | null
  originalityReport?: string | null
  version: number
  status: string
  factCheckNotes?: string | null
}

interface ClaimItem {
  id: string
  claim: string
  sourceIds: string // JSON string of source IDs
  isConflicting: boolean
  isUncertain: boolean
  isRejected: boolean
  conflictNotes?: string | null
  verified: boolean
  createdAt: string
}

interface ReviewItem {
  id: string
  factCheckPassed: boolean
  originalityPassed: boolean
  copyrightPassed: boolean
  advertiserFriendly: boolean
  aiDisclosureSet: boolean
  thumbnailAccurate: boolean
  titleAccurate: boolean
  audioQualityOk: boolean
  videoQualityOk: boolean
  captionsAccurate: boolean
  noDeceptiveContent: boolean
  overallPassed: boolean
  issues?: string | null // JSON string array
  reviewedAt: string
}

interface VideoProjectItem {
  id: string
  title: string
  status: string
  videoFilePath?: string | null
  thumbnailPath?: string | null
  captionPath?: string | null
  resolution: string
  duration?: number | null
  fileSize?: number | null
  renderProgress: number
  reviewResult?: string | null
  isApproved: boolean
  editorNotes?: string | null
  createdAt: string
  updatedAt: string
}

interface VideoDetailResponse {
  videoProject: VideoProjectItem
  script: ScriptItem | null
  scenes: SceneItem[]
  idea: Idea | null
  claims: ClaimItem[]
  review: ReviewItem | null
}

interface Props {
  videoProjectId: string | null
  onClose: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return '—'
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Map pillar.color (any CSS color) into a safe tailwind text/bg class set.
// Falls back to the violet→cyan brand gradient.
function pillarStyle(color?: string | null): { text: string; bg: string; border: string } {
  const c = (color || '').toLowerCase()
  switch (c) {
    case 'violet':
    case '#8b5cf6':
    case 'purple':
      return { text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/30' }
    case 'cyan':
    case '#06b6d4':
      return { text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' }
    case 'emerald':
    case '#10b981':
    case 'green':
      return { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' }
    case 'amber':
    case '#f59e0b':
    case 'yellow':
      return { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30' }
    case 'rose':
    case '#f43f5e':
    case 'red':
      return { text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/30' }
    default:
      return { text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/30' }
  }
}

// Color-code VideoProject.status.
function statusStyle(status: string): { label: string; text: string; bg: string; border: string; dot: string } {
  const s = (status || '').toLowerCase()
  if (['approved', 'uploaded', 'published', 'completed'].includes(s)) {
    return { label: status, text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' }
  }
  if (['failed', 'rejected', 'error'].includes(s)) {
    return { label: status, text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/30', dot: 'bg-rose-400' }
  }
  if (['rendering', 'editing', 'recording', 'collecting_assets', 'storyboarding', 'planning', 'uploading'].includes(s)) {
    return { label: status, text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', dot: 'bg-cyan-400' }
  }
  if (['review', 'reviewing'].includes(s)) {
    return { label: status, text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' }
  }
  return { label: status, text: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-500/30', dot: 'bg-slate-400' }
}

// Parse a JSON-string array (issues, etc.) safely.
function parseJsonArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    if (Array.isArray(v)) return v.map((x) => String(x))
    return [String(v)]
  } catch {
    return raw.split('\n').map((s) => s.trim()).filter(Boolean)
  }
}

// ─── Sub-renderers ──────────────────────────────────────────────────

function ScriptTab({ script }: { script: ScriptItem | null }) {
  if (!script) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-2xl bg-slate-800/50 mb-4">
          <FileText className="w-8 h-8 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-300">No script</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">This video project has no script attached.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-slate-800/60 border-slate-700/50 text-slate-300 gap-1">
          <Hash className="w-3 h-3" />
          {script.wordCount.toLocaleString()} words
        </Badge>
        <Badge variant="outline" className="bg-slate-800/60 border-slate-700/50 text-slate-300 gap-1">
          <Clock className="w-3 h-3" />
          ~{script.estimatedMinutes ? script.estimatedMinutes.toFixed(1) : '—'} min
        </Badge>
        <Badge variant="outline" className="bg-slate-800/60 border-slate-700/50 text-slate-300 capitalize">
          v{script.version} · {script.status}
        </Badge>
        {script.originalityScore != null && (
          <Badge variant="outline" className="bg-violet-500/10 border-violet-500/30 text-violet-300 gap-1">
            <Sparkles className="w-3 h-3" />
            {(script.originalityScore * 100).toFixed(0)}% original
          </Badge>
        )}
      </div>

      {/* Hook callout */}
      {script.hook && (
        <div className="relative overflow-hidden rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 p-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="w-4 h-4 text-violet-300" />
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">Hook</span>
          </div>
          <p className="text-sm text-slate-100 leading-relaxed font-medium">{script.hook}</p>
        </div>
      )}

      {/* Full script body */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Full Script</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">{script.wordCount} words</span>
        </div>
        <ScrollArea className="max-h-96">
          <pre className="whitespace-pre-wrap break-words p-4 font-mono text-[13px] leading-relaxed text-slate-300">
            {script.content}
          </pre>
        </ScrollArea>
      </div>

      {/* CTA box */}
      {script.callToAction && (
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="w-4 h-4 text-emerald-300" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Call to Action</span>
          </div>
          <p className="text-sm text-slate-100 leading-relaxed font-medium">{script.callToAction}</p>
        </div>
      )}

      {script.factCheckNotes && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">Fact-check Notes</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{script.factCheckNotes}</p>
        </div>
      )}
    </div>
  )
}

function ScenesTab({ scenes }: { scenes: SceneItem[] }) {
  if (!scenes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-2xl bg-slate-800/50 mb-4">
          <Clapperboard className="w-8 h-8 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-300">No scenes</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">Scenes will appear here once the script is broken down.</p>
      </div>
    )
  }
  const totalSec = scenes.reduce((acc, s) => acc + (s.durationSec ?? 0), 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {scenes.length} scene{scenes.length === 1 ? '' : 's'} · total runtime{' '}
          <span className="text-slate-200 font-mono">{formatDuration(totalSec)}</span>
        </p>
      </div>
      <div className="relative">
        {/* vertical timeline rail */}
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-violet-500/40 via-cyan-500/30 to-transparent" />
        <div className="space-y-3">
          {scenes.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="relative pl-12"
            >
              {/* index node */}
              <div className="absolute left-0 top-2 flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 border-2 border-violet-500/40 text-violet-300 font-bold text-sm shadow-lg shadow-violet-500/10">
                {s.index + 1}
              </div>
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60 bg-slate-950/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <Film className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                    <span className="text-sm font-medium text-slate-100 truncate">{s.title || `Scene ${s.index + 1}`}</span>
                  </div>
                  {s.durationSec != null && (
                    <Badge variant="outline" className="bg-slate-800/60 border-slate-700/50 text-slate-300 gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {s.durationSec.toFixed(1)}s
                    </Badge>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {/* Visual */}
                  <div className="flex gap-2">
                    <TypeIcon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                        Visual · <span className="text-slate-400">{s.visualType}</span>
                      </p>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {s.description || s.visualNotes || '—'}
                      </p>
                    </div>
                  </div>
                  {/* Narration */}
                  {s.narration && (
                    <div className="flex gap-2">
                      <Quote className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Narration</p>
                        <blockquote className="border-l-2 border-violet-500/40 pl-3 text-sm text-slate-200 italic leading-relaxed">
                          {s.narration}
                        </blockquote>
                      </div>
                    </div>
                  )}
                  {s.transitionType && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Layers className="w-3 h-3" />
                      <span className="uppercase tracking-wider">Transition:</span>
                      <span className="text-slate-400">{s.transitionType}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ClaimsTab({ claims }: { claims: ClaimItem[] }) {
  if (!claims.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-2xl bg-slate-800/50 mb-4">
          <Gavel className="w-8 h-8 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-300">No claims tracked</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">Fact-checked claims will be listed here.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 mb-2">
        {claims.length} claim{claims.length === 1 ? '' : 's'} on record
      </p>
      {claims.map((c, i) => {
        const verified = c.verified
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.3) }}
            className={`rounded-xl border p-3 ${
              verified
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : c.isRejected
                ? 'border-rose-500/30 bg-rose-500/5'
                : 'border-amber-500/30 bg-amber-500/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                {verified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : c.isRejected ? (
                  <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                )}
                <p className="text-sm text-slate-200 leading-relaxed">{c.claim}</p>
              </div>
              <Badge
                variant="outline"
                className={`shrink-0 ${
                  verified
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : c.isRejected
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {verified ? 'Verified' : c.isRejected ? 'Rejected' : 'Uncertain'}
              </Badge>
            </div>
            {(c.isConflicting || c.conflictNotes) && (
              <div className="mt-2 pl-6 text-xs text-slate-400 space-y-0.5">
                {c.isConflicting && (
                  <p className="text-amber-300/80">⚠ Conflicting sources</p>
                )}
                {c.conflictNotes && <p className="italic">{c.conflictNotes}</p>}
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

function ReviewTab({ review }: { review: ReviewItem | null }) {
  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-2xl bg-slate-800/50 mb-4">
          <ShieldAlert className="w-8 h-8 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-300">No review yet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">A policy & quality review will appear here once completed.</p>
      </div>
    )
  }
  const issues = parseJsonArray(review.issues)
  const passed = [
    review.factCheckPassed,
    review.originalityPassed,
    review.copyrightPassed,
    review.advertiserFriendly,
    review.aiDisclosureSet,
    review.thumbnailAccurate,
    review.titleAccurate,
    review.audioQualityOk,
    review.videoQualityOk,
    review.captionsAccurate,
    review.noDeceptiveContent,
  ].filter(Boolean).length
  const totalChecks = 11
  const score = Math.round((passed / totalChecks) * 100)
  const overall = review.overallPassed

  const checks: { label: string; ok: boolean }[] = [
    { label: 'Fact check', ok: review.factCheckPassed },
    { label: 'Originality', ok: review.originalityPassed },
    { label: 'Copyright', ok: review.copyrightPassed },
    { label: 'Advertiser-friendly', ok: review.advertiserFriendly },
    { label: 'AI disclosure', ok: review.aiDisclosureSet },
    { label: 'Thumbnail accurate', ok: review.thumbnailAccurate },
    { label: 'Title accurate', ok: review.titleAccurate },
    { label: 'Audio quality', ok: review.audioQualityOk },
    { label: 'Video quality', ok: review.videoQualityOk },
    { label: 'Captions accurate', ok: review.captionsAccurate },
    { label: 'No deceptive content', ok: review.noDeceptiveContent },
  ]

  return (
    <div className="space-y-4">
      {/* Overall banner */}
      <div
        className={`relative overflow-hidden rounded-xl border p-4 ${
          overall
            ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5'
            : 'border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-amber-500/5'
        }`}
      >
        <div
          className={`absolute inset-x-0 top-0 h-px ${
            overall ? 'bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent' : 'bg-gradient-to-r from-transparent via-rose-400/60 to-transparent'
          }`}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {overall ? (
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-rose-300" />
            )}
            <div>
              <p className={`text-sm font-semibold ${overall ? 'text-emerald-300' : 'text-rose-300'}`}>
                {overall ? 'All checks passed' : 'Review failed'}
              </p>
              <p className="text-xs text-slate-400">
                Reviewed {new Date(review.reviewedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${overall ? 'text-emerald-300' : 'text-rose-300'}`}>{score}%</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              {passed}/{totalChecks} checks
            </p>
          </div>
        </div>
        <Progress
          value={score}
          className={`mt-3 h-1.5 ${overall ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}
        />
      </div>

      {/* Checklist */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-950/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Compliance Checklist</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-800/60">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/60">
              {c.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={`text-sm ${c.ok ? 'text-slate-200' : 'text-slate-400'}`}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Issues ({issues.length})
            </span>
          </div>
          <ul className="space-y-1.5">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-amber-400/60 mt-0.5">•</span>
                <span className="leading-relaxed">{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Loading skeleton ───────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-4 p-1">
      <Skeleton className="aspect-video w-full rounded-xl bg-slate-800/60" />
      <Skeleton className="h-7 w-3/4 bg-slate-800/60" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 bg-slate-800/60" />
        <Skeleton className="h-6 w-24 bg-slate-800/60" />
        <Skeleton className="h-6 w-20 bg-slate-800/60" />
      </div>
      <Skeleton className="h-9 w-full bg-slate-800/60" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full bg-slate-800/60" />
        <Skeleton className="h-4 w-5/6 bg-slate-800/60" />
        <Skeleton className="h-4 w-4/6 bg-slate-800/60" />
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────

export function VideoPreviewModal({ videoProjectId, onClose }: Props) {
  const open = videoProjectId !== null
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<VideoDetailResponse | null>(null)
  const { toast, update: updateToast } = useToast()
  // Re-render flow state
  const [rerenderConfirmOpen, setRerenderConfirmOpen] = React.useState(false)
  const [rerendering, setRerendering] = React.useState(false)

  React.useEffect(() => {
    if (!videoProjectId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/data/video-detail?id=${encodeURIComponent(videoProjectId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Failed to load (${res.status})`)
        }
        return res.json() as Promise<VideoDetailResponse>
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load video detail'
        setError(msg)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [videoProjectId])

  // Build file URLs (these are served by sibling API routes).
  const videoUrl = videoProjectId ? `/api/data/video-file?id=${encodeURIComponent(videoProjectId)}` : null
  const thumbnailUrl = videoProjectId ? `/api/data/thumbnail-file?id=${encodeURIComponent(videoProjectId)}` : null

  const vp = data?.videoProject
  const idea = data?.idea ?? null
  const script = data?.script ?? null
  const scenes = data?.scenes ?? []
  const claims = data?.claims ?? []
  const review = data?.review ?? null

  const status = vp ? statusStyle(vp.status) : null
  const pillar = idea?.pillar
  const ps = pillar ? pillarStyle(pillar.color) : null

  // Re-render is offered when the project failed review (or was rejected).
  // Hidden while a re-render is already in-flight.
  const isFailed = vp?.status === 'failed' || vp?.status === 'rejected'
  const showRerender = !!vp && isFailed && !rerendering

  const handleRerender = React.useCallback(async () => {
    if (!videoProjectId) return
    setRerenderConfirmOpen(false)
    setRerendering(true)
    const loadingId = toast({
      type: 'loading',
      title: 'Starting re-render…',
      description: 'Generating a revised script and re-rendering the video.',
      duration: 0,
    })
    try {
      const res = await fetch('/api/agent/rerender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: videoProjectId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        const errMsg = data?.message || data?.error || `Re-render failed (${res.status})`
        updateToast(loadingId, { type: 'error', title: 'Re-render failed', description: errMsg, duration: 5000 })
        setRerendering(false)
        return
      }
      updateToast(loadingId, {
        type: 'success',
        title: 'Re-render started',
        description: data?.message || 'A new script version is being generated.',
        duration: 3500,
      })
      // Close the modal so the user is back on the dashboard where they
      // can watch the project status flip to "producing" → "review".
      onClose()
    } catch (err) {
      updateToast(loadingId, {
        type: 'error',
        title: 'Network error',
        description: err instanceof Error ? err.message : 'Failed to reach server',
        duration: 5000,
      })
      setRerendering(false)
    }
  }, [videoProjectId, toast, updateToast, onClose])

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="
          bg-slate-950 border border-slate-800/60 text-slate-100
          p-0 gap-0 overflow-hidden
          max-w-[100vw] w-full sm:max-w-4xl
          h-[100dvh] sm:h-[90vh] sm:rounded-xl
          flex flex-col
        "
      >
        {/* Hidden title/description for accessibility (radix requires a title) */}
        <DialogHeader className="sr-only">
          <DialogTitle>{vp?.title ?? 'Video preview'}</DialogTitle>
          <DialogDescription>
            Inline player, script, scenes, claims, and review for this video project.
          </DialogDescription>
        </DialogHeader>

        {/* Body — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 sm:p-6"
              >
                <LoadingState />
              </motion.div>
            )}

            {!loading && error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-4 rounded-2xl bg-rose-500/10 mb-4">
                    <ShieldAlert className="w-8 h-8 text-rose-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-200">Couldn&apos;t load video</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm break-words">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="mt-4 bg-slate-900/60 border-slate-700/50 text-slate-300 hover:text-slate-100 hover:bg-slate-800/60"
                  >
                    Close
                  </Button>
                </div>
              </motion.div>
            )}

            {!loading && !error && vp && (
              <motion.div
                key="content"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="p-4 sm:p-6 space-y-5"
              >
                {/* ── Video player ────────────────────────────────── */}
                <div className="relative rounded-xl overflow-hidden border border-slate-800/60 bg-slate-950 shadow-xl shadow-black/40">
                  {videoUrl ? (
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      poster={thumbnailUrl ?? undefined}
                      src={videoUrl}
                      className="w-full aspect-video bg-black object-contain"
                    />
                  ) : (
                    <div className="aspect-video flex items-center justify-center text-slate-500">
                      <Film className="w-10 h-10" />
                    </div>
                  )}
                  {/* overlay badges on top-right of player */}
                  <div className="absolute top-2 right-2 flex flex-wrap gap-1.5 justify-end pointer-events-none">
                    {vp.duration != null && (
                      <Badge className="bg-black/70 border-white/10 text-slate-100 backdrop-blur-sm gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(vp.duration)}
                      </Badge>
                    )}
                    {vp.fileSize != null && (
                      <Badge className="bg-black/70 border-white/10 text-slate-100 backdrop-blur-sm gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatFileSize(vp.fileSize)}
                      </Badge>
                    )}
                    <Badge className="bg-black/70 border-white/10 text-slate-100 backdrop-blur-sm uppercase">
                      {vp.resolution}
                    </Badge>
                  </div>
                </div>

                {/* ── Title + meta row ──────────────────────────── */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 leading-tight">
                        {vp.title}
                      </h2>
                      {idea && idea.title && idea.title !== vp.title && (
                        <p className="text-xs text-slate-500 mt-1 truncate">From idea: {idea.title}</p>
                      )}
                    </div>
                    {status && (
                      <Badge
                        className={`shrink-0 ${status.bg} ${status.border} ${status.text} gap-1.5`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        <span className="capitalize">{status.label.replace(/_/g, ' ')}</span>
                      </Badge>
                    )}
                  </div>

                  {/* Meta chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {idea && (
                      <Badge
                        variant="outline"
                        className={`bg-slate-800/60 border-slate-700/50 text-slate-300 capitalize gap-1`}
                      >
                        <Film className="w-3 h-3" />
                        {idea.type === 'short' ? 'Short' : 'Long-form'}
                      </Badge>
                    )}
                    {vp.isApproved && (
                      <Badge className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Approved
                      </Badge>
                    )}
                    {pillar && ps && (
                      <Badge className={`${ps.bg} ${ps.border} ${ps.text} gap-1`}>
                        <Layers className="w-3 h-3" />
                        {pillar.name}
                      </Badge>
                    )}
                    {vp.renderProgress < 100 && vp.renderProgress > 0 && (
                      <Badge variant="outline" className="bg-cyan-500/10 border-cyan-500/30 text-cyan-300 gap-1">
                        Rendering {vp.renderProgress.toFixed(0)}%
                      </Badge>
                    )}
                  </div>

                  {vp.renderProgress < 100 && vp.renderProgress > 0 && (
                    <Progress value={vp.renderProgress} className="h-1 bg-cyan-500/10" />
                  )}
                </div>

                <Separator className="bg-slate-800/60" />

                {/* ── Tabs ──────────────────────────────────────── */}
                <Tabs defaultValue="script" className="w-full">
                  <TabsList className="bg-slate-900/60 border border-slate-800/60 p-1 h-auto w-full justify-start overflow-x-auto">
                    <TabsTrigger
                      value="script"
                      className="data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-200 text-slate-400 gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Script
                    </TabsTrigger>
                    <TabsTrigger
                      value="scenes"
                      className="data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-200 text-slate-400 gap-1.5"
                    >
                      <Clapperboard className="w-3.5 h-3.5" />
                      Scenes
                      {scenes.length > 0 && (
                        <span className="ml-1 text-[10px] bg-slate-800 text-slate-400 rounded-full px-1.5 py-0.5">
                          {scenes.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="claims"
                      className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200 text-slate-400 gap-1.5"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      Claims
                      {claims.length > 0 && (
                        <span className="ml-1 text-[10px] bg-slate-800 text-slate-400 rounded-full px-1.5 py-0.5">
                          {claims.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="review"
                      className="data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-200 text-slate-400 gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Review
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="script" className="mt-4">
                    <ScriptTab script={script} />
                  </TabsContent>
                  <TabsContent value="scenes" className="mt-4">
                    <ScenesTab scenes={scenes} />
                  </TabsContent>
                  <TabsContent value="claims" className="mt-4">
                    <ClaimsTab claims={claims} />
                  </TabsContent>
                  <TabsContent value="review" className="mt-4">
                    <ReviewTab review={review} />
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer (sticky at bottom of dialog) ──────────── */}
        <DialogFooter className="border-t border-slate-800/60 bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 sm:flex-row sm:justify-between gap-2">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            {vp && (
              <>
                <span className="font-mono text-slate-600 truncate max-w-[280px]">{vp.id}</span>
                <span className="text-slate-700">·</span>
                <span>Updated {new Date(vp.updatedAt).toLocaleDateString()}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="bg-slate-900/60 border-slate-700/50 text-slate-300 hover:text-slate-100 hover:bg-slate-800/60"
            >
              Close
            </Button>
            {showRerender && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRerenderConfirmOpen(true)}
                    className="gap-1.5 border-rose-500/40 bg-rose-500/5 text-rose-300 hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-200"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Re-render
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="border-slate-700 bg-slate-800 text-slate-200">
                  Re-render with revised script
                </TooltipContent>
              </Tooltip>
            )}
            {rerendering && (
              <span className="flex items-center gap-1.5 text-xs text-violet-300">
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                Re-rendering…
              </span>
            )}
            <Button
              asChild
              size="sm"
              disabled={!videoUrl}
              className="bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white border-0 shadow-lg shadow-violet-500/20"
            >
              <a href={videoUrl ?? '#'} download={`${vp?.title ?? 'video'}.mp4`}>
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Re-render confirmation dialog — sibling of Dialog so radix
        doesn't complain about nested overlays. */}
    <AlertDialog
      open={rerenderConfirmOpen}
      onOpenChange={setRerenderConfirmOpen}
    >
      <AlertDialogContent className="border-slate-800 bg-slate-950 text-slate-100">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-slate-100">
            Re-render this video?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            A new script version will be generated addressing the failed
            review issues, then the video will be re-rendered from scratch.
            This may take a few minutes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => { void handleRerender() }}
            className="border-0 bg-gradient-to-r from-rose-500 to-violet-500 text-white hover:from-rose-400 hover:to-violet-400"
          >
            <RefreshCcw className="mr-1.5 w-3.5 h-3.5" />
            Confirm Re-render
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
