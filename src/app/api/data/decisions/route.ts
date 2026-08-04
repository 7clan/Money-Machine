import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ───────────────────────────────────────────────────────────────────
// /api/data/decisions/route.ts
//
// Aggregates "decisions" the autonomous agent has made from multiple
// data sources into a unified, time-sorted timeline:
//
//   • AuditLog         → emergency_stop, mode_change, upload,
//                         strategy_change, metadata_update, publish
//   • NicheAnalysis    → isSelected=true (selected) + rejectionReason
//                         on the others (rejected)
//   • VideoIdea        → high-composite-score ideas + status
//                         transitions (idea → researched → scripted …)
//   • ContentPillar    → created pillars (with priority + color)
//   • PolicyReview     → overallPassed / failed video approval decisions
//   • Channel          → strategy creation events (createdAt)
//
// Query params:
//   ?category=<cat>   filter by category
//                     (niche|strategy|content|production|review|upload|system|mode)
//   ?limit=<n>         cap the result length (default 50, hard max 200)
//
// Response shape:
//   {
//     decisions: Decision[],
//     counts: { total, byCategory, last24h, last7d }
//   }
// ───────────────────────────────────────────────────────────────────

export type DecisionCategory =
  | 'niche'
  | 'strategy'
  | 'content'
  | 'production'
  | 'review'
  | 'upload'
  | 'system'
  | 'mode'

export interface Decision {
  id: string
  timestamp: string // ISO date
  category: DecisionCategory
  decisionType: string // "Niche Selected" | "Idea Generated" | …
  title: string
  description: string
  reasoning?: string
  targetId?: string
  targetType?: string
  impact: 'high' | 'medium' | 'low'
  metadata?: Record<string, any>
}

export interface DecisionCounts {
  total: number
  byCategory: Record<string, number>
  last24h: number
  last7d: number
}

const VALID_CATEGORIES = new Set<DecisionCategory>([
  'niche',
  'strategy',
  'content',
  'production',
  'review',
  'upload',
  'system',
  'mode',
])

const DEFAULT_LIMIT = 50
const HARD_LIMIT = 200

function impactForCategory(cat: DecisionCategory): 'high' | 'medium' | 'low' {
  switch (cat) {
    case 'niche':
    case 'mode':
    case 'system':
      return 'high'
    case 'strategy':
    case 'upload':
    case 'review':
      return 'medium'
    case 'content':
    case 'production':
      return 'low'
    default:
      return 'low'
  }
}

