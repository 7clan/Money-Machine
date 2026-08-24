/**
 * DocumentaryComposition V2 — Shot-based rendering
 *
 * Instead of one visual per beat, renders individual VisualShots.
 * Each shot can be a different composition type (photo, chart, timeline,
 * document, diagram, typography), producing much higher information density.
 *
 * The Sequence component handles timing — each shot gets its own frame range.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig, Sequence, AbsoluteFill, Img, interpolate, Easing, staticFile } from 'remotion'
import type { VisualShot } from '../../engine/v3/visual-shots'
import { ChartComponent } from '../components/Chart'
import { TimelineComponent } from '../components/Timeline'
import { DocumentComponent } from '../components/Document'
import { PhotoComposition } from '../components/PhotoComposition'
import { TypographyComponent } from '../components/Typography'
import { DiagramComponent } from '../components/Diagram'
import { LowerThirdOverlay } from '../components/LowerThirdOverlay'

export const DOCUMENTARY_COMP_ID = 'documentary'
export const DOCUMENTARY_FPS = 30
export const DOCUMENTARY_WIDTH = 1920
export const DOCUMENTARY_HEIGHT = 1080

interface DocumentaryCompositionProps {
  shots: VisualShot[]
  beats: any[]
  channelName: string
  totalScenes: number
}

export const DocumentaryComposition: React.FC<DocumentaryCompositionProps> = ({
  shots, beats, channelName, totalScenes,
}) => {
  const { fps } = useVideoConfig()
  const beatById = new Map(beats.map(b => [b.id, b]))

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      {shots.map((shot, i) => {
        const startFrame = Math.round(shot.start * fps)
        const durationFrames = Math.max(1, Math.round((shot.end - shot.start) * fps))
        const beat = beatById.get(shot.beatId)
        if (!beat) return null

        return (
          <Sequence
            key={shot.id}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <ShotRenderer
              shot={shot}
              beat={beat}
              shotIndex={i}
              totalShots={shots.length}
              channelName={channelName}
            />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

interface ShotRendererProps {
  shot: VisualShot
  beat: any
  shotIndex: number
  totalShots: number
  channelName: string
}

const ShotRenderer: React.FC<ShotRendererProps> = ({
  shot, beat, shotIndex, totalShots, channelName,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const durationFrames = Math.max(1, Math.round((shot.end - shot.start) * fps))

  // Fade in/out per shot
  const fadeIn = interpolate(frame, [0, Math.min(8, durationFrames / 4)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  })
  const fadeOut = interpolate(frame, [durationFrames - Math.min(8, durationFrames / 4), durationFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic),
  })
  const opacity = Math.min(fadeIn, fadeOut)

  let content: React.ReactNode = null

  switch (shot.type) {
    case 'REAL_PHOTO':
    case 'PRODUCT_MONTAGE':
      content = (
        <PhotoComposition
          beat={beat}
          assetPath={shot.assetId ? shot.assetId.replace(/^\//, '') : undefined}
          frame={frame}
          fps={fps}
          durationFrames={durationFrames}
          movement={shot.animation || 'ken_burns_in'}
        />
      )
      break

    case 'CHART':
      content = <ChartComponent beat={beat} frame={frame} fps={fps} durationFrames={durationFrames} />
      break

    case 'TIMELINE':
      content = <TimelineComponent beat={beat} frame={frame} fps={fps} durationFrames={durationFrames} />
      break

    case 'DOCUMENT':
      content = <DocumentComponent beat={beat} frame={frame} fps={fps} durationFrames={durationFrames} />
      break

    case 'DIAGRAM':
      content = <DiagramComponent beat={beat} frame={frame} fps={fps} durationFrames={durationFrames} shot={shot} />
      break

    case 'TYPOGRAPHY':
      content = <TypographyComponent beat={beat} frame={frame} fps={fps} durationFrames={durationFrames} text={shot.purpose} />
      break

    case 'MOTION_GRAPHIC':
      // Motion graphics use chart/document/timeline components with different params
      content = <ChartComponent beat={beat} frame={frame} fps={fps} durationFrames={durationFrames} />
      break

    default:
      content = <TypographyComponent beat={beat} frame={frame} fps={fps} durationFrames={durationFrames} text={shot.purpose} />
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      {content}
      {/* Lower third overlay — only on certain shots, not every shot */}
      {shotIndex % 3 === 0 && (
        <LowerThirdOverlay
          beat={beat}
          channelName={channelName}
          sceneNumber={shotIndex}
          totalScenes={totalShots}
          frame={frame}
          fps={fps}
        />
      )}
    </AbsoluteFill>
  )
}
