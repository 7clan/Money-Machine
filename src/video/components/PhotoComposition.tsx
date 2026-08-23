/**
 * PhotoComposition — multiple meaningful images arranged intentionally
 *
 * Renders a Ken Burns effect on a still image with motion that varies
 * per scene (zoom-in, zoom-out, pan-left, pan-right, static).
 */

import React from 'react'
import { AbsoluteFill, Img, interpolate, Easing, staticFile } from 'remotion'
import type { StoryBeat } from '../../engine/v3/types'

interface PhotoCompositionProps {
  beat: StoryBeat
  assetPath?: string  // relative URL like /remotion-assets/{projectId}/{assetId}.png
  frame: number
  fps: number
  durationFrames: number
  movement: string
}

export const PhotoComposition: React.FC<PhotoCompositionProps> = ({
  beat, assetPath, frame, durationFrames, movement,
}) => {
  const progress = frame / Math.max(durationFrames, 1)

  // Motion params based on movement type
  let scale = 1.0
  let translateX = '0%'
  let translateY = '0%'

  switch (movement) {
    case 'ken_burns_in':
      scale = 1.0 + 0.15 * progress
      break
    case 'ken_burns_out':
      scale = 1.15 - 0.15 * progress
      break
    case 'zoom_in':
      scale = 1.0 + 0.25 * progress
      break
    case 'pan_right':
      scale = 1.15
      translateX = `${-15 * progress}%`
      break
    case 'pan_left':
      scale = 1.15
      translateX = `${15 * progress}%`
      break
    case 'static':
    default:
      scale = 1.05
      break
  }

  // assetPath is a relative URL like /remotion-assets/{projectId}/{file}
  // For Remotion, we need to use staticFile() which prepends the staticBase
  const imgSrc = assetPath ? staticFile(assetPath.replace(/^\//, '')) : undefined

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a', overflow: 'hidden' }}>
      {imgSrc ? (
        <AbsoluteFill>
          <Img
            src={imgSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale}) translate(${translateX}, ${translateY})`,
            }}
          />
          {/* Dark gradient at bottom for text readability */}
          <AbsoluteFill style={{
            background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.8) 100%)',
          }} />
        </AbsoluteFill>
      ) : (
        // Fallback: branded gradient background
        <AbsoluteFill style={{
          background: 'linear-gradient(135deg, #0b0f1a 0%, #141b2e 100%)',
        }} />
      )}
    </AbsoluteFill>
  )
}
