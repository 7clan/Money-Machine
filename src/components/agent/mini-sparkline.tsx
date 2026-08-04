'use client'

import React from 'react'

// ─── Types ─────────────────────────────────────────────────────────
interface MiniSparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

// ─── Mini Sparkline ────────────────────────────────────────────────
// A tiny SVG-based line chart for inline use in stat cards.
// Uses smooth curves via quadratic Bézier approximation.
export function MiniSparkline({
  data,
  color = '#10b981',
  width = 60,
  height = 20,
}: MiniSparklineProps) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1 // Avoid division by zero

  const padding = 1
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  // Map data points to SVG coordinates
  const points = data.map((value, i) => ({
    x: padding + (i / (data.length - 1)) * chartWidth,
    y: padding + chartHeight - ((value - min) / range) * chartHeight,
  }))

  // Build smooth SVG path using quadratic Bézier curves
  let path = `M ${points[0].x} ${points[0].y}`

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const midX = (prev.x + curr.x) / 2
    const midY = (prev.y + curr.y) / 2

    if (i === 1) {
      // First segment: simple line to midpoint, then curve
      path += ` L ${midX} ${midY}`
    } else {
      // Subsequent segments: quadratic curve through midpoints
      path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`
    }
  }

  // Last segment to final point
  const last = points[points.length - 1]
  const secondLast = points[points.length - 2]
  path += ` Q ${secondLast.x} ${secondLast.y} ${last.x} ${last.y}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      {/* Gradient fill under line */}
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Fill area */}
      <path
        d={`${path} L ${last.x} ${height} L ${points[0].x} ${height} Z`}
        fill={`url(#spark-grad-${color.replace('#', '')})`}
      />

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      <circle
        cx={last.x}
        cy={last.y}
        r={1.5}
        fill={color}
      />
    </svg>
  )
}
