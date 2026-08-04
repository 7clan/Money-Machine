'use client'

import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Copyright,
  Sparkles,
  Shield,
  AlertTriangle,
  FileText,
  ListChecks,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────

/** Mirrors the PolicyReview Prisma model. Kept permissive to tolerate
 *  extra fields that may be attached by the API layer (e.g. score). */
export interface ReviewEntry {
  id: string
  videoProjectId: string
  factCheckPassed?: boolean
  originalityPassed?: boolean
  copyrightPassed?: boolean
  advertiserFriendly?: boolean
  aiDisclosureSet?: boolean
  thumbnailAccurate?: boolean
  titleAccurate?: boolean
  audioQualityOk?: boolean
  videoQualityOk?: boolean
  captionsAccurate?: boolean
  noDeceptiveContent?: boolean
  overallPassed?: boolean
  /** JSON-encoded array of issue strings or objects. */
  issues?: string | null
  reviewedAt?: string | Date | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  /** Optional aggregate score (0-100) supplied by the API. */
  score?: number | null
}

export interface QualityReviewPanelProps {
  reviews: ReviewEntry[]
  /** VideoProject[] — used to resolve titles and to surface pending reviews. */
  projects?: any[]
  className?: string
}

// ─── Constants ────────────────────────────────────────────────────────

/** Boolean check fields on PolicyReview used to derive a 0-100 score. */
const CHECK_FIELDS: (keyof ReviewEntry)[] = [
  'factCheckPassed',
  'originalityPassed',
  'copyrightPassed',
  'advertiserFriendly',
  'aiDisclosureSet',
  'thumbnailAccurate',
  'titleAccurate',
  'audioQualityOk',
  'videoQualityOk',
  'captionsAccurate',
  'noDeceptiveContent',
]

type ReviewStatus = 'passed' | 'failed' | 'pending'
type IssueType = 'factcheck' | 'copyright' | 'originality' | 'policy' | 'other'
type IssueSeverity = 'high' | 'medium' | 'low'

interface IssueItem {
  type: IssueType
  label: string
  severity: IssueSeverity
}

interface UnifiedEntry {
  id: string
  kind: 'review' | 'pending'
  status: ReviewStatus
  videoProjectId: string
  projectTitle: string
  score: number | null
  issues: IssueItem[]
  reviewedAt: Date | null
}

// ─── Helpers ──────────────────────────────────────────────────────────

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  const d = typeof v === 'string' ? new Date(v) : v
  return isNaN(d.getTime()) ? null : d
}

function relativeTime(date: Date | null): string {
  if (!date) return '—'
  const diff = Date.now() - date.getTime()
  const sec = Math.max(0, Math.floor(diff / 1000))
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function classifyType(text: string, explicit?: string): IssueType {
  const t = (explicit || text || '').toLowerCase()
  if (!t) return 'other'
  if (
    t.includes('fact') ||
    t.includes('claim') ||
    t.includes('source') ||
    t.includes('verif')
  )
    return 'factcheck'
  if (
    t.includes('copyright') ||
    t.includes('licence') ||
    t.includes('license') ||
    t.includes('asset') ||
    t.includes('music')
  )
    return 'copyright'
  if (
    t.includes('original') ||
    t.includes('plagiar') ||
    t.includes('duplicate') ||
    t.includes('unique')
  )
    return 'originality'
  if (
    t.includes('policy') ||
    t.includes('advertiser') ||
    t.includes('demonet') ||
    t.includes('guideline') ||
    t.includes('deceptive') ||
    t.includes('disclosure') ||
    t.includes('community')
  )
    return 'policy'
  return 'other'
}

function severityForType(type: IssueType): IssueSeverity {
  if (type === 'copyright' || type === 'factcheck') return 'high'
  if (type === 'policy') return 'high'
  if (type === 'originality') return 'medium'
  return 'medium'
}

function normalizeIssue(item: unknown): IssueItem | null {
  if (!item) return null
  if (typeof item === 'string') {
    const trimmed = item.trim()
    if (!trimmed) return null
    const type = classifyType(trimmed)
    return { type, label: trimmed, severity: severityForType(type) }
  }
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, any>
    const label =
          obj.message || obj.label || obj.description || obj.issue || obj.text
        ? String(
            obj.message ||
              obj.label ||
              obj.description ||
              obj.issue ||
              obj.text
          )
        : ''
    if (!label) return null
    const type = classifyType(label, obj.type || obj.category)
    const sevRaw = String(obj.severity || '').toLowerCase()
    const severity: IssueSeverity =
      sevRaw === 'low' || sevRaw === 'medium' || sevRaw === 'high'
        ? sevRaw
        : severityForType(type)
    return { type, label, severity }
  }
  return null
}

