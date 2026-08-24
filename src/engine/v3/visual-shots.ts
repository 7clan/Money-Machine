/**
 * VisualShot Architecture (Phase 3-4)
 *
 * A beat can have 1-5 visual shots. Each shot is a distinct visual event
 * with its own type, duration, asset, and animation.
 *
 * The renderer iterates through shots (not beats), producing a timeline
 * with much higher information density.
 */

import type { StoryBeat } from './types'

export interface VisualShot {
  id: string
  beatId: string
  start: number       // seconds from video start
  end: number         // seconds from video start
  type: ShotType
  assetId?: string    // local path or URL
  purpose: string
  animation?: string
  transition?: string
  narrationContext: string  // the narration being spoken during this shot
}

export type ShotType =
  | 'REAL_PHOTO'
  | 'REAL_VIDEO'
  | 'PRODUCT_MONTAGE'
  | 'SCREEN_CAPTURE'
  | 'DOCUMENT'
  | 'HEADLINE'
  | 'CHART'
  | 'TIMELINE'
  | 'MAP'
  | 'DIAGRAM'
  | 'MOTION_GRAPHIC'
  | 'ZAI_IMAGE'
  | 'ZAI_VIDEO'
  | 'TYPOGRAPHY'

export interface VisualReplanEntry {
  beatId: string
  shots: Array<{
    type: ShotType
    dur: number
    desc: string
    anim: string
  }>
}

/**
 * Build the complete VisualShot timeline from a replan + per-beat audio durations.
 * Each beat's shots are timed to fit within the beat's narration duration.
 */
export function buildShotTimeline(
  replan: VisualReplanEntry[],
  beats: StoryBeat[],
  perBeatDurations: number[],
): VisualShot[] {
  const shots: VisualShot[] = []
  let cursor = 0 // running timestamp

  for (let i = 0; i < replan.length; i++) {
    const entry = replan[i]
    const beat = beats[i]
    const beatDuration = perBeatDurations[i] || 5

    // Distribute the beat's shots proportionally within the beat duration
    const totalShotDur = entry.shots.reduce((s, sh) => s + sh.dur, 0)
    const scale = beatDuration / totalShotDur // scale shots to fit exactly

    let beatCursor = cursor
    for (let j = 0; j < entry.shots.length; j++) {
      const sh = entry.shots[j]
      const shotDur = sh.dur * scale
      const shotEnd = beatCursor + shotDur

      shots.push({
        id: `shot_${i}_${j}`,
        beatId: entry.beatId,
        start: beatCursor,
        end: shotEnd,
        type: sh.type,
        purpose: sh.desc,
        animation: sh.anim,
        narrationContext: beat.narration.slice(0, 100),
      })
      beatCursor = shotEnd
    }
    cursor += beatDuration
  }

  return shots
}

/**
 * Resolve asset paths for each shot.
 * For REAL_PHOTO shots, use the real Wikimedia asset.
 * For CHART/TIMELINE/DIAGRAM/DOCUMENT shots, no external asset (Remotion renders them).
 * For TYPOGRAPHY shots, no external asset.
 */
export function resolveShotAssets(
  shots: VisualShot[],
  realAssets: Array<{ beatId: string; localPath: string }>,
): VisualShot[] {
  const assetByBeatId = new Map(realAssets.map(a => [a.beatId, a.localPath]))

  return shots.map(shot => {
    if (shot.type === 'REAL_PHOTO' || shot.type === 'PRODUCT_MONTAGE') {
      const path = assetByBeatId.get(shot.beatId)
      if (path) {
        return { ...shot, assetId: path }
      }
    }
    return shot
  })
}
