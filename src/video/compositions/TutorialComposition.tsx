/**
 * TutorialComposition — for SCREEN_TUTORIAL archetype
 *
 * Fundamentally different from Nokia's DocumentaryComposition:
 * - LIGHT background (not dark navy)
 * - SCREEN_CAPTURE dominant (not charts/timelines/documents)
 * - Subtle annotations (not dramatic lower-thirds)
 * - Blue accent (not red)
 * - No watermark, no progress counter
 *
 * Uses the raw DevTools capture videos + screenshots as the primary visual,
 * with Remotion adding cursor emphasis, highlights, and brief labels.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig, Sequence, AbsoluteFill, Img, Video, interpolate, Easing, staticFile } from 'remotion'
import type { VisualShot } from '../../engine/v3/visual-shots'
import { TutorialOverlay } from '../components/TutorialOverlay'

export const TUTORIAL_COMP_ID = 'tutorial'
export const TUTORIAL_FPS = 30
export const TUTORIAL_WIDTH = 1280
export const TUTORIAL_HEIGHT = 720

interface TutorialCompositionProps {
  shots: VisualShot[]
  segments: any[]
  channelName: string
  totalScenes: number
}

// Map shot types to capture assets
const CAPTURE_DIR = 'devtools-captures'
const CAPTURE_MAP: Record<string, string> = {
  'intro_shot_0': `${CAPTURE_DIR}/trick1_before.png`,  // app loaded
  'intro_shot_1': '',  // typography
  'trick1_css_shot_0': `${CAPTURE_DIR}/trick1_before.png`,
  'trick1_css_shot_1': `${CAPTURE_DIR}/trick1_before.png`,
  'trick1_css_shot_2': `${CAPTURE_DIR}/trick1_before.png`,
  'trick1_css_shot_3': `${CAPTURE_DIR}/trick1_after.png`,
  'trick1_css_shot_4': `${CAPTURE_DIR}/trick1_after.png`,
  'trick2_console_shot_0': `${CAPTURE_DIR}/trick2_before.png`,
  'trick2_console_shot_1': `${CAPTURE_DIR}/trick2_before.png`,
  'trick2_console_shot_2': `${CAPTURE_DIR}/trick2_after.png`,
  'trick2_console_shot_3': `${CAPTURE_DIR}/trick2_after.png`,
  'trick3_network_shot_0': `${CAPTURE_DIR}/trick3_before.png`,
  'trick3_network_shot_1': `${CAPTURE_DIR}/trick3_before.png`,
  'trick3_network_shot_2': `${CAPTURE_DIR}/trick3_after.png`,
  'trick3_network_shot_3': `${CAPTURE_DIR}/trick3_after.png`,
  'trick3_network_shot_4': `${CAPTURE_DIR}/trick3_after.png`,
  'trick3_network_shot_5': `${CAPTURE_DIR}/trick3_after.png`,
  'trick3_network_shot_6': `${CAPTURE_DIR}/trick3_after.png`,
  'trick4_offline_shot_0': `${CAPTURE_DIR}/trick4_before.png`,
  'trick4_offline_shot_1': `${CAPTURE_DIR}/trick4_before.png`,
  'trick4_offline_shot_2': `${CAPTURE_DIR}/trick4_before.png`,
  'trick4_offline_shot_3': `${CAPTURE_DIR}/trick4_after.png`,
  'trick4_offline_shot_4': `${CAPTURE_DIR}/trick4_after.png`,
  'trick5_device_shot_0': `${CAPTURE_DIR}/trick5_before.png`,
  'trick5_device_shot_1': `${CAPTURE_DIR}/trick5_before.png`,
  'trick5_device_shot_2': `${CAPTURE_DIR}/trick5_before.png`,
  'trick5_device_shot_3': `${CAPTURE_DIR}/trick5_after.png`,
  'trick5_device_shot_4': `${CAPTURE_DIR}/trick5_after.png`,
  'outro_shot_0': '',  // typography
  'outro_shot_1': `${CAPTURE_DIR}/trick5_after.png`,
}

export const TutorialComposition: React.FC<TutorialCompositionProps> = ({
  shots, segments, channelName, totalScenes,
}) => {
  const { fps } = useVideoConfig()

  return (
    <AbsoluteFill style={{ backgroundColor: '#f0f2f5' }}>
      {shots.map((shot, i) => {
        const startFrame = Math.round(shot.start * fps)
        const durationFrames = Math.max(1, Math.round((shot.end - shot.start) * fps))
        const capturePath = CAPTURE_MAP[shot.id]

        return (
          <Sequence key={shot.id} from={startFrame} durationInFrames={durationFrames}>
            <TutorialShotRenderer
              shot={shot}
              capturePath={capturePath}
              shotIndex={i}
              totalShots={shots.length}
            />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

interface TutorialShotRendererProps {
  shot: VisualShot
  capturePath?: string
  shotIndex: number
  totalShots: number
}

const TutorialShotRenderer: React.FC<TutorialShotRendererProps> = ({
  shot, capturePath, shotIndex,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const durationFrames = Math.max(1, Math.round((shot.end - shot.start) * fps))

  const fadeIn = interpolate(frame, [0, Math.min(8, durationFrames / 4)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  })
  const opacity = fadeIn

  // Typography shots
  if (shot.type === 'SHORT_TYPOGRAPHY') {
    return (
      <AbsoluteFill style={{ opacity, backgroundColor: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#ffffff', fontSize: 42, fontWeight: 'bold', fontFamily: 'Segoe UI, Arial', textAlign: 'center', maxWidth: '80%' }}>
          {shot.desc}
        </div>
      </AbsoluteFill>
    )
  }

  // Screen capture / UI shots — show the real screenshot
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: '#f0f2f5' }}>
      {capturePath ? (
        <Img
          src={staticFile(capturePath)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ color: '#666', fontSize: 24, fontFamily: 'Segoe UI, Arial' }}>
            {shot.desc}
          </div>
        </div>
      )}

      {/* Tutorial overlay — subtle labels + highlights */}
      <TutorialOverlay
        shot={shot}
        frame={frame}
        fps={fps}
        durationFrames={durationFrames}
      />
    </AbsoluteFill>
  )
}
