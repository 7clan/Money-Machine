/**
 * LowerThirdOverlay — scene title + caption only
 *
 * NOTE: Internal tooling branding ("Money Machine" watermark, progress indicators)
 * has been REMOVED per spec section 10. These are internal production artifacts
 * and must NEVER appear in published content.
 *
 * The scene title + caption remain for editorial clarity.
 */

import React from 'react'
import { interpolate, Easing } from 'remotion'
import type { StoryBeat } from '../../engine/v3/types'

interface LowerThirdOverlayProps {
  beat: StoryBeat
  channelName: string  // kept for API compat but NOT rendered
  sceneNumber: number  // kept for API compat but NOT rendered
  totalScenes: number  // kept for API compat but NOT rendered
  frame: number
  fps: number
}

export const LowerThirdOverlay: React.FC<LowerThirdOverlayProps> = ({
  beat, frame, fps,
}) => {
  // Fade in the lower third
  const opacity = interpolate(frame, [0, 10, fps * 2, fps * 2.5], [0, 1, 1, 0.85], {
    extrapolateRight: 'clamp',
  })

  const sceneTitle = beat.title || beat.narration.slice(0, 40)
  const captionLine = beat.narration.split(/[.!?]/)[0].slice(0, 60)

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      opacity,
    }}>
      {/* Scene title (bottom-left, accent background) */}
      <div style={{
        position: 'absolute',
        bottom: 160, left: 60,
        backgroundColor: 'rgba(255,61,87,0.85)',
        borderRadius: 4,
        padding: '12px 20px',
        color: '#ffffff',
        fontSize: 48,
        fontWeight: 'bold',
        fontFamily: 'Arial',
        maxWidth: '60%',
      }}>
        {sceneTitle}
      </div>

      {/* Caption line (below title) */}
      {captionLine && (
        <div style={{
          position: 'absolute',
          bottom: 90, left: 60,
          color: '#f1f5f9',
          fontSize: 28,
          fontFamily: 'Arial',
          maxWidth: '60%',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        }}>
          {captionLine}
        </div>
      )}

      {/* NO watermark, NO progress indicator — removed per spec section 10 */}
    </div>
  )
}
