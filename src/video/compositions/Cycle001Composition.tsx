/**
 * Cycle001Composition — generic Remotion composition for autonomous productions.
 *
 * Props: { shots, segments, images, audio, chunkStart, chunkEnd }
 *
 * Renders a 1920x1080 timeline of shots. Each shot:
 *   - Background: the staged image (or gradient fallback) with Ken Burns motion
 *   - Caption: the segment narration as a lower-third burned-in caption
 *   - Audio: the segment's TTS mp3
 *
 * All shot times are LOCAL to this chunk (chunkStart already subtracted).
 *
 * DYNAMIC DURATION (Cycle 001 lesson — hardcoded durationInFrames={300} caused
 * silent truncation):
 *   The composition exports `calculateCycleDuration()` which derives the correct
 *   durationInFrames from the actual shots timeline. Root.tsx registers this as
 *   the Composition's calculateMetadata callback, so selectComposition() always
 *   gets the right duration — no produce.ts override needed.
 */
import React from 'react'
import { AbsoluteFill, Img, Audio, useCurrentFrame, useVideoConfig, staticFile, interpolate, Sequence } from 'remotion'

interface Shot {
  id: string
  segmentId: string
  start: number
  end: number
  duration: number
  type: string
  purpose: string
  animation?: string
  isRawVideo: boolean
  isScreenshot: boolean
}
interface Segment {
  id: string
  type: string
  narration: string
  start: number
  end: number
  duration: number
}
interface CycleProps {
  shots: Shot[]
  segments: Segment[]
  images: Record<string, string>
  audio: Record<string, string>
  chunkStart?: number
  chunkEnd?: number
  width?: number
  height?: number
  fps?: number
}

const DEFAULT_FPS = 30
const DEFAULT_WIDTH = 1920
const DEFAULT_HEIGHT = 1080
const MIN_FRAMES = 1

/**
 * Derive the correct durationInFrames from the actual shot timeline.
 * Falls back to 1 frame if no shots are provided (defensive).
 *
 * This is the SINGLE SOURCE OF TRUTH for composition duration.
 * Used by:
 *   - Root.tsx calculateMetadata callback
 *   - produce.ts (for logging/assertion only — NOT for override)
 */
export function calculateCycleDuration(inputProps: Partial<CycleProps>, fps: number = DEFAULT_FPS): number {
  const shots = (inputProps?.shots ?? []) as Shot[]
  const segments = (inputProps?.segments ?? []) as Segment[]
  if (shots.length === 0 && segments.length === 0) return MIN_FRAMES
  // Max end time across all shots AND segments (segments may extend beyond last shot)
  const maxShotEnd = shots.length > 0 ? Math.max(...shots.map((s) => Number(s.end) || 0)) : 0
  const maxSegEnd = segments.length > 0 ? Math.max(...segments.map((s) => Number(s.end) || 0)) : 0
  const maxEndSec = Math.max(maxShotEnd, maxSegEnd)
  if (!Number.isFinite(maxEndSec) || maxEndSec <= 0) return MIN_FRAMES
  return Math.max(MIN_FRAMES, Math.ceil(maxEndSec * fps))
}

const COLORS = ['#0f172a', '#1e293b', '#312e81', '#3b0764', '#7c2d12', '#1e3a8a']
function colorForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

const ShotFrame: React.FC<{ shot: Shot; imgPath?: string }> = ({ shot, imgPath }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const progress = durationInFrames > 0 ? frame / durationInFrames : 0
  const scale = interpolate(progress, [0, 1], [1.08, 1.18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const panX = interpolate(progress, [0, 1], [-20, 20], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const panY = interpolate(progress, [0, 1], [-10, 10], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const baseColor = colorForId(shot.id)
  return (
    <AbsoluteFill style={{ background: baseColor, overflow: 'hidden' }}>
      {imgPath ? (
        <Img
          src={staticFile(imgPath)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translate(${panX}px, ${panY}px)`,
          }}
        />
      ) : (
        <AbsoluteFill style={{
          background: `radial-gradient(circle at 50% 50%, ${baseColor}, #000)`,
          transform: `scale(${scale})`,
        }} />
      )}
      <AbsoluteFill style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 30%, transparent 60%)',
      }} />
    </AbsoluteFill>
  )
}

const Caption: React.FC<{ text: string; segmentType: string }> = ({ text, segmentType }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: 'clamp' })
  const opacity = fadeIn
  const typeLabel = segmentType === 'HOOK' ? '★' : segmentType === 'ENDING' ? '✦' : ''
  return (
    <AbsoluteFill style={{
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      padding: '60px 80px 80px 80px',
      opacity,
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.7)',
        borderLeft: `6px solid ${segmentType === 'HOOK' ? '#f59e0b' : segmentType === 'ENDING' ? '#10b981' : '#6366f1'}`,
        padding: '20px 28px',
        maxWidth: '80%',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: 'white',
        fontSize: 36,
        fontWeight: 600,
        lineHeight: 1.3,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
        borderRadius: '0 8px 8px 0',
      }}>
        <span style={{ color: '#fbbf24', marginRight: 12 }}>{typeLabel}</span>
        {text}
      </div>
    </AbsoluteFill>
  )
}

const Watermark: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-end', padding: '40px 60px' }}>
    <div style={{
      fontFamily: 'Inter, system-ui, sans-serif',
      color: 'rgba(255,255,255,0.6)',
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: 2,
      textTransform: 'uppercase',
    }}>
      MONEY MACHINE · AUTONOMOUS
    </div>
  </AbsoluteFill>
)

export const Cycle001Composition: React.FC<CycleProps> = ({ shots, segments, images, audio }) => {
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {shots.map((shot) => {
        const startFrame = Math.round(shot.start * fps)
        const durFrames = Math.max(1, Math.round(shot.duration * fps))
        const seg = segments.find((s) => s.id === shot.segmentId)
        const imgPath = images[shot.id]
        const audioPath = seg ? audio[seg.id] : undefined
        return (
          <Sequence key={shot.id} from={startFrame} durationInFrames={durFrames}>
            <ShotFrame shot={shot} imgPath={imgPath} />
            {seg && <Caption text={seg.narration} segmentType={seg.type} />}
            {audioPath && <Audio src={staticFile(audioPath)} />}
            <Watermark />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