function parseIssues(raw: string | null | undefined): IssueItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeIssue)
      .filter((x): x is IssueItem => x !== null)
  } catch {
    // Fall back to treating as a single textual issue.
    const single = normalizeIssue(raw)
    return single ? [single] : []
  }
}

function computeScore(review: ReviewEntry): number {
  if (typeof review.score === 'number' && !isNaN(review.score)) {
    return Math.max(0, Math.min(100, Math.round(review.score)))
  }
  const passed = CHECK_FIELDS.reduce(
    (acc, k) => acc + (review[k] === true ? 1 : 0),
    0
  )
  return Math.round((passed / CHECK_FIELDS.length) * 100)
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-rose-400'
}

const ISSUE_META: Record<
  IssueType,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  factcheck: { icon: ClipboardCheck, label: 'Fact Check' },
  copyright: { icon: Copyright, label: 'Copyright' },
  originality: { icon: Sparkles, label: 'Originality' },
  policy: { icon: Shield, label: 'Policy' },
  other: { icon: AlertTriangle, label: 'Issue' },
}

function severityBadgeClass(sev: IssueSeverity): string {
  if (sev === 'high') return 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  if (sev === 'medium') return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  return 'bg-slate-500/15 text-slate-300 border-slate-500/30'
}

// ─── Animation variants ───────────────────────────────────────────────

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 220, damping: 24 } },
}

// ─── Component ────────────────────────────────────────────────────────

