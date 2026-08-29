/**
 * GET /api/review/video?id=<videoId>
 *
 * Serves approved video files with HTTP range request support for browser seeking.
 *
 * SECURITY:
 *   - Only serves video IDs from the validated allowlist (data/review/video-inventory.json)
 *   - Resolves the physical path from the inventory, NEVER from user input
 *   - Validates the resolved path is within the project's data/ directory
 *   - Rejects ../ traversal, absolute paths, symlinks
 *   - Sets Content-Type: video/mp4
 *   - Supports HTTP Range requests for seeking
 */
import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, statSync, existsSync, realpathSync, readFileSync } from 'fs'
import path from 'path'
import { Readable } from 'stream'

const ROOT = process.cwd()
const INVENTORY_PATH = path.join(ROOT, 'data', 'review', 'video-inventory.json')
const DATA_DIR = path.join(ROOT, 'data')

function loadInventory(): any[] {
  try {
    const inv = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'))
    return inv.entries || []
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('id')
  if (!videoId) {
    return new NextResponse('Missing video id', { status: 400 })
  }

  const entries = loadInventory()
  const entry = entries.find((e: any) => e.id === videoId)
  if (!entry) {
    return new NextResponse('Video not found in inventory', { status: 404 })
  }
  if (!entry.exists || !entry.path) {
    return new NextResponse('Video file does not exist on disk', { status: 404 })
  }

  const filePath = entry.path as string

  // SECURITY: validate the path is within the project's data/ directory
  // and matches the realpath (no symlinks, no traversal)
  if (!existsSync(filePath)) {
    return new NextResponse('File not found', { status: 404 })
  }
  let realPath: string
  try {
    realPath = realpathSync(filePath)
  } catch {
    return new NextResponse('Invalid path', { status: 400 })
  }
  const realDataDir = realpathSync(DATA_DIR)
  if (!realPath.startsWith(realDataDir + path.sep) && realPath !== realDataDir) {
    return new NextResponse('Forbidden: path outside data directory', { status: 403 })
  }
  // Must be an MP4
  if (!realPath.endsWith('.mp4')) {
    return new NextResponse('Forbidden: not a video file', { status: 403 })
  }

  const stat = statSync(realPath)
  const fileSize = stat.size
  const range = request.headers.get('range')

  // Content-Type
  const headers: Record<string, string> = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  }

  if (range) {
    // Parse Range: bytes=start-end
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    if (!match) {
      return new NextResponse('Invalid range', { status: 416 })
    }
    const start = match[1] ? parseInt(match[1], 10) : 0
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
    if (start >= fileSize || end >= fileSize || start > end) {
      headers['Content-Range'] = `bytes */${fileSize}`
      return new NextResponse(null, { status: 416, headers })
    }
    const chunkSize = end - start + 1
    const stream = createReadStream(realPath, { start, end })
    headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`
    headers['Content-Length'] = String(chunkSize)
    const webStream = Readable.toWeb(stream) as ReadableStream
    return new NextResponse(webStream, { status: 206, headers })
  }

  // Full file (no range)
  headers['Content-Length'] = String(fileSize)
  const stream = createReadStream(realPath)
  const webStream = Readable.toWeb(stream) as ReadableStream
  return new NextResponse(webStream, { status: 200, headers })
}
