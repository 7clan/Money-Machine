/**
 * Typography Component — text-only scene (only when text itself is important)
 *
 * Used for HOOK and ENDING beats. Bold, dramatic text animation.
 */

import React from 'react'
import { AbsoluteFill, interpolate, Easing } from 'remotion'
import type { StoryBeat } from '../../engine/v3/types'

interface TypographyComponentProps {
  beat: StoryBeat
  frame: number
  fps: number
  durationFrames: number
}

export const TypographyComponent: React.FC<TypographyComponentProps> = ({ beat, frame, durationFrames }) => {
  const text = beat.narration
  // Split into words for staggered reveal
  const words = text.split(/\s+/)
  const wordsRevealed = Math.floor(
    interpolate(frame, [5, Math.min(60, durationFrames * 0.5)], [0, words.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }),
  )

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0b0f1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 200,
    }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
        maxWidth: 1400,
      }}>
        {words.map((word, i) => {
          const isVisible = i < wordsRevealed
          const isKeyWord = /^\$?\d+\.?\d*%?$/.test(word) || word.length > 8
          return (
            <span key={i} style={{
              color: isKeyWord ? '#ff3d57' : '#ffffff',
              fontSize: isKeyWord ? 72 : 56,
              fontWeight: 'bold',
              fontFamily: 'Arial',
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.3s ease-out',
            }}>
              {word}
            </span>
          )
        })}
      </div>

      {/* Accent line at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        width: interpolate(frame, [10, 40], [0, 200], { extrapolateRight: 'clamp' }),
        height: 4,
        backgroundColor: '#ff3d57',
      }} />
    </AbsoluteFill>
  )
}
