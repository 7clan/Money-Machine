import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export async function GET() {
  const [ideas, projects, uploads, scripts, reviews] = await Promise.all([
    db.videoIdea.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { pillar: true } }),
    db.videoProject.findMany({ orderBy: { updatedAt: 'desc' }, take: 20, include: { videoIdea: true } }),
    db.upload.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.script.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.policyReview.findMany({ orderBy: { reviewedAt: 'desc' }, take: 20 }),
  ])

  // Parse tags from JSON string to array for frontend consumption.
  // Prisma stores tags as String? (JSON array), so without this the frontend
  // receives a raw string and calling .map() on it throws "tags.map is not a function".
  const ideasWithParsedTags = ideas.map((idea) => ({
    ...idea,
    tags: parseTags(idea.tags),
  }))

  return NextResponse.json({ ideas: ideasWithParsedTags, projects, uploads, scripts, reviews })
}
