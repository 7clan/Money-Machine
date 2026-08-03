// ───────────────────────────────────────────────────────────────────
// CSV Export Endpoint — unified /api/data/export?type=<entity>
//
// Returns a `text/csv` response with a Content-Disposition attachment
// header so browsers download the file. All responses are prefixed with
// a UTF-8 BOM so Excel auto-detects UTF-8 encoding.
//
// Supported types:
//   ideas | projects | uploads | revenue | analytics | audit-logs | jobs
//
// Unknown types → 400.
// Empty result sets still return a header row.
// ───────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── Types ─────────────────────────────────────────────────────────

export type ExportType =
  | 'ideas'
  | 'projects'
  | 'uploads'
  | 'revenue'
  | 'analytics'
  | 'audit-logs'
  | 'jobs'

const VALID_TYPES: ReadonlySet<ExportType> = new Set<ExportType>([
  'ideas',
  'projects',
  'uploads',
  'revenue',
  'analytics',
  'audit-logs',
  'jobs',
])

// ─── CSV helpers ───────────────────────────────────────────────────

/** Escape a single CSV field per RFC 4180. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  let str: string
  if (value instanceof Date) {
    str = value.toISOString()
  } else if (typeof value === 'boolean') {
    str = value ? 'true' : 'false'
  } else if (typeof value === 'number') {
    str = Number.isFinite(value) ? String(value) : ''
  } else if (typeof value === 'object') {
    str = JSON.stringify(value)
  } else {
    str = String(value)
  }
  // Wrap in quotes if it contains comma, quote, newline, or carriage return.
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Build a CSV document (header + rows) from a 2D matrix. */
function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [headers.map(csvField).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvField).join(','))
  }
  // \r\n line endings per RFC 4180 — also makes Excel happy on Windows.
  return lines.join('\r\n')
}

/** Format a Date as YYYYMMDD-HHmmss (UTC) for filename use. */
function timestampForFilename(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  )
}

/** Build the Response object for a CSV payload. */
function csvResponse(type: string, csv: string): Response {
  const filename = `${type}-export-${timestampForFilename()}.csv`
  // Prefix with UTF-8 BOM so Excel decodes UTF-8 correctly.
  const body = `\uFEFF${csv}`
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

/** Parse a JSON string safely, returning the original string on failure. */
function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/** Parse an AuditLog `details` payload into a single readable string. */
function describeAuditDetails(details: string | null | undefined): string {
  if (!details) return ''
  const parsed = safeJsonParse(details)
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if ('message' in obj && typeof obj.message === 'string') {
      const message = obj.message
      const detail = obj.detail
      return detail ? `${message} — ${JSON.stringify(detail)}` : message
    }
    return JSON.stringify(obj)
  }
  return String(parsed)
}

/** Truncate a string to `max` chars, appending an ellipsis if cut. */
function truncate(str: string | null | undefined, max: number): string {
  if (!str) return ''
  if (str.length <= max) return str
  return str.slice(0, max) + '…'
}

/** Parse a JSON array of tags stored on VideoIdea/Upload. */
function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  const parsed = safeJsonParse(raw)
  if (Array.isArray(parsed)) {
    return parsed.filter((t): t is string => typeof t === 'string')
  }
  return []
}

// ─── Exporters ─────────────────────────────────────────────────────

const HEADERS: Record<ExportType, string[]> = {
  ideas: [
    'title',
    'type',
    'status',
    'pillar',
    'compositeScore',
    'searchVolume',
    'competitionScore',
    'originalityScore',
    'retentionPrediction',
    'revenuePotential',
    'productionEffort',
    'riskScore',
    'tags',
    'scheduledDate',
    'createdAt',
  ],
  projects: [
    'title',
    'status',
    'videoIdeaTitle',
    'durationSeconds',
    'fileSizeBytes',
    'resolution',
    'renderProgress',
    'isApproved',
    'reviewResult',
    'createdAt',
    'updatedAt',
  ],
  uploads: [
    'title',
    'youtubeVideoId',
    'privacy',
    'uploadStatus',
    'processingStatus',
    'category',
    'language',
    'madeForKids',
    'isAiGenerated',
    'publishedAt',
    'createdAt',
  ],
  revenue: [
    'type',
    'source',
    'amount',
    'currency',
    'date',
    'description',
    'isEstimated',
    'isFinalized',
    'uploadTitle',
  ],
  analytics: [
    'uploadTitle',
    'snapshotDate',
    'views',
    'impressions',
    'clickThroughRate',
    'averageViewDuration',
    'averagePercentageViewed',
    'subscribersGained',
    'likes',
    'comments',
    'shares',
    'estimatedRevenue',
    'rpm',
    'cpm',
  ],
  'audit-logs': ['createdAt', 'action', 'actor', 'target', 'details'],
  jobs: [
    'type',
    'status',
    'priority',
    'scheduledAt',
    'startedAt',
    'completedAt',
    'retryCount',
    'maxRetries',
    'error',
  ],
}

