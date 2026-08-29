/**
 * AnalyticsAgent — fetches real YouTube Analytics data, persists AnalyticsSnapshot,
 * creates LearningSignal records when sufficient data exists.
 *
 * NEVER fabricates metrics. If the API returns no data (e.g., brand-new private
 * video), reports NO_DATA / PENDING_DATA.
 *
 * Requires yt-analytics.readonly scope (separate from youtube.upload).
 */
import { db } from '@/lib/db'
import { refreshAccessToken, getYouTubeConfig } from './youtube-client'

export interface AnalyticsFetchResult {
  status: 'PASS' | 'NO_DATA' | 'FAIL' | 'BLOCKED_SCOPE'
  reason: string
  videoId?: string
  snapshotId?: string
  learningSignalsCreated: number
  scopeVerified?: boolean
}

const REQUIRED_ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/yt-analytics.readonly'

/**
 * Verify the current OAuth token has the yt-analytics.readonly scope.
 * The scope string is stored on the OAuthConnection row.
 */
export async function verifyAnalyticsScope(): Promise<{ hasScope: boolean; grantedScopes: string }> {
  const conn = await db.oAuthConnection.findFirst({ where: { provider: 'google', isConnected: true } })
  if (!conn) return { hasScope: false, grantedScopes: '' }
  const grantedScopes = conn.scope || ''
  const hasScope = grantedScopes.split(/\s+/).some((s) => s === REQUIRED_ANALYTICS_SCOPE || s === 'yt-analytics.readonly')
  return { hasScope, grantedScopes }
}

export interface AnalyticsMetrics {
  views: number
  estimatedMinutesWatched: number
  averageViewDuration: number
  averagePercentageViewed: number
  subscribersGained: number
  likes: number
  comments: number
  shares: number
  impressions: number
  ctr: number // click-through rate (0-100)
}

