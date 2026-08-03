import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ───────────────────────────────────────────────────────────────────
// /api/data/decisions/stats
//
// Aggregate stats for the Decision Log:
//   • decisionsPerDay: 30-day rolling window of decision counts by day
//   • topDecisionTypes: top 8 decisionType strings by frequency
//   • categoryDistribution: count per DecisionCategory
//
// Mirrors the same source logic as /api/data/decisions/route.ts but
// only emits aggregate counts (no row payload) so the dashboard can
// render trend / breakdown charts cheaply.
// ───────────────────────────────────────────────────────────────────

interface DayBucket {
  date: string // YYYY-MM-DD
  label: string // e.g. "Aug 3"
  count: number
}

interface DecisionStats {
  decisionsPerDay: DayBucket[]
  topDecisionTypes: { type: string; count: number }[]
  categoryDistribution: { category: string; count: number }[]
  total: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Format a Date as YYYY-MM-DD (UTC) — stable bucket key across TZs. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Format a Date as "Aug 3" — short human label for the chart axis. */
function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** Parse legacy (string) or new (JSON {message, detail}) audit log detail. */
function parseAuditMessage(raw: string | null): string {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      return parsed.message ?? ''
    }
  } catch {
    /* fall through */
  }
  return String(raw)
}

/** Map an AuditLog action to a unified DecisionCategory (or null to skip). */
function categoryForAuditAction(action: string): string | null {
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

interface RawRow {
  timestamp: Date
  category: string
  decisionType: string
}

async function gatherRawRows(): Promise<RawRow[]> {
  const rows: RawRow[] = []

  // AuditLog
  const logs = await db.auditLog.findMany({ take: 500 })
  for (const l of logs) {
    const cat = categoryForAuditAction(l.action)
    if (!cat) continue
    rows.push({
      timestamp: l.createdAt,
      category: cat,
      decisionType: decisionTypeForAction(l.action),
    })
  }

  // NicheAnalysis
  const niches = await db.nicheAnalysis.findMany({ take: 200 })
  for (const n of niches) {
    if (n.isSelected) {
      rows.push({
        timestamp: n.createdAt,
        category: 'niche',
        decisionType: 'Niche Selected',
      })
    } else if (n.rejectionReason) {
      rows.push({
        timestamp: n.createdAt,
        category: 'niche',
        decisionType: 'Niche Rejected',
      })
    } else if (n.compositeScore >= 6) {
      rows.push({
        timestamp: n.createdAt,
        category: 'niche',
        decisionType: 'Niche Analysed',
      })
    }
  }

  // ContentPillar
  const pillars = await db.contentPillar.findMany({ take: 100 })
  for (const p of pillars) {
    rows.push({
      timestamp: p.createdAt,
      category: 'strategy',
      decisionType: 'Content Pillar Created',
    })
  }

  // VideoIdea (generation + status transitions)
  const ideas = await db.videoIdea.findMany({ take: 500 })
  for (const i of ideas) {
    rows.push({
      timestamp: i.createdAt,
      category: 'content',
      decisionType: 'Idea Generated',
    })
    if (i.status && i.status !== 'idea' && i.status !== 'new') {
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
      const cat =
        i.status === 'approved' || i.status === 'rejected'
          ? 'review'
          : i.status === 'uploaded' || i.status === 'published'
            ? 'upload'
            : 'production'
      rows.push({
        timestamp: i.updatedAt,
        category: cat,
        decisionType,
      })
    }
  }

  // PolicyReview
  const reviews = await db.policyReview.findMany({ take: 200 })
  for (const r of reviews) {
    rows.push({
      timestamp: r.reviewedAt,
      category: 'review',
      decisionType: r.overallPassed ? 'Video Approved' : 'Video Failed Review',
    })
  }

  // Channel
  const channels = await db.channel.findMany({ take: 20 })
  for (const c of channels) {
    rows.push({
      timestamp: c.createdAt,
      category: 'strategy',
      decisionType: 'Strategy Created',
    })
  }

  return rows
}

export async function GET() {
  try {
    const rows = await gatherRawRows()

    // ── 30-day rolling window ──
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const buckets: DayBucket[] = []
    const bucketMap = new Map<string, number>()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * DAY_MS)
      const key = dayKey(d)
      bucketMap.set(key, 0)
      buckets.push({ date: key, label: dayLabel(d), count: 0 })
    }
    for (const r of rows) {
      const d = new Date(r.timestamp)
      d.setUTCHours(0, 0, 0, 0)
      const key = dayKey(d)
      const cur = bucketMap.get(key)
      if (cur != null) {
        bucketMap.set(key, cur + 1)
      }
    }
    for (const b of buckets) {
      b.count = bucketMap.get(b.date) ?? 0
    }

    // ── Top decision types ──
    const typeCounts = new Map<string, number>()
    for (const r of rows) {
      typeCounts.set(r.decisionType, (typeCounts.get(r.decisionType) ?? 0) + 1)
    }
    const topDecisionTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // ── Category distribution ──
    const catCounts = new Map<string, number>()
    for (const r of rows) {
      catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1)
    }
    // Pre-seed all known categories so the chart always has every slice.
    const ALL_CATS = [
      'niche',
      'strategy',
      'content',
      'production',
      'review',
      'upload',
      'system',
      'mode',
    ]
    for (const c of ALL_CATS) {
      if (!catCounts.has(c)) catCounts.set(c, 0)
    }
    const categoryDistribution = Array.from(catCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)

    const stats: DecisionStats = {
      decisionsPerDay: buckets,
      topDecisionTypes,
      categoryDistribution,
      total: rows.length,
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('[/api/data/decisions/stats] error:', err)
    return NextResponse.json(
      {
        error: 'Failed to compute decision stats',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
