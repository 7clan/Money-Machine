/**
 * Chart Component — animated data visualization
 *
 * Renders an animated bar/line chart based on the beat's narration.
 * Extracts numbers from the narration and animates them building up.
 */

import React from 'react'
import { AbsoluteFill, interpolate, Easing, useCurrentFrame } from 'remotion'
import type { StoryBeat } from '../../engine/v3/types'

interface ChartComponentProps {
  beat: StoryBeat
  frame: number
  fps: number
  durationFrames: number
}

export const ChartComponent: React.FC<ChartComponentProps> = ({ beat, frame, durationFrames }) => {
  // Extract numbers from narration for the chart
  const numbers = (beat.narration.match(/\d+\.?\d*/g) || []).map(Number).slice(0, 5)
  const hasNumbers = numbers.length > 0

  // Animate chart build-up
  const buildProgress = interpolate(frame, [0, Math.min(45, durationFrames * 0.5)], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })

  // Sample chart data — use extracted numbers or a sensible default
  const chartData = hasNumbers ? numbers : [49.4, 28.2, 18.0, 13.8]
  const labels = ['2007', '2010', '2012', '2013']
  const maxValue = Math.max(...chartData) * 1.1

  const barWidth = 120
  const barGap = 60
  const chartHeight = 500
  const startY = 600

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      {/* Title */}
      <div style={{
        position: 'absolute', top: 100, left: 100,
        color: '#ffffff', fontSize: 48, fontWeight: 'bold', fontFamily: 'Arial',
      }}>
        {beat.title || beat.narration.slice(0, 40)}
      </div>

      {/* Chart bars */}
      <div style={{ position: 'absolute', top: startY - chartHeight, left: 200, display: 'flex', alignItems: 'flex-end', gap: barGap }}>
        {chartData.map((value, i) => {
          const fullHeight = (value / maxValue) * chartHeight
          const animatedHeight = fullHeight * interpolate(
            buildProgress,
            [i * 0.15, i * 0.15 + 0.4],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          )
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: barWidth,
                height: Math.max(2, animatedHeight),
                backgroundColor: i === 0 ? '#ff3d57' : '#3b82f6',
                borderRadius: '4px 4px 0 0',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                paddingTop: 10,
              }}>
                <span style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold', opacity: animatedHeight > 60 ? 1 : 0 }}>
                  {value}%
                </span>
              </div>
              <span style={{ color: '#9ca3af', fontSize: 20, marginTop: 10, fontFamily: 'Arial' }}>
                {labels[i] || `Q${i + 1}`}
              </span>
            </div>
          )
        })}
      </div>

      {/* Y-axis gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: startY - chartHeight * p,
          left: 150, right: 100,
          height: 1,
          backgroundColor: '#1f2937',
        }} />
      ))}

      {/* Source attribution */}
      <div style={{
        position: 'absolute', bottom: 40, left: 100,
        color: '#6b7280', fontSize: 16, fontFamily: 'Arial',
      }}>
        Source: market data
      </div>
    </AbsoluteFill>
  )
}
