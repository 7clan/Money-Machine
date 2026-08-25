/**
 * TutorialComposition V2 — interaction-led tutorial
 *
 * FIXES:
 * - Uses raw MP4 capture videos as PRIMARY visual (not static PNGs)
 * - Screenshots used only for before/after freeze frames + emphasis
 * - Remotion <Video> component plays the real interaction footage
 * - Remotion <Img> used only for brief static holds
 *
 * The viewer sees actual cursor movement, panel changes, and results —
 * not a slideshow of screenshots.
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

// Map segment → raw video file
const RAW_VIDEO_MAP: Record<string, string> = {
  'trick1_css': 'devtools-captures/trick1_raw.mp4',
  'trick2_console': 'devtools-captures/trick2_raw.mp4',
  'trick3_network': 'devtools-captures/trick3_raw.mp4',
  'trick4_offline': 'devtools-captures/trick4_raw.mp4',
  'trick5_device': 'devtools-captures/trick5_raw.mp4',
}

// Map shot ID → screenshot file (for before/after freeze frames)
const SCREENSHOT_MAP: Record<string, string> = {
  'intro_shot_0': 'devtools-captures/trick1_before.png',
  'trick1_css_shot_0': 'devtools-captures/trick1_before.png',  // before
  'trick1_css_shot_4': 'devtools-captures/trick1_after.png',   // after result
  'trick2_console_shot_0': 'devtools-captures/trick2_before.png',
  'trick2_console_shot_3': 'devtools-captures/trick2_after.png',
  'trick3_network_shot_0': 'devtools-captures/trick3_before.png',
  'trick3_network_shot_6': 'devtools-captures/trick3_after.png',
  'trick4_offline_shot_0': 'devtools-captures/trick4_before.png',
  'trick4_offline_shot_4': 'devtools-captures/trick4_after.png',
  'trick5_device_shot_0': 'devtools-captures/trick5_before.png',
  'trick5_device_shot_4': 'devtools-captures/trick5_after.png',
  'outro_shot_1': 'devtools-captures/trick5_after.png',
}

// Shots that should use raw VIDEO (action portions)
const RAW_VIDEO_SHOTS = new Set([
  'trick1_css_shot_1', 'trick1_css_shot_2', 'trick1_css_shot_3',
  'trick2_console_shot_1', 'trick2_console_shot_2',
  'trick3_network_shot_1', 'trick3_network_shot_2', 'trick3_network_shot_3',
  'trick3_network_shot_4', 'trick3_network_shot_5',
  'trick4_offline_shot_1', 'trick4_offline_shot_2', 'trick4_offline_shot_3',
  'trick5_device_shot_1', 'trick5_device_shot_2', 'trick5_device_shot_3',
])

export const TutorialComposition: React.FC<TutorialCompositionProps> = ({
  shots, segments, channelName, totalScenes,
}) => {
  const { fps } = useVideoConfig()

  return (
    <AbsoluteFill style={{ backgroundColor: '#f0f2f5' }}>
      {shots.map((shot, i) => {
        const startFrame = Math.round(shot.start * fps)
        const durationFrames = Math.max(1, Math.round((shot.end - shot.start) * fps))

        return (
          <Sequence key={shot.id} from={startFrame} durationInFrames={durationFrames}>
            <TutorialShotRenderer
              shot={shot}
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
  shotIndex: number
  totalShots: number
}

const TutorialShotRenderer: React.FC<TutorialShotRendererProps> = ({
  shot, shotIndex,
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

  // Check if this shot should use raw video
  const useRawVideo = RAW_VIDEO_SHOTS.has(shot.id)
  const segmentId = shot.id.split('_shot_')[0]
  const rawVideoPath = RAW_VIDEO_MAP[segmentId]
  const screenshotPath = SCREENSHOT_MAP[shot.id]

  if (useRawVideo && rawVideoPath) {
    // Use RAW VIDEO — the actual interaction footage
    return (
      <AbsoluteFill style={{ opacity, backgroundColor: '#f0f2f5' }}>
        <Video
          src={staticFile(rawVideoPath)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
          // Loop the raw video if shot is longer than the clip
          loop
          // Start from beginning of the raw video
          startFrom={0}
        />
        <TutorialOverlay shot={shot} frame={frame} fps={fps} durationFrames={durationFrames} />
      </AbsoluteFill>
    )
  }

  // Use screenshot for before/after freeze frames + other shots
  if (screenshotPath) {
    return (
      <AbsoluteFill style={{ opacity, backgroundColor: '#f0f2f5' }}>
        <Img
          src={staticFile(screenshotPath)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
        <TutorialOverlay shot={shot} frame={frame} fps={fps} durationFrames={durationFrames} />
      </AbsoluteFill>
    )
  }

  // Default: text label
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#666', fontSize: 24, fontFamily: 'Segoe UI, Arial' }}>
        {shot.desc}
      </div>
      <TutorialOverlay shot={shot} frame={frame} fps={fps} durationFrames={durationFrames} />
    </AbsoluteFill>
  )
}
