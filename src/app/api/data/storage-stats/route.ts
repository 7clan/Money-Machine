import { NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join, relative, extname } from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ───────────────────────────────────────────────────────────
type Category = 'videos' | 'audio' | 'thumbnails' | 'other'

interface CategoryStats {
  bytes: number
  files: number
  path: string
}

interface LargestFile {
  path: string
  bytes: number
  category: Category
}

interface StorageStats {
  totalBytes: number
  totalFiles: number
  byCategory: Record<Category, CategoryStats>
  largestFiles: LargestFile[]
  quotaBytes: number
  usagePercentage: number
  lastUpdated: string
}

// ─── Extension → Category map ────────────────────────────────────────
const EXT_TO_CATEGORY: Record<string, Category> = {
  // Videos
  '.mp4': 'videos',
  '.mov': 'videos',
  '.mkv': 'videos',
  '.webm': 'videos',
  '.avi': 'videos',
  // Audio
  '.mp3': 'audio',
  '.wav': 'audio',
  '.aac': 'audio',
  '.m4a': 'audio',
  '.flac': 'audio',
  '.ogg': 'audio',
  // Thumbnails (images)
  '.png': 'thumbnails',
  '.jpg': 'thumbnails',
  '.jpeg': 'thumbnails',
  '.webp': 'thumbnails',
  '.gif': 'thumbnails',
}

const CATEGORY_PATHS: Record<Category, string> = {
  videos: 'data/videos',
  audio: 'data/audio',
  thumbnails: 'data/thumbnails',
  other: 'data/(other)',
}

const QUOTA_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB

const DATA_DIR = '/home/z/my-project/data'

// ─── 60-second in-memory cache ──────────────────────────────────────
interface CacheEntry {
  stats: StorageStats
  timestamp: number
}

let cache: CacheEntry | null = null
const CACHE_TTL_MS = 60_000

function categorizeByPath(absPath: string, ext: string): Category {
  // Path-based override: if a file lives under data/videos, data/audio,
  // or data/thumbnails, classify by directory even when extension is unknown.
  const norm = absPath.replace(/\\/g, '/')
  if (norm.includes('/data/videos/')) return 'videos'
  if (norm.includes('/data/audio/')) return 'audio'
  if (norm.includes('/data/thumbnails/')) return 'thumbnails'
  return EXT_TO_CATEGORY[ext.toLowerCase()] ?? 'other'
}

async function walkDir(
  dir: string,
  onFile: (absPath: string, ext: string) => Promise<void>,
): Promise<void> {
  if (!existsSync(dir)) return
  let entries: import('fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name)
      try {
        if (entry.isDirectory()) {
          await walkDir(full, onFile)
        } else if (entry.isFile()) {
          await onFile(full, extname(entry.name))
        }
      } catch {
        // Skip unreadable entries
      }
    }),
  )
}

async function computeStats(): Promise<StorageStats> {
  const byCategory: Record<Category, CategoryStats> = {
    videos: { bytes: 0, files: 0, path: CATEGORY_PATHS.videos },
    audio: { bytes: 0, files: 0, path: CATEGORY_PATHS.audio },
    thumbnails: { bytes: 0, files: 0, path: CATEGORY_PATHS.thumbnails },
    other: { bytes: 0, files: 0, path: CATEGORY_PATHS.other },
  }

  const allFiles: LargestFile[] = []
  let totalBytes = 0
  let totalFiles = 0

  if (existsSync(DATA_DIR)) {
    await walkDir(DATA_DIR, async (absPath, ext) => {
      let s: { size: number }
      try {
        s = await stat(absPath)
      } catch {
        return
      }
      const category = categorizeByPath(absPath, ext)
      byCategory[category].bytes += s.size
      byCategory[category].files += 1
      totalBytes += s.size
      totalFiles += 1
      allFiles.push({
        path: relative(DATA_DIR, absPath).replace(/\\/g, '/'),
        bytes: s.size,
        category,
      })
    })
  }

  // Top 10 largest files, sorted desc
  allFiles.sort((a, b) => b.bytes - a.bytes)
  const largestFiles = allFiles.slice(0, 10)

  const usagePercentage =
    QUOTA_BYTES > 0 ? Math.min(100, (totalBytes / QUOTA_BYTES) * 100) : 0

  return {
    totalBytes,
    totalFiles,
    byCategory,
    largestFiles,
    quotaBytes: QUOTA_BYTES,
    usagePercentage: Math.round(usagePercentage * 100) / 100,
    lastUpdated: new Date().toISOString(),
  }
}

async function getStats(): Promise<StorageStats> {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.stats
  }
  const stats = await computeStats()
  cache = { stats, timestamp: now }
  return stats
}

export async function GET() {
  try {
    const stats = await getStats()
    return NextResponse.json(stats, {
      headers: {
        // Allow short browser caching for back-to-back requests while
        // still permitting fresh fetches after navigation.
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[storage-stats] failed to compute stats:', err)
    return NextResponse.json(
      {
        error,
        message: 'Failed to compute storage stats. Check server logs.',
      },
      { status: 500 },
    )
  }
}
