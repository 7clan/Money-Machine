import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [analytics, revenue, ypp] = await Promise.all([
    db.analyticsSnapshot.findMany({ orderBy: { snapshotDate: 'desc' }, take: 50 }),
    db.revenueRecord.findMany({ orderBy: { date: 'desc' }, take: 50 }),
    db.yPPProgress.findFirst(),
  ])

  return NextResponse.json({ analytics, revenue, ypp })
}