/** Safely parse JSON payloads stored as TEXT columns. */
function safeParseJson<T = any>(raw: unknown): T | null {
  if (raw == null) return null
  if (typeof raw !== 'string') return raw as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Parse legacy (string) or new (JSON {message, detail}) audit log detail. */
function parseAuditDetails(raw: string | null): {
  message: string
  detail: string | null
} {
  if (!raw) return { message: '', detail: null }
  const parsed = safeParseJson<{ message?: string; detail?: string }>(raw)
  if (parsed && typeof parsed === 'object' && 'message' in parsed) {
    return {
      message: parsed.message ?? '',
      detail: parsed.detail ?? null,
    }
  }
  return { message: String(raw), detail: null }
}

/** Map an AuditLog action to a unified DecisionCategory (or null to skip). */
function categoryForAuditAction(action: string): DecisionCategory | null {
  switch (action) {
    case 'emergency_stop':
      return 'system'
    case 'mode_change':
      return 'mode'
    case 'upload':
    case 'publish':
      return 'upload'
    case 'strategy_change':
      return 'strategy'
    case 'metadata_update':
      return 'content'
    case 'token_refresh':
    case 'token_revoke':
      return 'system'
    default:
      return null
  }
}

/** Map an AuditLog action to a friendly decision type label. */
function decisionTypeForAction(action: string): string {
  switch (action) {
    case 'emergency_stop':
      return 'Emergency Stop'
    case 'mode_change':
      return 'Mode Changed'
    case 'upload':
      return 'Video Uploaded'
    case 'publish':
      return 'Video Published'
    case 'strategy_change':
      return 'Strategy Updated'
    case 'metadata_update':
      return 'Metadata Updated'
    case 'token_refresh':
      return 'Token Refreshed'
    case 'token_revoke':
      return 'Token Revoked'
    default:
      return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ')
  }
}

function targetTypeForAction(action: string): string | undefined {
  switch (action) {
    case 'upload':
    case 'publish':
      return 'upload'
    case 'strategy_change':
      return 'channel'
    case 'metadata_update':
      return 'idea'
    default:
      return undefined
  }
}

// ─── Source: AuditLog ──────────────────────────────────────────────
async function decisionsFromAuditLog(): Promise<Decision[]> {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const out: Decision[] = []
  for (const log of logs) {
    const cat = categoryForAuditAction(log.action)
    if (!cat) continue
    const { message, detail } = parseAuditDetails(log.details ?? null)
    const title = message || decisionTypeForAction(log.action)
    const description = detail
      ? `${decisionTypeForAction(log.action)} — ${detail}`
      : decisionTypeForAction(log.action)
    out.push({
      id: `audit:${log.id}`,
      timestamp: log.createdAt.toISOString(),
      category: cat,
      decisionType: decisionTypeForAction(log.action),
      title,
      description,
      targetId: log.target ?? undefined,
      targetType: targetTypeForAction(log.action),
      impact: log.action === 'emergency_stop' ? 'high' : impactForCategory(cat),
      metadata: {
        actor: log.actor,
        rawAction: log.action,
        detail: detail ?? undefined,
      },
    })
  }
  return out
}

// ─── Source: NicheAnalysis ─────────────────────────────────────────
async function decisionsFromNiches(): Promise<Decision[]> {
  const niches = await db.nicheAnalysis.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  const out: Decision[] = []
  for (const n of niches) {
    if (n.isSelected) {
      out.push({
        id: `niche-select:${n.id}`,
        timestamp: n.createdAt.toISOString(),
        category: 'niche',
        decisionType: 'Niche Selected',
        title: `Selected niche: ${n.nicheName}`,
        description: `Composite score ${n.compositeScore.toFixed(1)}/10 — chosen as the channel's primary niche.`,
        reasoning: n.notes ?? undefined,
        targetId: n.id,
        targetType: 'niche',
        impact: 'high',
        metadata: {
          compositeScore: n.compositeScore,
          isSelected: true,
          revenuePerHour: n.revenuePerHour,
          timeToMonetisation: n.timeToMonetisation,
        },
      })
    } else if (n.rejectionReason) {
      out.push({
        id: `niche-reject:${n.id}`,
        timestamp: n.createdAt.toISOString(),
        category: 'niche',
        decisionType: 'Niche Rejected',
        title: `Rejected niche: ${n.nicheName}`,
        description: `Composite score ${n.compositeScore.toFixed(1)}/10 — not selected.`,
        reasoning: n.rejectionReason,
        targetId: n.id,
        targetType: 'niche',
        impact: 'low',
        metadata: {
          compositeScore: n.compositeScore,
          isSelected: false,
        },
      })
    } else if (n.compositeScore >= 6) {
      // Surface only high-scoring analysed niches that weren't selected/rejected.
      out.push({
        id: `niche-analyse:${n.id}`,
        timestamp: n.createdAt.toISOString(),
        category: 'niche',
        decisionType: 'Niche Analysed',
        title: `Analysed niche: ${n.nicheName}`,
        description: `Scored ${n.compositeScore.toFixed(1)}/10 across 18 criteria (demand, audience, monetisation, risk, etc.).`,
        reasoning: n.notes ?? undefined,
        targetId: n.id,
        targetType: 'niche',
        impact: 'low',
        metadata: {
          compositeScore: n.compositeScore,
        },
      })
    }
  }
  return out
}

// ─── Source: ContentPillar ─────────────────────────────────────────
async function decisionsFromPillars(): Promise<Decision[]> {
  const pillars = await db.contentPillar.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const out: Decision[] = []
  for (const p of pillars) {
    out.push({
      id: `pillar:${p.id}`,
      timestamp: p.createdAt.toISOString(),
      category: 'strategy',
      decisionType: 'Content Pillar Created',
      title: `Created pillar: ${p.name}`,
      description:
        p.description ||
        `New content pillar (priority ${p.priority}, color ${p.color ?? 'none'}).`,
      targetId: p.id,
      targetType: 'pillar',
      impact: 'medium',
      metadata: {
        priority: p.priority,
        color: p.color ?? undefined,
        icon: p.icon ?? undefined,
      },
    })
  }
  return out
}

// ─── Source: VideoIdea ─────────────────────────────────────────────
async function decisionsFromIdeas(): Promise<Decision[]> {
  const ideas = await db.videoIdea.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { pillar: true },
  })
  const out: Decision[] = []
  for (const i of ideas) {
    const tags = safeParseJson<string[]>(i.tags) ?? []
    const isHighScore = i.compositeScore != null && i.compositeScore >= 7
    const hasTransition = i.status && i.status !== 'idea' && i.status !== 'new'

    out.push({
      id: `idea:${i.id}`,
      timestamp: i.createdAt.toISOString(),
      category: 'content',
      decisionType: 'Idea Generated',
      title: i.title,
      description: `Generated ${i.type} idea${i.pillar ? ` for pillar "${i.pillar.name}"` : ''}.`,
      targetId: i.id,
      targetType: 'idea',
      impact: isHighScore ? 'medium' : 'low',
      metadata: {
        status: i.status,
        compositeScore: i.compositeScore ?? undefined,
        tags: tags.slice(0, 6),
        pillarName: i.pillar?.name,
      },
    })

    // Status transition (researched → scripted → producing → …)
    if (hasTransition) {
      const labelMap: Record<string, string> = {
        researched: 'Idea Researched',
        scripted: 'Script Written',
        producing: 'Production Started',
        reviewing: 'Review Started',
        approved: 'Idea Approved',
        uploaded: 'Video Uploaded',
        published: 'Video Published',
        rejected: 'Idea Rejected',
      }
      const decisionType = labelMap[i.status] || `Status → ${i.status}`
      out.push({
        id: `idea-status:${i.id}:${i.status}`,
        timestamp: i.updatedAt.toISOString(),
        category:
          i.status === 'approved' || i.status === 'rejected'
            ? 'review'
            : i.status === 'uploaded' || i.status === 'published'
              ? 'upload'
              : 'production',
        decisionType,
        title: `${decisionType}: ${i.title}`,
        description: `Video idea moved to "${i.status}" state.`,
        targetId: i.id,
        targetType: 'idea',
        impact:
          i.status === 'approved' || i.status === 'rejected'
            ? 'high'
            : 'medium',
        metadata: {
          status: i.status,
          compositeScore: i.compositeScore ?? undefined,
        },
      })
    }
  }
  return out
}

