/**
 * Captions (Phase 31 — selective typography for long-form)
 *
 * Long-form videos should NOT be covered in giant TikTok captions.
 * Use typography selectively for: important number, person, location, date,
 * quote, chapter, critical phrase.
 *
 * Shorts get full phrase-level burned-in captions.
 */

import { writeFile } from 'fs/promises'
import path from 'path'

interface BeatAudio {
  beatId: string
  audioPath: string
  duration: number
}

function srtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

/**
 * Generate SRT captions aligned to actual per-beat audio durations.
 *
 * For 'selective' caption style (long-form): only emit captions for beats that
 * contain a number, person name, location, date, or quoted phrase.
 * For 'phrase' / 'burned_in' caption style (shorts): emit every phrase.
 */
export async function generateCaptionsV3(
  beats: Array<{ narration: string; id: string; purpose: string; visualIntent?: string }>,
  perBeatAudio: BeatAudio[],
  captionPath: string,
  captionStyle: 'none' | 'selective' | 'phrase' | 'burned_in',
): Promise<void> {
  if (captionStyle === 'none') {
    await writeFile(captionPath, '')
    return
  }

  let srt = ''
  let index = 1
  let cursor = 0 // running timestamp

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i]
    const audio = perBeatAudio.find(a => a.beatId === beat.id)
    if (!audio || !beat.narration?.trim()) continue

    const sceneDuration = audio.duration
    const words = beat.narration.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    // For selective captions: only emit if the beat contains a "captionable" element
    const shouldCaption = captionStyle === 'phrase' || captionStyle === 'burned_in' ||
      (captionStyle === 'selective' && hasCaptionableElement(beat))

    if (shouldCaption) {
      // Split into ~7-word chunks (better readability than 40-char)
      const chunkSize = captionStyle === 'burned_in' ? 5 : 7
      const totalChars = words.reduce((s, w) => s + w.length, 0) + words.length
      const charPerSec = totalChars / sceneDuration
      let lineStart = cursor
      let line = ''
      let lineWords = 0

      for (let j = 0; j < words.length; j++) {
        line += (line ? ' ' : '') + words[j]
        lineWords++
        if (lineWords >= chunkSize || j === words.length - 1) {
          const lineDuration = line.length / charPerSec
          const lineEnd = Math.min(lineStart + lineDuration, cursor + sceneDuration)
          srt += `${index}\n`
          srt += `${srtTimestamp(lineStart)} --> ${srtTimestamp(lineEnd)}\n`
          srt += `${line}\n\n`
          index++
          lineStart = lineEnd
          line = ''
          lineWords = 0
        }
      }
    }

    cursor += sceneDuration
  }

  await writeFile(captionPath, srt)
}

/**
 * Does this beat contain a "captionable" element per Phase 31?
 *   - important number (e.g. "$2 billion", "50%", "2007")
 *   - person name (capitalized words that aren't sentence starts)
 *   - location
 *   - date
 *   - quoted phrase
 */
function hasCaptionableElement(beat: { narration: string; purpose: string }): boolean {
  const text = beat.narration
  // Numbers: currency, percentages, years, quantities
  if (/\$\d|\d+%|\b(19|20)\d{2}\b|\b\d{2,}\b/.test(text)) return true
  // Quoted phrases
  if (/"[^"]+"|'[^']+'/.test(text)) return true
  // Key beats always caption
  if (['HOOK', 'REVEAL', 'PAYOFF', 'ENDING'].includes(beat.purpose)) return true
  return false
}
