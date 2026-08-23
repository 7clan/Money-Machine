/**
 * Document Component — real evidence shown with crop/highlight/annotation
 *
 * Renders a document/headline/quote card. The text appears with a typewriter
 * effect, and key phrases are highlighted with an accent-colored background.
 */

import React from 'react'
import { AbsoluteFill, interpolate, Easing } from 'remotion'
import type { StoryBeat } from '../../engine/v3/types'

interface DocumentComponentProps {
  beat: StoryBeat
  frame: number
  fps: number
  durationFrames: number
}

export const DocumentComponent: React.FC<DocumentComponentProps> = ({ beat, frame, durationFrames }) => {
  // Typewriter effect — reveal text progressively
  const text = beat.narration
  const revealProgress = interpolate(frame, [10, Math.min(60, durationFrames * 0.6)], [0, text.length], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const visibleText = text.slice(0, Math.floor(revealProgress))

  // Extract key phrases (numbers, proper nouns, quoted text)
  const keyPhrases = (beat.narration.match(/\$\d+\.?\d*\s*(billion|million|trillion)?|\d+ percent|"[^"]+"|\b[A-Z][a-z]+ (?:said|announced|reported)\b/g) || []).slice(0, 3)

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      {/* Document card background */}
      <div style={{
        position: 'absolute',
        top: 150, left: 200, right: 200, bottom: 200,
        backgroundColor: '#141b2e',
        borderRadius: 8,
        border: '1px solid #1f2937',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        padding: 60,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Document header */}
        <div style={{
          color: '#6b7280', fontSize: 16, fontFamily: 'Arial',
          marginBottom: 20, textTransform: 'uppercase', letterSpacing: 2,
        }}>
          {beat.title || 'Document'}
        </div>

        {/* Big quote mark */}
        <div style={{
          position: 'absolute',
          top: 20, left: 30,
          color: '#ff3d57',
          fontSize: 200,
          fontFamily: 'Georgia',
          opacity: 0.2,
          lineHeight: 1,
        }}>
          &ldquo;
        </div>

        {/* Narration text */}
        <div style={{
          color: '#f1f5f9', fontSize: 36, fontFamily: 'Georgia', fontStyle: 'italic',
          lineHeight: 1.5, marginTop: 40, position: 'relative', zIndex: 1,
        }}>
          {visibleText}
          {/* Typewriter cursor */}
          {revealProgress < text.length && (
            <span style={{ color: '#ff3d57', animation: 'blink 1s infinite' }}>|</span>
          )}
        </div>

        {/* Key phrases highlighted */}
        {keyPhrases.length > 0 && revealProgress >= text.length && (
          <div style={{
            marginTop: 40, display: 'flex', flexWrap: 'wrap', gap: 12,
          }}>
            {keyPhrases.map((phrase, i) => (
              <div key={i} style={{
                backgroundColor: 'rgba(255,61,87,0.15)',
                border: '1px solid rgba(255,61,87,0.4)',
                borderRadius: 4,
                padding: '8px 16px',
                color: '#ff3d57',
                fontSize: 20,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                opacity: interpolate(
                  frame,
                  [60 + i * 10, 70 + i * 10],
                  [0, 1],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                ),
              }}>
                {phrase}
              </div>
            ))}
          </div>
        )}

        {/* Source line */}
        <div style={{
          marginTop: 'auto', color: '#6b7280', fontSize: 16, fontFamily: 'Arial',
        }}>
          — Source: {beat.evidenceSourceIds.length > 0 ? `Evidence #${beat.evidenceSourceIds[0]}` : 'Research'}
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </AbsoluteFill>
  )
}
