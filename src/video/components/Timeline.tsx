/**
 * Timeline Component — events move through time
 *
 * Renders a horizontal timeline with year markers. An indicator moves
 * across the timeline as the scene plays, highlighting the current event.
 */

import React from 'react'
import { AbsoluteFill, interpolate, Easing } from 'remotion'
import type { StoryBeat } from '../../engine/v3/types'

interface TimelineComponentProps {
  beat: StoryBeat
  frame: number
  fps: number
  durationFrames: number
}

export const TimelineComponent: React.FC<TimelineComponentProps> = ({ beat, frame, durationFrames }) => {
  // Extract years from narration
  const years = (beat.narration.match(/\b(19|20)\d{2}\b/g) || []).slice(0, 6)
  const hasYears = years.length > 0

  // Timeline events
  const events = hasYears ? years.map((y, i) => ({ year: y, label: `Event ${i + 1}` })) : [
    { year: '2007', label: 'iPhone launch' },
    { year: '2010', label: 'Android rises' },
    { year: '2011', label: 'Microsoft deal' },
    { year: '2013', label: 'Nokia sold' },
  ]

  const timelineWidth = 1600
  const timelineStartX = 160
  const timelineY = 540

  // Animate the playhead across the timeline
  const playheadProgress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  })

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      {/* Title */}
      <div style={{
        position: 'absolute', top: 120, left: 160,
        color: '#ffffff', fontSize: 44, fontWeight: 'bold', fontFamily: 'Arial',
      }}>
        {beat.title || 'Timeline'}
      </div>

      {/* Timeline track */}
      <div style={{
        position: 'absolute',
        top: timelineY,
        left: timelineStartX,
        width: timelineWidth,
        height: 4,
        backgroundColor: '#1f2937',
      }} />

      {/* Progress overlay */}
      <div style={{
        position: 'absolute',
        top: timelineY,
        left: timelineStartX,
        width: timelineWidth * playheadProgress,
        height: 4,
        backgroundColor: '#ff3d57',
      }} />

      {/* Year markers */}
      {events.map((event, i) => {
        const x = timelineStartX + (timelineWidth / Math.max(events.length - 1, 1)) * i
        const isActive = playheadProgress >= (i / Math.max(events.length - 1, 1)) - 0.1 &&
                         playheadProgress <= (i / Math.max(events.length - 1, 1)) + 0.15
        return (
          <div key={i}>
            {/* Dot */}
            <div style={{
              position: 'absolute',
              top: timelineY - 8,
              left: x - 8,
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: isActive ? '#ff3d57' : '#3b82f6',
              boxShadow: isActive ? '0 0 20px #ff3d57' : 'none',
              transition: 'all 0.3s',
            }} />
            {/* Year */}
            <div style={{
              position: 'absolute',
              top: timelineY - 60,
              left: x - 40,
              width: 80,
              textAlign: 'center',
              color: isActive ? '#ffffff' : '#9ca3af',
              fontSize: 28,
              fontWeight: isActive ? 'bold' : 'normal',
              fontFamily: 'Arial',
            }}>
              {event.year}
            </div>
            {/* Label */}
            <div style={{
              position: 'absolute',
              top: timelineY + 30,
              left: x - 100,
              width: 200,
              textAlign: 'center',
              color: isActive ? '#f1f5f9' : '#6b7280',
              fontSize: 18,
              fontFamily: 'Arial',
              opacity: isActive ? 1 : 0.6,
            }}>
              {event.label}
            </div>
          </div>
        )
      })}

      {/* Playhead */}
      <div style={{
        position: 'absolute',
        top: timelineY - 30,
        left: timelineStartX + timelineWidth * playheadProgress - 2,
        width: 4,
        height: 60,
        backgroundColor: '#ffffff',
        boxShadow: '0 0 10px rgba(255,255,255,0.5)',
      }} />
    </AbsoluteFill>
  )
}
