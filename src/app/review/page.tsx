'use client'

import { useEffect, useState } from 'react'

interface VideoEntry {
  id: string
  name: string
  format: string
  category: 'APPROVED' | 'DEVELOPMENT' | 'SUPERSEDED' | 'MISSING'
  status: string
  path: string
  exists: boolean
  duration: number | null
  resolution: string | null
  sizeMB: number | null
  factCheckStatus: string | null
  qcStatus: string | null
  youtubeVideoId: string | null
  youtubePrivacy: string | null
  thumbnailPath: string | null
  contactSheetPath: string | null
  superseded: boolean
  supersededBy: string | null
  notes: string
  playbackSource: 'OFF_MACHINE' | 'LOCAL_STORE' | 'LOCAL' | 'YOUTUBE' | 'NONE'
  storageStatus: string | null
  artifactId: string | null
}

function formatDuration(sec: number | null): string {
  if (sec === null) return 'N/A'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function VideoCard({ entry }: { entry: VideoEntry }) {
  const isVertical = entry.format === 'SHORT' || entry.resolution === '720x1280' || entry.resolution === '1080x1920'
  const playerMaxWidth = isVertical ? '270px' : '640px'
  const playerMaxHeight = isVertical ? '480px' : '360px'

  return (
    <div
      style={{
        border: entry.exists ? '2px solid #10b981' : '2px solid #ef4444',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        background: entry.superseded ? '#1a1a1a' : '#0f172a',
        opacity: entry.superseded ? 0.85 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: entry.superseded ? '#94a3b8' : '#f1f5f9' }}>
          {entry.superseded && <span style={{ color: '#ef4444', marginRight: '8px' }}>SUPERSEDED</span>}
          {entry.name}
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {entry.category === 'APPROVED' && entry.exists && (
            <span style={{ background: '#10b981', color: '#000', padding: '2px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>APPROVED</span>
          )}
          {entry.category === 'SUPERSEDED' && (
            <span style={{ background: '#ef4444', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>SUPERSEDED</span>
          )}
          {entry.category === 'DEVELOPMENT' && (
            <span style={{ background: '#6366f1', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>DEV</span>
          )}
          {!entry.exists && (
            <span style={{ background: '#ef4444', color: '#fff', padding: '2px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>MISSING</span>
          )}
        </div>
      </div>

      {entry.exists ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', background: '#000', borderRadius: '8px', padding: '8px' }}>
          <video
            controls
            preload="metadata"
            style={{ maxWidth: playerMaxWidth, maxHeight: playerMaxHeight, width: '100%', borderRadius: '4px' }}
            src={`/api/review/video?id=${encodeURIComponent(entry.id)}`}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      ) : entry.playbackSource === 'YOUTUBE' && entry.youtubeVideoId ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', background: '#000', borderRadius: '8px', padding: '8px' }}>
          <iframe
            width={isVertical ? '270' : '640'}
            height={isVertical ? '480' : '360'}
            src={`https://www.youtube.com/embed/${entry.youtubeVideoId}`}
            title={entry.name}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ maxWidth: '100%', borderRadius: '4px' }}
          />
        </div>
      ) : (
        <div style={{ background: '#1a0000', border: '1px dashed #ef4444', borderRadius: '8px', padding: '24px', textAlign: 'center', marginBottom: '16px' }}>
          <p style={{ color: '#ef4444', margin: 0, fontSize: '14px' }}>
            ⚠️ Video file does not exist on disk. See notes below.
          </p>
        </div>
      )}

      {/* Playback source badge */}
      <div style={{ marginBottom: '8px', fontSize: '11px' }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '4px',
          fontWeight: 600,
          marginRight: '6px',
          background: entry.playbackSource === 'OFF_MACHINE' ? '#10b981' : entry.playbackSource === 'LOCAL_STORE' ? '#3b82f6' : entry.playbackSource === 'LOCAL' ? '#6366f1' : entry.playbackSource === 'YOUTUBE' ? '#ef4444' : '#6b7280',
          color: entry.playbackSource === 'NONE' ? '#fff' : '#000',
        }}>
          {entry.playbackSource === 'OFF_MACHINE' && '▣ OFF_MACHINE'}
          {entry.playbackSource === 'LOCAL_STORE' && '▣ LOCAL_STORE'}
          {entry.playbackSource === 'LOCAL' && '▣ LOCAL'}
          {entry.playbackSource === 'YOUTUBE' && '▶ YOUTUBE'}
          {entry.playbackSource === 'NONE' && '✕ NONE'}
        </span>
        {entry.storageStatus && (
          <span style={{ color: '#94a3b8' }}>storage: {entry.storageStatus}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
        <div><strong style={{ color: '#94a3b8' }}>Format:</strong> {entry.format}</div>
        <div><strong style={{ color: '#94a3b8' }}>Duration:</strong> {formatDuration(entry.duration)}</div>
        <div><strong style={{ color: '#94a3b8' }}>Resolution:</strong> {entry.resolution || 'N/A'}</div>
        <div><strong style={{ color: '#94a3b8' }}>Size:</strong> {entry.sizeMB !== null ? `${entry.sizeMB} MB` : 'N/A'}</div>
        <div><strong style={{ color: '#94a3b8' }}>FactCheck:</strong> {entry.factCheckStatus || 'N/A'}</div>
        <div><strong style={{ color: '#94a3b8' }}>QC:</strong> {entry.qcStatus || 'N/A'}</div>
        {entry.youtubeVideoId && (
          <div><strong style={{ color: '#94a3b8' }}>YouTube:</strong> {entry.youtubePrivacy || 'unknown'} ({entry.youtubeVideoId})</div>
        )}
        {entry.supersededBy && (
          <div><strong style={{ color: '#94a3b8' }}>Superseded by:</strong> {entry.supersededBy}</div>
        )}
      </div>

      {entry.notes && (
        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px', fontStyle: 'italic' }}>{entry.notes}</p>
      )}

      {entry.youtubeVideoId && entry.youtubePrivacy === 'private' && (
        <a
          href={`https://www.youtube.com/watch?v=${entry.youtubeVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: '12px',
            padding: '8px 16px',
            background: '#ef4444',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ▶ OPEN PRIVATE YOUTUBE VIDEO
        </a>
      )}
    </div>
  )
}

export default function ReviewPage() {
  const [inventory, setInventory] = useState<{ entries: VideoEntry[]; generatedAt: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/review/inventory')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setInventory(data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading video inventory...</p>
      </div>
    )
  }

  if (error || !inventory) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>Failed to load inventory</p>
          <p style={{ fontSize: '14px' }}>{error}</p>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px' }}>Run: bunx tsx scripts/review/generate-inventory.ts</p>
        </div>
      </div>
    )
  }

  // Approved = category APPROVED AND file physically exists on disk
  const approved = inventory.entries.filter((e) => e.category === 'APPROVED' && e.exists)
  const superseded = inventory.entries.filter((e) => e.category === 'SUPERSEDED')
  const development = inventory.entries.filter((e) => e.category === 'DEVELOPMENT')
  // Missing = file doesn't exist AND it's not a development regression test
  const missing = inventory.entries.filter((e) => !e.exists && e.category !== 'DEVELOPMENT')

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f1f5f9', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px', color: '#f1f5f9' }}>
          MONEY MACHINE — HUMAN REVIEW
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '32px' }}>
          Internal review tool. All videos served read-only from validated inventory.{' '}
          Generated: {new Date(inventory.generatedAt).toLocaleString()}
        </p>

        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#10b981', borderBottom: '1px solid #10b981', paddingBottom: '8px' }}>
          APPROVED PRODUCTIONS
        </h2>
        {approved.length === 0 ? (
          <div style={{ background: '#1a1a1a', border: '1px dashed #475569', borderRadius: '8px', padding: '20px', marginBottom: '32px' }}>
            <p style={{ color: '#94a3b8', margin: 0 }}>
              No playable video files found on disk. All productions were either uploaded to YouTube (watch via links below) or removed during workspace cleanup. See MISSING section for details.
            </p>
          </div>
        ) : (
          approved.map((e) => <VideoCard key={e.id} entry={e} />)
        )}

        {missing.length > 0 && (
          <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#f59e0b', borderBottom: '1px solid #f59e0b', paddingBottom: '8px', marginTop: '40px' }}>
              MISSING (reported but not on disk)
            </h2>
            {missing.map((e) => <VideoCard key={e.id} entry={e} />)}
          </>
        )}

        {superseded.length > 0 && (
          <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#ef4444', borderBottom: '1px solid #ef4444', paddingBottom: '8px', marginTop: '40px' }}>
              DEVELOPMENT / SUPERSEDED
            </h2>
            {superseded.map((e) => <VideoCard key={e.id} entry={e} />)}
          </>
        )}

        {development.length > 0 && (
          <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#6366f1', borderBottom: '1px solid #6366f1', paddingBottom: '8px', marginTop: '40px' }}>
              REGRESSION TEST ARTIFACTS
            </h2>
            {development.map((e) => <VideoCard key={e.id} entry={e} />)}
          </>
        )}

        <div style={{ marginTop: '40px', padding: '16px', background: '#1a1a1a', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
          <p style={{ margin: '0 0 4px 0' }}><strong>Security:</strong> Video serving is allowlist-only. Paths resolved from inventory, never from user input. ../ traversal, symlinks, and non-data/ paths are rejected.</p>
          <p style={{ margin: 0 }}><strong>Range requests:</strong> Supported for browser seeking (HTTP 206 partial content).</p>
        </div>
      </div>
    </div>
  )
}
