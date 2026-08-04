import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const jobs = await db.job.findMany({ orderBy: { scheduledAt: 'desc' }, take: 50 })
  return NextResponse.json(jobs)
}
