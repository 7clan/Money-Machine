/**
 * LowerThirdOverlay — scene title only (no watermark, no progress counter)
 *
 * The title is styled with a red accent box ONLY for key beats (HOOK/REVEAL/PAYOFF/ENDING).
 * For other beats, the title appears as subtle text — no red box, no repetition.
 */

import React from 'react'
import { interpolate } from 'remotion'
import type { StoryBeat } from '../../engine/v3/types'

interface LowerThirdOverlayProps {
  beat: StoryBeat
  channelName: string
  sceneNumber: number
  totalScenes: number
  frame: number
  fps: number
}

export const LowerThirdOverlay: React.FC<LowerThirdOverlayProps> = ({
  beat, frame, fps,
}) => {
  const opacity = interpolate(frame, [0, 10, fps * 2, fps * 2.5], [0, 1, 1, 0.85], {
    extrapolateRight: 'clamp',
  })

  const sceneTitle = beat.title || beat.narration.slice(0, 40)
  const isKeyBeat = ['HOOK', 'REVEAL', 'PAYOFF', 'ENDING'].includes(beat.purpose)

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      opacity,
    }}>
      {isKeyBeat ? (
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
      ) : (
        <div style={{
          position: 'absolute',
          bottom: 60, left: 60,
          color: '#f1f5f9',
          fontSize: 36,
          fontWeight: 'bold',
          fontFamily: 'Arial',
          maxWidth: '70%',
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
        }}>
          {sceneTitle}
        </div>
      )}
    </div>
  )
}
