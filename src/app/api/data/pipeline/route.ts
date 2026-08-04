import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [ideas, projects, uploads, scripts, reviews] = await Promise.all([
    db.videoIdea.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { pillar: true } }),
    db.videoProject.findMany({ orderBy: { updatedAt: 'desc' }, take: 20, include: { videoIdea: true } }),
    db.upload.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.script.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    db.policyReview.findMany({ orderBy: { reviewedAt: 'desc' }, take: 20 }),
  ])

  return NextResponse.json({ ideas, projects, uploads, scripts, reviews })
}
