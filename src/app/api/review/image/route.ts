/**
 * GET /api/review/image?id=<videoId>&type=thumbnail|contactSheet
 *
 * Serves approved thumbnail/contact-sheet images from the validated inventory.
 * Same security model as /api/review/video — allowlist only, no user-supplied paths.
 */
import { NextRequest, NextResponse } from 'next/server'
import { existsSync, realpathSync, createReadStream, statSync, readFileSync } from 'fs'
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
  const imgType = request.nextUrl.searchParams.get('type') || 'thumbnail'
  if (!videoId) {
    return new NextResponse('Missing video id', { status: 400 })
  }

  const entries = loadInventory()
  const entry = entries.find((e: any) => e.id === videoId)
  if (!entry) {
    return new NextResponse('Video not found in inventory', { status: 404 })
  }

  const filePath = imgType === 'contactSheet' ? entry.contactSheetPath : entry.thumbnailPath
  if (!filePath || !existsSync(filePath)) {
    return new NextResponse('Image not available', { status: 404 })
  }

  // SECURITY: validate path is within data/
  let realPath: string
  try {
    realPath = realpathSync(filePath)
  } catch {
    return new NextResponse('Invalid path', { status: 400 })
  }
  const realDataDir = realpathSync(DATA_DIR)
  if (!realPath.startsWith(realDataDir + path.sep)) {
    return new NextResponse('Forbidden: path outside data directory', { status: 403 })
  }
  if (!realPath.endsWith('.png') && !realPath.endsWith('.jpg') && !realPath.endsWith('.jpeg')) {
    return new NextResponse('Forbidden: not an image file', { status: 403 })
  }

  const stat = statSync(realPath)
  const ext = realPath.endsWith('.png') ? 'image/png' : 'image/jpeg'
  const stream = createReadStream(realPath)
  const webStream = Readable.toWeb(stream) as ReadableStream
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': ext,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
