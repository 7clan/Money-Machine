import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [records, summary] = await Promise.all([
    db.revenueRecord.findMany({ orderBy: { date: 'desc' }, take: 50 }),
    db.revenueRecord.groupBy({
      by: ['type'],
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const totalEstimated = records
    .filter(r => r.isEstimated)
    .reduce((sum, r) => sum + r.amount, 0)

  const totalFinalized = records
    .filter(r => r.isFinalized)
    .reduce((sum, r) => sum + r.amount, 0)

  return NextResponse.json({
    records,
    summary: summary.map(s => ({
      type: s.type,
      total: s._sum.amount || 0,
      count: s._count,
    })),
    totals: {
      estimated: totalEstimated,
      finalized: totalFinalized,
      currency: 'USD',
    },
  })
}