async function exportIdeas(): Promise<string> {
  const rows = await db.videoIdea.findMany({
    orderBy: { createdAt: 'desc' },
    include: { pillar: true },
  })
  const matrix = rows.map((r) => [
    r.title,
    r.type,
    r.status,
    r.pillar?.name ?? '',
    r.compositeScore,
    r.searchVolume,
    r.competitionScore,
    r.originalityScore,
    r.retentionPrediction,
    r.revenuePotential,
    r.productionEffort,
    r.riskScore,
    parseTags(r.tags).join(';'),
    r.scheduledDate,
    r.createdAt,
  ])
  return buildCsv(HEADERS.ideas, matrix)
}

async function exportProjects(): Promise<string> {
  const rows = await db.videoProject.findMany({
    orderBy: { createdAt: 'desc' },
    include: { videoIdea: true },
  })
  const matrix = rows.map((r) => [
    r.title,
    r.status,
    r.videoIdea?.title ?? '',
    r.duration,
    r.fileSize,
    r.resolution,
    r.renderProgress,
    r.isApproved,
    truncate(r.reviewResult ?? '', 500),
    r.createdAt,
    r.updatedAt,
  ])
  return buildCsv(HEADERS.projects, matrix)
}

async function exportUploads(): Promise<string> {
  const rows = await db.upload.findMany({ orderBy: { createdAt: 'desc' } })
  const matrix = rows.map((r) => [
    r.title,
    r.youtubeVideoId ?? '',
    r.privacy,
    r.uploadStatus,
    r.processingStatus ?? '',
    r.category,
    r.language,
    r.madeForKids,
    r.isAiGenerated,
    r.publishedAt,
    r.createdAt,
  ])
  return buildCsv(HEADERS.uploads, matrix)
}

async function exportRevenue(): Promise<string> {
  // RevenueRecord.uploadId is not a Prisma relation, so we resolve titles
  // manually with a single batched lookup against Upload.
  const records = await db.revenueRecord.findMany({
    orderBy: { date: 'desc' },
  })
  const uploadIds = Array.from(
    new Set(
      records
        .map((r) => r.uploadId)
        .filter((id): id is string => Boolean(id))
    )
  )
  const uploads =
    uploadIds.length > 0
      ? await db.upload.findMany({
          where: { id: { in: uploadIds } },
          select: { id: true, title: true },
        })
      : []
  const uploadTitleById = new Map<string, string>(
    uploads.map((u) => [u.id, u.title])
  )
  const matrix = records.map((r) => [
    r.type,
    r.source,
    r.amount,
    r.currency,
    r.date,
    r.description ?? '',
    r.isEstimated,
    r.isFinalized,
    r.uploadId ? (uploadTitleById.get(r.uploadId) ?? '') : '',
  ])
  return buildCsv(HEADERS.revenue, matrix)
}

async function exportAnalytics(): Promise<string> {
  const rows = await db.analyticsSnapshot.findMany({
    orderBy: { snapshotDate: 'desc' },
    include: { upload: true },
  })
  const matrix = rows.map((r) => [
    r.upload?.title ?? '',
    r.snapshotDate,
    r.views,
    r.impressions,
    r.clickThroughRate,
    r.averageViewDuration,
    r.averagePercentageViewed,
    r.subscribersGained,
    r.likes,
    r.comments,
    r.shares,
    r.estimatedRevenue,
    r.rpm,
    r.cpm,
  ])
  return buildCsv(HEADERS.analytics, matrix)
}

async function exportAuditLogs(): Promise<string> {
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' } })
  const matrix = rows.map((r) => [
    r.createdAt,
    r.action,
    r.actor,
    r.target ?? '',
    truncate(describeAuditDetails(r.details), 200),
  ])
  return buildCsv(HEADERS['audit-logs'], matrix)
}

async function exportJobs(): Promise<string> {
  const rows = await db.job.findMany({ orderBy: { scheduledAt: 'desc' } })
  const matrix = rows.map((r) => [
    r.type,
    r.status,
    r.priority,
    r.scheduledAt,
    r.startedAt,
    r.completedAt,
    r.retryCount,
    r.maxRetries,
    truncate(r.error ?? '', 200),
  ])
  return buildCsv(HEADERS.jobs, matrix)
}

// ─── Route handler ─────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawType = searchParams.get('type')
  if (!rawType) {
    return NextResponse.json(
      { error: "Missing required query parameter 'type'." },
      { status: 400 }
    )
  }
  if (!VALID_TYPES.has(rawType as ExportType)) {
    return NextResponse.json(
      {
        error: `Unknown export type '${rawType}'.`,
        validTypes: Array.from(VALID_TYPES),
      },
      { status: 400 }
    )
  }
  const type = rawType as ExportType

  try {
    let csv: string
    switch (type) {
      case 'ideas':
        csv = await exportIdeas()
        break
      case 'projects':
        csv = await exportProjects()
        break
      case 'uploads':
        csv = await exportUploads()
        break
      case 'revenue':
        csv = await exportRevenue()
        break
      case 'analytics':
        csv = await exportAnalytics()
        break
      case 'audit-logs':
        csv = await exportAuditLogs()
        break
      case 'jobs':
        csv = await exportJobs()
        break
    }
    return csvResponse(type, csv)
  } catch (err) {
    console.error(`[export] failed for type=${type}`, err)
    return NextResponse.json(
      { error: 'Failed to generate CSV export.', detail: String(err) },
      { status: 500 }
    )
  }
}