async function fetchVideoAnalytics(accessToken: string, videoId: string): Promise<AnalyticsMetrics | null> {
  // YouTube Analytics API: reports.query
  // dimensions=video, filters=video==VIDEO_ID
  // metrics required: views,estimatedMinutesWatched,averageViewDuration,averagePercentageViewed,
  //                  subscribersGained,likes,comments,shares,impressions,ctr
  // endDate must be today or earlier; we use a 30-day window ending today
  const today = new Date()
  const end = today.toISOString().slice(0, 10)
  const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const url = `https://youtubeanalytics.googleapis.com/v2/reports?` +
    `ids=channel%3D%3DMINE&` +
    `start-date=${start}&end-date=${end}&` +
    `metrics=views%2CestimatedMinutesWatched%2CaverageViewDuration%2CaveragePercentageViewed%2CsubscribersGained%2Clikes%2Ccomments%2Cshares%2Cimpressions%2Cctr&` +
    `filters=video%3D%3D${videoId}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 403) {
    const body = await res.text()
    throw new Error(`ANALYTICS_403: ${body.slice(0, 300)}`)
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`ANALYTICS_${res.status}: ${body.slice(0, 300)}`)
  }
  const data: any = await res.json()
  // YouTube Analytics returns { columnHeaders: [...], rows: [[...]] }
  if (!data.rows || data.rows.length === 0) return null // NO_DATA
  const headers = (data.columnHeaders || []).map((h: any) => h.name)
  const row = data.rows[0]
  const get = (name: string): number => {
    const idx = headers.indexOf(name)
    return idx >= 0 ? Number(row[idx]) || 0 : 0
  }
  return {
    views: get('views'),
    estimatedMinutesWatched: get('estimatedMinutesWatched'),
    averageViewDuration: get('averageViewDuration'),
    averagePercentageViewed: get('averagePercentageViewed'),
    subscribersGained: get('subscribersGained'),
    likes: get('likes'),
    comments: get('comments'),
    shares: get('shares'),
    impressions: get('impressions'),
    ctr: get('ctr'),
  }
}

/**
 * Fetch analytics for a video, persist AnalyticsSnapshot, create LearningSignals.
 */
export async function fetchAndPersistAnalytics(videoId: string): Promise<AnalyticsFetchResult> {
  // 1. Verify scope
  const { hasScope, grantedScopes } = await verifyAnalyticsScope()
  if (!hasScope) {
    return {
      status: 'BLOCKED_SCOPE',
      reason: `OAuth token lacks yt-analytics.readonly scope. Granted scopes: "${grantedScopes}". Reconnect YouTube Analytics to authorize.`,
      videoId,
      learningSignalsCreated: 0,
      scopeVerified: false,
    }
  }

  // 2. Get a valid access token
  const conn = await db.oAuthConnection.findFirst({ where: { provider: 'google', isConnected: true } })
  if (!conn || !conn.refreshToken) {
    return { status: 'FAIL', reason: 'No connected YouTube account', videoId, learningSignalsCreated: 0, scopeVerified: true }
  }
  const tok = await refreshAccessToken(conn.refreshToken)
  const accessToken = tok.accessToken

  // 3. Fetch the analytics
  let metrics: AnalyticsMetrics | null
  try {
    metrics = await fetchVideoAnalytics(accessToken, videoId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'FAIL', reason: `Analytics API request failed: ${msg}`, videoId, learningSignalsCreated: 0, scopeVerified: true }
  }

  if (!metrics) {
    return {
      status: 'NO_DATA',
      reason: 'YouTube Analytics API returned no rows. Video may be brand-new, private, or have no views yet.',
      videoId,
      learningSignalsCreated: 0,
      scopeVerified: true,
    }
  }

  // 4. Find the Upload row for this videoId
  const upload = await db.upload.findFirst({ where: { youtubeVideoId: videoId } })
  if (!upload) {
    return { status: 'FAIL', reason: `No Upload row found for videoId=${videoId}`, videoId, learningSignalsCreated: 0, scopeVerified: true }
  }

  // 5. Persist AnalyticsSnapshot
  const snapshot = await db.analyticsSnapshot.create({
    data: {
      uploadId: upload.id,
      views: metrics.views,
      impressions: metrics.impressions,
      clickThroughRate: metrics.ctr,
      averageViewDuration: metrics.averageViewDuration,
      averagePercentageViewed: metrics.averagePercentageViewed,
      subscribersGained: metrics.subscribersGained,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      estimatedRevenue: 0, // not available via yt-analytics.readonly; would need yt-analytics-monetary.readonly
      rpm: 0,
      cpm: 0,
      trafficSources: null,
      audienceRetention: null,
      searchTerms: null,
    },
  })

  // 6. Create LearningSignals only if there's enough signal to learn from
  //    (e.g., at least 100 impressions + at least 1 view)
  let learningSignalsCreated = 0
  if (metrics.impressions >= 100 && metrics.views >= 1) {
    // CTR learning signal
    if (metrics.ctr > 0) {
      await db.learningSignal.create({
        data: {
          videoId,
          productionId: upload.videoProjectId,
          targetType: 'thumbnail',
          targetId: videoId,
          metric: 'ctr',
          observation: `CTR=${metrics.ctr.toFixed(2)}% on ${metrics.impressions} impressions`,
          evidence: JSON.stringify({ ctr: metrics.ctr, impressions: metrics.impressions, views: metrics.views }),
          confidence: Math.min(1, metrics.impressions / 1000), // higher confidence with more impressions
          proposedAdjustment: metrics.ctr < 2 ? 'Thumbnail underperforming — test alternative concept' : 'Thumbnail performing acceptably',
          source: 'PLATFORM_REPORTED',
        },
      })
      learningSignalsCreated++
    }
    // AVD learning signal
    if (metrics.averageViewDuration > 0) {
      await db.learningSignal.create({
        data: {
          videoId,
          productionId: upload.videoProjectId,
          targetType: 'script',
          targetId: videoId,
          metric: 'averageViewDuration',
          observation: `AVD=${metrics.averageViewDuration.toFixed(1)}s (${metrics.averagePercentageViewed.toFixed(1)}% of video)`,
          evidence: JSON.stringify({ averageViewDuration: metrics.averageViewDuration, averagePercentageViewed: metrics.averagePercentageViewed }),
          confidence: Math.min(1, metrics.views / 100),
          proposedAdjustment: metrics.averagePercentageViewed < 40 ? 'Retention low — review hook + first 15s' : 'Retention acceptable',
          source: 'PLATFORM_REPORTED',
        },
      })
      learningSignalsCreated++
    }
  }

  return {
    status: 'PASS',
    reason: `AnalyticsSnapshot persisted (id=${snapshot.id}). ${learningSignalsCreated} LearningSignals created.`,
    videoId,
    snapshotId: snapshot.id,
    learningSignalsCreated,
    scopeVerified: true,
  }
}
