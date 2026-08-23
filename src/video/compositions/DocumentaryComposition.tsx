/**
 * DocumentaryComposition — the main Remotion composition
 *
 * Driven by an EditDecisionList (EDL). Each EDL entry maps to a specific
 * visual component type (Chart, Timeline, Document, PhotoComposition, VideoClip, Typography).
 *
 * The composition renders the correct component for each beat based on its
 * preferredAssetType + visualIntent, producing a visually diverse documentary
 * rather than a slideshow.
 */

import React from 'react'
import { useCurrentFrame, useVideoConfig, Sequence, AbsoluteFill, Easing, interpolate, Img, Video, Audio, staticFile } from 'remotion'
import type { EditDecision, StoryBeat, AssetManifest } from '../../engine/v3/types'
import { ChartComponent } from '../components/Chart'
import { TimelineComponent } from '../components/Timeline'
import { DocumentComponent } from '../components/Document'
import { PhotoComposition } from '../components/PhotoComposition'
import { VideoClipComponent } from '../components/VideoClip'
import { TypographyComponent } from '../components/Typography'
import { LowerThirdOverlay } from '../components/LowerThirdOverlay'

export const DOCUMENTARY_COMP_ID = 'documentary'
export const DOCUMENTARY_FPS = 30
export const DOCUMENTARY_WIDTH = 1920
export const DOCUMENTARY_HEIGHT = 1080

interface DocumentaryCompositionProps {
  edl: EditDecision[]
  beats: StoryBeat[]
  assets: AssetManifest[]
  channelName: string
  totalScenes: number
}

export const DocumentaryComposition: React.FC<DocumentaryCompositionProps> = ({
  edl, beats, assets, channelName, totalScenes,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const assetByBeatId = new Map(assets.map(a => [a.storyBeatId, a]))

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      {edl.map((decision, i) => {
        const beat = beats[i]
        if (!beat) return null

        const asset = assetByBeatId.get(beat.id)
        const startFrame = Math.round(decision.start * fps)
        const durationFrames = Math.round((decision.end - decision.start) * fps)
        const sceneNumber = i + 1

        // Pick the composition component based on beat.preferredAssetType + visualIntent
        const componentType = pickComponentType(beat, asset)

        return (
          <Sequence
            key={decision.id}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <SceneRenderer
              beat={beat}
              decision={decision}
              asset={asset}
              componentType={componentType}
              sceneNumber={sceneNumber}
              totalScenes={totalScenes}
              channelName={channelName}
              durationFrames={durationFrames}
            />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

/**
 * Pick the composition component type based on beat data.
 * This is what makes the video visually diverse — NOT every beat gets the same treatment.
 *
 * Also varies the background style per composition type so the video doesn't
 * look like a uniform dark card slideshow (spec section 9).
 */
function pickComponentType(beat: StoryBeat, asset: AssetManifest | undefined): 'chart' | 'timeline' | 'document' | 'photo' | 'video' | 'typography' {
  const assetType = asset?.type || beat.preferredAssetType
  const visual = (beat.visualIntent || '').toLowerCase()
  const narration = (beat.narration || '').toLowerCase()

  // If the narration mentions a chart/data/percentage/market share → Chart
  if (assetType === 'ORIGINAL_CHART' || assetType === 'DATASET' ||
      /\b(percent|market share|revenue|billion|million|\$|growth|decline|chart|graph|data)\b/.test(narration)) {
    return 'chart'
  }

  // If the narration mentions a date/year/sequence of events → Timeline
  if (assetType === 'ORIGINAL_MAP' ||
      /\b(2007|2008|2009|2010|2011|2012|2013|timeline|sequence|chronolog|year|decade)\b/.test(narration)) {
    return 'timeline'
  }

  // If the narration mentions a document/memo/headline/quote → Document
  if (assetType === 'DOCUMENT' || assetType === 'NEWS_HEADLINE' || assetType === 'EDITORIAL_EXCERPT' ||
      /\b(memo|document|headline|quote|letter|email|report|announced|burning platform)\b/.test(narration)) {
    return 'document'
  }

  // If there's a real asset file (photo) → Photo composition
  if (asset?.localPath) {
    return 'photo'
  }

  // If the beat purpose is HOOK or ENDING and has text-heavy intent → Typography
  if ((beat.purpose === 'HOOK' || beat.purpose === 'ENDING') && beat.narration.length < 200) {
    return 'typography'
  }

  // Default → Typography (better than a generic photo fallback)
  return 'typography'
}

interface SceneRendererProps {
  beat: StoryBeat
  decision: EditDecision
  asset: AssetManifest | undefined
  componentType: 'chart' | 'timeline' | 'document' | 'photo' | 'video' | 'typography'
  sceneNumber: number
  totalScenes: number
  channelName: string
  durationFrames: number
}

const SceneRenderer: React.FC<SceneRendererProps> = ({
  beat, decision, asset, componentType, sceneNumber, totalScenes, channelName, durationFrames,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const localFrame = frame // frame within this Sequence

  // Fade in/out
  const fadeIn = interpolate(localFrame, [0, Math.min(15, durationFrames / 4)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const fadeOut = interpolate(
    localFrame,
    [durationFrames - Math.min(15, durationFrames / 4), durationFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) },
  )
  const opacity = Math.min(fadeIn, fadeOut)

  // Render the appropriate composition component
  let content: React.ReactNode = null
  switch (componentType) {
    case 'chart':
      content = <ChartComponent beat={beat} frame={localFrame} fps={fps} durationFrames={durationFrames} />
      break
    case 'timeline':
      content = <TimelineComponent beat={beat} frame={localFrame} fps={fps} durationFrames={durationFrames} />
      break
    case 'document':
      content = <DocumentComponent beat={beat} frame={localFrame} fps={fps} durationFrames={durationFrames} />
      break
    case 'photo':
      content = (
        <PhotoComposition
          beat={beat}
          assetPath={asset?.localPath}
          frame={localFrame}
          fps={fps}
          durationFrames={durationFrames}
          movement={decision.movement || 'ken_burns_in'}
        />
      )
      break
    case 'video':
      content = (
        <VideoClipComponent
          beat={beat}
          assetPath={asset?.localPath}
          frame={localFrame}
          fps={fps}
          durationFrames={durationFrames}
        />
      )
      break
    case 'typography':
      content = <TypographyComponent beat={beat} frame={localFrame} fps={fps} durationFrames={durationFrames} />
      break
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      {content}
      <LowerThirdOverlay
        beat={beat}
        channelName={channelName}
        sceneNumber={sceneNumber}
        totalScenes={totalScenes}
        frame={localFrame}
        fps={fps}
      />
    </AbsoluteFill>
  )
}