// ─── Source: PolicyReview ──────────────────────────────────────────
async function decisionsFromPolicyReviews(): Promise<Decision[]> {
  const reviews = await db.policyReview.findMany({
    orderBy: { reviewedAt: 'desc' },
    take: 100,
    include: { videoProject: true },
  })
  const out: Decision[] = []
  for (const r of reviews) {
    const issues = safeParseJson<string[]>(r.issues) ?? []
    const projectTitle = r.videoProject?.title ?? 'Unknown video'
    const decisionType = r.overallPassed
      ? 'Video Approved'
      : 'Video Failed Review'
    out.push({
      id: `review:${r.id}`,
      timestamp: r.reviewedAt.toISOString(),
      category: 'review',
      decisionType,
      title: `${decisionType}: ${projectTitle}`,
      description: r.overallPassed
        ? 'Passed all 11 policy & quality checks (fact-check, originality, copyright, advertiser-friendly, AI disclosure, thumbnail/title accuracy, audio/video quality, captions, no deceptive content).'
        : `Failed ${issues.length} check${issues.length === 1 ? '' : 's'}: ${issues.slice(0, 3).join('; ')}${issues.length > 3 ? ` (+${issues.length - 3} more)` : ''}`,
      reasoning: issues.length > 0 ? issues.join('; ') : undefined,
      targetId: r.videoProjectId,
      targetType: 'project',
      impact: 'high',
      metadata: {
        overallPassed: r.overallPassed,
        issueCount: issues.length,
        issues: issues.slice(0, 6),
        checks: {
          factCheck: r.factCheckPassed,
          originality: r.originalityPassed,
          copyright: r.copyrightPassed,
          advertiserFriendly: r.advertiserFriendly,
          aiDisclosure: r.aiDisclosureSet,
          thumbnailAccurate: r.thumbnailAccurate,
          titleAccurate: r.titleAccurate,
          audioQuality: r.audioQualityOk,
          videoQuality: r.videoQualityOk,
          captions: r.captionsAccurate,
          noDeceptive: r.noDeceptiveContent,
        },
      },
    })
  }
  return out
}

