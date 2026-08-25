/**
 * TutorialOverlay — subtle annotations for screen tutorial
 *
 * Different from Nokia's LowerThirdOverlay:
 * - Blue accent (not red)
 * - Smaller text (instructional, not dramatic)
 * - Step labels (not scene titles)
 * - No watermark, no progress counter
 */

import React from 'react'
import { interpolate } from 'remotion'
import type { VisualShot } from '../../engine/v3/visual-shots'

interface TutorialOverlayProps {
  shot: VisualShot
  frame: number
  fps: number
  durationFrames: number
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  shot, frame, fps, durationFrames,
}) => {
  const opacity = interpolate(frame, [5, 15, durationFrames - 10, durationFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  })

  // Only show overlay for specific shot types
  const showLabel = ['UI_HIGHLIGHT', 'CURSOR_ACTION', 'CODE_ENTRY', 'RESULT_CONFIRMATION', 'STEP_LABEL'].includes(shot.type)

  if (!showLabel) return null

  // Extract a short label from the shot description
  const label = shot.desc.split(':')[1]?.trim() || shot.desc.slice(0, 50)

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      opacity,
    }}>
      {/* Step label — small, bottom-left, blue accent */}
      <div style={{
        position: 'absolute',
        bottom: 20, left: 20,
        backgroundColor: 'rgba(37, 99, 235, 0.9)',
        borderRadius: 4,
        padding: '6px 14px',
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 600,
        fontFamily: 'Segoe UI, Arial',
        maxWidth: '70%',
      }}>
        {label}
      </div>

      {/* Highlight indicator for UI_HIGHLIGHT shots */}
      {shot.type === 'UI_HIGHLIGHT' && (
        <div style={{
          position: 'absolute',
          top: '40%', left: '60%',
          width: 120, height: 40,
          border: '2px solid #2563eb',
          borderRadius: 4,
          boxShadow: '0 0 20px rgba(37, 99, 235, 0.5)',
        }} />
      )}

      {/* Cursor indicator for CURSOR_ACTION shots */}
      {shot.type === 'CURSOR_ACTION' && (
        <div style={{
          position: 'absolute',
          top: '45%', left: '55%',
          width: 16, height: 16,
          borderRadius: '50%',
          backgroundColor: 'rgba(37, 99, 235, 0.3)',
          border: '2px solid #2563eb',
          boxShadow: '0 0 10px rgba(37, 99, 235, 0.4)',
        }} />
      )}
    </div>
  )
}
