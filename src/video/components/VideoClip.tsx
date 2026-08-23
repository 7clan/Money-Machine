/**
 * VideoClip Component — actual moving source or Z.ai generated clip
 *
 * Plays a video asset with the scene. Falls back to a cinematic gradient
 * if the video file is missing or invalid.
 */

import React from 'react'
import { AbsoluteFill, Video, interpolate } from 'remotion'
import type { StoryBeat } from '../../engine/v3/types'

interface VideoClipComponentProps {
  beat: StoryBeat
  assetPath?: string
  frame: number
  fps: number
  durationFrames: number
}

export const VideoClipComponent: React.FC<VideoClipComponentProps> = ({
  beat, assetPath, durationFrames,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a', overflow: 'hidden' }}>
      {assetPath ? (
        <AbsoluteFill>
          <Video
            src={assetPath}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            // Loop the video if it's shorter than the scene
            loop
          />
          {/* Dark gradient overlay */}
          <AbsoluteFill style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.7) 100%)',
          }} />
        </AbsoluteFill>
      ) : (
        // Fallback: cinematic animated gradient
        <AbsoluteFill style={{
          background: 'linear-gradient(135deg, #0b0f1a 0%, #1a1a2e 50%, #0b0f1a 100%)',
        }}>
          <div style={{
            position: 'absolute', top: '40%', left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ff3d57', fontSize: 72, fontWeight: 'bold',
            fontFamily: 'Arial',
            opacity: interpolate(
              [0],
              [0, durationFrames / 2, durationFrames],
              [0, 1, 0.8],
            )[0] || 0.8,
          }}>
            {beat.title || 'Cinematic'}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