export function QualityReviewPanel({
  reviews,
  projects = [],
  className,
}: QualityReviewPanelProps) {
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const projectMap = useMemo(() => {
    const m = new Map<string, any>()
    for (const p of projects) {
      if (p && p.id) m.set(p.id, p)
    }
    return m
  }, [projects])

  /** Unified list: completed reviews + projects stuck in "review" status. */
  const entries = useMemo<UnifiedEntry[]>(() => {
    const reviewedProjectIds = new Set(reviews.map((r) => r.videoProjectId))
    const list: UnifiedEntry[] = reviews.map((r) => {
      const proj = projectMap.get(r.videoProjectId)
      const status: ReviewStatus =
        r.overallPassed === true ? 'passed' : r.overallPassed === false ? 'failed' : 'pending'
      return {
        id: r.id,
        kind: 'review',
        status,
        videoProjectId: r.videoProjectId,
        projectTitle: proj?.title || 'Unknown project',
        score: computeScore(r),
        issues: parseIssues(r.issues),
        reviewedAt: toDate(r.reviewedAt),
      }
    })

    // Surface pending reviews: VideoProjects in "review" status without a PolicyReview yet.
    for (const p of projects) {
      if (!p || !p.id) continue
      if (reviewedProjectIds.has(p.id)) continue
      const st = String(p.status || '').toLowerCase()
      if (st !== 'review' && st !== 'reviewing') continue
      list.push({
        id: `pending-${p.id}`,
        kind: 'pending',
        status: 'pending',
        videoProjectId: p.id,
        projectTitle: p.title || 'Untitled project',
        score: null,
        issues: [],
        reviewedAt: null,
      })
    }

    // Most recent first; pending entries (no date) sink to bottom.
    list.sort((a, b) => {
      if (!a.reviewedAt && !b.reviewedAt) return a.projectTitle.localeCompare(b.projectTitle)
      if (!a.reviewedAt) return 1
      if (!b.reviewedAt) return -1
      return b.reviewedAt.getTime() - a.reviewedAt.getTime()
    })
    return list
  }, [reviews, projects, projectMap])

  const stats = useMemo(() => {
    const total = entries.length
    const passed = entries.filter((e) => e.status === 'passed').length
    const failed = entries.filter((e) => e.status === 'failed').length
    const pending = entries.filter((e) => e.status === 'pending').length
    const decided = passed + failed
    const rate = decided > 0 ? Math.round((passed / decided) * 100) : 0
    return { total, passed, failed, pending, rate }
  }, [entries])

  const filtered = useMemo(() => {
    if (filter === 'all') return entries
    return entries.filter((e) => e.status === filter)
  }, [entries, filter])

  const toggle = (id: string) =>
    setExpanded((s) => ({ ...s, [id]: !s[id] }))

  return (
    <Card
      className={cn(
        'bg-slate-900/60 border border-slate-800/50 backdrop-blur-sm text-slate-100',
        className
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="size-5 text-violet-400" />
              Quality Review
            </CardTitle>
            <CardDescription className="text-slate-400">
              Automated policy &amp; quality checks across produced videos.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="bg-slate-800/60 text-slate-300 border-slate-700"
          >
            <ListChecks className="size-3.5 mr-1" />
            {stats.total} {stats.total === 1 ? 'entry' : 'entries'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Summary stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            label="Total"
            value={stats.total}
            icon={<FileText className="size-4" />}
            tone="slate"
          />
          <StatTile
            label="Passed"
            value={stats.passed}
            icon={<CheckCircle2 className="size-4" />}
            tone="emerald"
          />
          <StatTile
            label="Failed"
            value={stats.failed}
            icon={<XCircle className="size-4" />}
            tone="rose"
          />
          <StatTile
            label="Pass rate"
            value={`${stats.rate}%`}
            icon={<ListChecks className="size-4" />}
            tone={stats.rate >= 80 ? 'emerald' : stats.rate >= 60 ? 'amber' : 'rose'}
          />
        </div>

        {/* ── Filter tabs ───────────────────────────────────────────── */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="bg-slate-800/60 border border-slate-700/60 h-auto flex-wrap">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-300"
            >
              All
              <Badge className="ml-1.5 bg-slate-700/80 text-slate-200" >
                {stats.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="passed"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 text-slate-300"
            >
              Passed
              <Badge className="ml-1.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                {stats.passed}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="failed"
              className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-300 text-slate-300"
            >
              Failed
              <Badge className="ml-1.5 bg-rose-500/20 text-rose-300 border-rose-500/30">
                {stats.failed}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-slate-300"
            >
              Pending
              <Badge className="ml-1.5 bg-amber-500/20 text-amber-300 border-amber-500/30">
                {stats.pending}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── Review list ───────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <EmptyState hasAny={entries.length > 0} filter={filter} />
        ) : (
          <ScrollArea className="max-h-[28rem] pr-3 -mr-3">
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              <AnimatePresence initial={false}>
                {filtered.map((entry) => (
                  <ReviewCard
                    key={entry.id}
                    entry={entry}
                    expanded={!!expanded[entry.id]}
                    onToggle={() => toggle(entry.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  tone: 'slate' | 'emerald' | 'rose' | 'amber'
}) {
  const toneMap: Record<typeof tone, string> = {
    slate: 'border-slate-700/60 bg-slate-800/40 text-slate-200',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  }
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 flex items-center gap-3',
        toneMap[tone]
      )}
    >
      <div className="size-8 rounded-md bg-slate-950/40 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-slate-400 truncate">
          {label}
        </div>
        <div className="text-xl font-semibold leading-tight">{value}</div>
      </div>
    </div>
  )
}

function ReviewCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: UnifiedEntry
  expanded: boolean
  onToggle: () => void
}) {
  const StatusIcon =
    entry.status === 'passed'
      ? CheckCircle2
      : entry.status === 'failed'
        ? XCircle
        : Clock
  const statusColor =
    entry.status === 'passed'
      ? 'text-emerald-400'
      : entry.status === 'failed'
        ? 'text-rose-400'
        : 'text-amber-400'

  const visibleIssues = entry.issues.slice(0, 4)
  const hiddenIssueCount = Math.max(0, entry.issues.length - visibleIssues.length)

  return (
    <motion.div
      layout
      variants={itemVariants}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        'rounded-lg border bg-slate-950/40 transition-colors',
        entry.status === 'passed'
          ? 'border-emerald-500/20 hover:border-emerald-500/40'
          : entry.status === 'failed'
            ? 'border-rose-500/20 hover:border-rose-500/40'
            : 'border-amber-500/20 hover:border-amber-500/40'
      )}
    >
      <div className="p-3.5 sm:p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <StatusIcon className={cn('size-5 mt-0.5 shrink-0', statusColor)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-slate-100 truncate">
                {entry.projectTitle}
              </h4>
              <Badge
                variant="outline"
                className={cn(
                  'border-transparent text-[10px] uppercase tracking-wide',
                  entry.status === 'passed'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : entry.status === 'failed'
                      ? 'bg-rose-500/15 text-rose-300'
                      : 'bg-amber-500/15 text-amber-300'
                )}
              >
                {entry.status}
              </Badge>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {entry.kind === 'pending' ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> Awaiting automated review
                </span>
              ) : (
                <span>Reviewed {relativeTime(entry.reviewedAt)}</span>
              )}
            </div>
          </div>

          {entry.kind === 'review' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-7 px-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </Button>
          )}
        </div>

        {/* Score bar */}
        {entry.score !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400">Quality score</span>
              <span className={cn('font-semibold tabular-nums', scoreTextColor(entry.score))}>
                {entry.score}/100
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800/80 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', scoreColor(entry.score))}
                initial={{ width: 0 }}
                animate={{ width: `${entry.score}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
        )}

        {/* Issue badges */}
        {entry.issues.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleIssues.map((iss, idx) => {
              const meta = ISSUE_META[iss.type]
              const Icon = meta.icon
              return (
                <Badge
                  key={`${iss.type}-${idx}`}
                  variant="outline"
                  className={cn(
                    'gap-1 text-[11px] border',
                    severityBadgeClass(iss.severity)
                  )}
                  title={iss.label}
                >
                  <Icon className="size-3" />
                  {meta.label}
                </Badge>
              )
            })}
            {hiddenIssueCount > 0 && (
              <Badge
                variant="outline"
                className="text-[11px] bg-slate-700/40 text-slate-300 border-slate-600"
              >
                +{hiddenIssueCount} more
              </Badge>
            )}
          </div>
        ) : entry.status === 'passed' ? (
          <div className="mt-3 text-xs text-emerald-400/80 flex items-center gap-1">
            <CheckCircle2 className="size-3.5" />
            All checks passed
          </div>
        ) : null}
      </div>

      {/* Expandable details */}
      <AnimatePresence initial={false}>
        {expanded && entry.issues.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Separator className="bg-slate-800" />
            <ul className="p-3.5 sm:p-4 space-y-2">
              {entry.issues.map((iss, idx) => {
                const meta = ISSUE_META[iss.type]
                const Icon = meta.icon
                return (
                  <li
                    key={`detail-${iss.type}-${idx}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Icon
                      className={cn(
                        'size-4 mt-0.5 shrink-0',
                        iss.severity === 'high'
                          ? 'text-rose-400'
                          : iss.severity === 'medium'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                      )}
                    />
                    <span className="text-slate-300">{iss.label}</span>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function EmptyState({
  hasAny,
  filter,
}: {
  hasAny: boolean
  filter: string
}) {
  if (hasAny) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
        <Inbox className="size-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">
          No <span className="font-medium text-slate-300">{filter}</span> reviews
          in this view.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center">
      <div className="mx-auto mb-3 size-12 rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
        <Shield className="size-6 text-violet-300" />
      </div>
      <p className="text-sm text-slate-300 font-medium">
        No quality reviews yet
      </p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
        Produce a video to trigger automated review. Fact-check, originality,
        copyright, and policy compliance results will appear here.
      </p>
    </div>
  )
}

export default QualityReviewPanel
