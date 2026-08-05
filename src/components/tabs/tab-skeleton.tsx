'use client'

import React from 'react'

/** Skeleton shown while a lazy-loaded tab chunk is being fetched */
export function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Top row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-32 rounded-xl bg-slate-800/40 border border-slate-700/30" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="h-48 rounded-xl bg-slate-800/40 border border-slate-700/30" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="h-64 rounded-xl bg-slate-800/40 border border-slate-700/30" />
        <div className="h-64 rounded-xl bg-slate-800/40 border border-slate-700/30" />
      </div>
    </div>
  )
}
