import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('id')
  if (!projectId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const project = await db.videoProject.findUnique({ where: { id: projectId } })
  if (!project?.videoFilePath) return NextResponse.json({ error: 'No video file' }, { status: 404 })

  if (!existsSync(project.videoFilePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }

  const fileData = await readFile(project.videoFilePath)
  const fileStat = await stat(project.videoFilePath)

  return new NextResponse(fileData, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileStat.size),
    },
  })
}
