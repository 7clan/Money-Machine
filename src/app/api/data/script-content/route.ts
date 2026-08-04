import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const ideaId = request.nextUrl.searchParams.get('ideaId')
  if (!ideaId) return NextResponse.json({ error: 'ideaId required' }, { status: 400 })

  const scripts = await db.script.findMany({
    where: { videoIdeaId: ideaId },
    include: { scenes: { orderBy: { order: 'asc' } } },
    orderBy: { version: 'desc' },
  })

  return NextResponse.json(scripts)
}
