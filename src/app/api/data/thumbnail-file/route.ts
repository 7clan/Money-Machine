import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('id')
  if (!projectId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const project = await db.videoProject.findUnique({ where: { id: projectId } })
  if (!project?.thumbnailPath) return NextResponse.json({ error: 'No thumbnail' }, { status: 404 })

  if (!existsSync(project.thumbnailPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const fileData = await readFile(project.thumbnailPath)

  return new NextResponse(fileData, {
    headers: { 'Content-Type': 'image/png' },
  })
}
