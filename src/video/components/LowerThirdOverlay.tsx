/**
 * LowerThirdOverlay — scene title with proper text fitting
 *
 * FIXES:
 * - Text truncation: dynamically sizes font to fit available width
 * - Supports 1-3 lines with natural word wrapping
 * - Preserves complete words (no mid-word cuts)
 * - Red box only for key beats (HOOK/REVEAL/PAYOFF/ENDING)
 * - No watermark, no progress counter
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

/**
 * Calculate the number of lines needed for text at a given font size
 * and available width (approximate — uses average character width).
 */
function estimateLines(text: string, fontSize: number, maxWidth: number): number {
  const avgCharWidth = fontSize * 0.55 // Arial average
  const charsPerLine = Math.floor(maxWidth / avgCharWidth)
  const words = text.split(' ')
  let lines = 1
  let currentLineLen = 0
  for (const word of words) {
    if (currentLineLen + word.length + 1 > charsPerLine) {
      lines++
      currentLineLen = word.length
    } else {
      currentLineLen += word.length + 1
    }
  }
  return Math.min(lines, 3) // cap at 3 lines
}

/**
 * Find the optimal font size that fits text within maxWidth and maxLines.
 * Starts at maxFontSize and reduces until it fits.
 */
function fitFontSize(text: string, maxWidth: number, maxLines: number, maxFontSize: number, minFontSize: number): number {
  for (let size = maxFontSize; size >= minFontSize; size -= 2) {
    const lines = estimateLines(text, size, maxWidth)
    if (lines <= maxLines) {
      return size
    }
  }
  return minFontSize
}

export const LowerThirdOverlay: React.FC<LowerThirdOverlayProps> = ({
  beat, frame, fps,
}) => {
  const opacity = interpolate(frame, [0, 10, fps * 2, fps * 2.5], [0, 1, 1, 0.85], {
    extrapolateRight: 'clamp',
  })

  const sceneTitle = beat.title || beat.narration.slice(0, 60)
  const isKeyBeat = ['HOOK', 'REVEAL', 'PAYOFF', 'ENDING'].includes(beat.purpose)

  // Dynamic text fitting
  const availableWidth = 1100 // pixels available for text (1280 - 60 left - 120 right margin)
  const maxLines = 2
  const maxFont = isKeyBeat ? 44 : 32
  const minFont = isKeyBeat ? 24 : 18
  const fontSize = fitFontSize(sceneTitle, availableWidth, maxLines, maxFont, minFont)
  const lines = estimateLines(sceneTitle, fontSize, availableWidth)

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
          bottom: 120, left: 60,
          backgroundColor: 'rgba(255,61,87,0.85)',
          borderRadius: 4,
          padding: '10px 18px',
          color: '#ffffff',
          fontSize: fontSize,
          fontWeight: 'bold',
          fontFamily: 'Arial',
          maxWidth: availableWidth,
          lineHeight: 1.2,
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}>
          {sceneTitle}
        </div>
      ) : (
        <div style={{
          position: 'absolute',
          bottom: 50, left: 60,
          color: '#f1f5f9',
          fontSize: fontSize,
          fontWeight: 'bold',
          fontFamily: 'Arial',
          maxWidth: availableWidth,
          lineHeight: 1.3,
          textShadow: '0 2px 8px rgba(0,0,0,0.95)',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
        }}>
          {sceneTitle}
        </div>
      )}
    </div>
  )
}