// ─── Source: Channel ───────────────────────────────────────────────
async function decisionsFromChannels(): Promise<Decision[]> {
  const channels = await db.channel.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const out: Decision[] = []
  for (const c of channels) {
    out.push({
      id: `channel:${c.id}`,
      timestamp: c.createdAt.toISOString(),
      category: 'strategy',
      decisionType: 'Strategy Created',
      title: c.name
        ? `Channel strategy created: ${c.name}`
        : 'Channel strategy created',
      description:
        c.description ||
        c.positioning ||
        'Initial channel identity, positioning, and content strategy defined.',
      reasoning: c.brandPromise ?? undefined,
      targetId: c.id,
      targetType: 'channel',
      impact: 'high',
      metadata: {
        niche: c.niche ?? undefined,
        targetViewer: c.targetViewer ?? undefined,
        uploadCadence: c.uploadCadence ?? undefined,
      },
    })
  }
  return out
}

// ─── Main GET handler ──────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryParam = searchParams.get('category')
    const limitParam = Number(searchParams.get('limit')) || DEFAULT_LIMIT
    const limit = Math.min(Math.max(1, limitParam), HARD_LIMIT)

    // Validate category filter (if supplied).
    let categoryFilter: DecisionCategory | null = null
    if (categoryParam) {
      if (!VALID_CATEGORIES.has(categoryParam as DecisionCategory)) {
        return NextResponse.json(
          {
            error: `Invalid category. Valid: ${Array.from(VALID_CATEGORIES).join(', ')}`,
          },
          { status: 400 }
        )
      }
      categoryFilter = categoryParam as DecisionCategory
    }

    // Aggregate from all sources in parallel.
    const [
      auditDecisions,
      nicheDecisions,
      pillarDecisions,
      ideaDecisions,
      reviewDecisions,
      channelDecisions,
    ] = await Promise.all([
      decisionsFromAuditLog(),
      decisionsFromNiches(),
      decisionsFromPillars(),
      decisionsFromIdeas(),
      decisionsFromPolicyReviews(),
      decisionsFromChannels(),
    ])

    const all: Decision[] = [
      ...auditDecisions,
      ...nicheDecisions,
      ...pillarDecisions,
      ...ideaDecisions,
      ...reviewDecisions,
      ...channelDecisions,
    ]

    // De-duplicate by id (sources are disjoint but defensive).
    const seen = new Set<string>()
    const deduped = all.filter((d) => {
      if (seen.has(d.id)) return false
      seen.add(d.id)
      return true
    })

    // Sort newest first.
    deduped.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Compute counts over the FULL set (before category filter & limit).
    const byCategory: Record<string, number> = {}
    const now = Date.now()
    const DAY_MS = 24 * 60 * 60 * 1000
    let last24h = 0
    let last7d = 0
    for (const d of deduped) {
      byCategory[d.category] = (byCategory[d.category] ?? 0) + 1
      const t = new Date(d.timestamp).getTime()
      if (now - t <= DAY_MS) last24h++
      if (now - t <= 7 * DAY_MS) last7d++
    }

    const counts: DecisionCounts = {
      total: deduped.length,
      byCategory,
      last24h,
      last7d,
    }

    // Apply category filter & limit AFTER counts.
    let filtered = deduped
    if (categoryFilter) {
      filtered = filtered.filter((d) => d.category === categoryFilter)
    }
    const limited = filtered.slice(0, limit)

    return NextResponse.json({
      decisions: limited,
      counts,
    })
  } catch (err) {
    console.error('[/api/data/decisions] error:', err)
    return NextResponse.json(
      {
        error: 'Failed to aggregate decisions',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
