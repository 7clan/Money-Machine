import { NextRequest, NextResponse } from 'next/server'
import { stat, createReadStream } from 'fs'
import { existsSync } from 'fs'
import { promisify } from 'util'
import { db } from '@/lib/db'

const statAsync = promisify(stat)

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('id')
  if (!projectId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const project = await db.videoProject.findUnique({ where: { id: projectId } })
  if (!project?.videoFilePath) return NextResponse.json({ error: 'No video file' }, { status: 404 })

  if (!existsSync(project.videoFilePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  const fileStat = await statAsync(project.videoFilePath)
  const fileSize = fileStat.size

  // Handle HEAD request (just return file metadata)
  if (request.method === 'HEAD') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
      },
    })
  }

  // Parse Range header for seeking support
  const rangeHeader = request.headers.get('Range')

  if (rangeHeader) {
    // Format: "bytes=start-end"
    const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/)
    if (!match) {
      return new NextResponse('Invalid Range', { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } })
    }

    const start = parseInt(match[1], 10)
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1

    if (start >= fileSize || end >= fileSize || start > end) {
      return new NextResponse('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } })
    }

    const chunkSize = end - start + 1

    // Use Node.js ReadableStream for range requests
    const stream = createReadStream(project.videoFilePath, { start, end })

    // Convert Node Readable to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
        stream.on('end', () => controller.close())
        stream.on('error', (err) => controller.error(err))
      },
      cancel() {
        stream.destroy()
      },
    })

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
      },
    })
  }

  // Full file request (no range) — stream the entire file
  const stream = createReadStream(project.videoFilePath)
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      stream.on('end', () => controller.close())
      stream.on('error', (err) => controller.error(err))
    },
    cancel() {
      stream.destroy()
    },
  })

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
    },
  })
}
