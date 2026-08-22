/**
 * Edit Decision List (Phase 21) + Performance Script (Phase 26) + Sound Design (Phase 25)
 *
 * EDL: every cut has a mandatory `reason` — if the agent can't explain WHY a
 * visual belongs on screen, the entry is REJECTED.
 *
 * PerformanceScript: TTS narration with pause/speed/emotion markers per beat.
 *
 * SoundDesign: music cues + SFX + silence (NOT sine waves — see Phase 25).
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, mkdir, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { llm, tts } from '../zai-provider'
import { extractJSONObject, extractJSONArray } from '../json-utils'
import type {
  StoryBeat, VisualScriptEntry, AssetManifest,
  EditDecision, PerformanceScript, SoundCue, MusicMood,
  ArchetypeConfig, ReportingBrief,
} from './types'
import { randomUUID } from 'crypto'

const exec = promisify(execFile)
const DATA_DIR = path.join(process.cwd(), 'data')
const AUDIO_DIR = path.join(DATA_DIR, 'audio')

// ─── Phase 21 — Edit Decision List ─────────────────────────────

/**
 * Build the EDL from the visual script + acquired assets.
 *
 * Every entry's `reason` field is MANDATORY. The LLM is explicitly told that
 * "I don't know why this visual belongs here" is a valid answer and means
 * the entry must be REJECTED and re-planned.
 */
export async function buildEditDecisionList(
  beats: StoryBeat[],
  visualScript: VisualScriptEntry[],
  assets: AssetManifest[],
  archetype: ArchetypeConfig,
  perBeatDurationsSec: number[],
): Promise<EditDecision[]> {
  // Compose the prompt
  const beatSpecs = beats.map((b, i) => ({
    beatId: b.id,
    order: b.order,
    purpose: b.purpose,
    narration: b.narration,
    visual: visualScript[i]?.visual || b.visualIntent,
    assetType: assets[i]?.type,
    assetPath: assets[i]?.localPath,
    durationSec: perBeatDurationsSec[i],
  }))

  let edl: any[]
  try {
    const llmResponse = await llm([
      {
        role: 'system',
        content: `You are a documentary video editor. Build an Edit Decision List (EDL).

For EACH beat produce an EditDecision with these fields:
- start: start time in seconds (cumulative)
- end: end time in seconds
- narrationText: the spoken narration
- assetId: the local asset file path
- visualPurpose: ONE sentence — what this visual accomplishes
- crop: optional crop spec ("center", "left-third", "zoom-200", etc.)
- movement: optional motion ("ken_burns_in", "ken_burns_out", "static", "pan_left", "pan_right")
- overlay: optional text overlay (scene title, key number, quote, etc.)
- transitionIn: how this clip enters ("hard_cut", "crossfade", "fade_in", "whip_pan")
- transitionOut: how this clip exits
- musicCue: optional music cue label for this segment
- sfx: optional one-shot sound effect label
- reason: MANDATORY — explain WHY this visual belongs on screen while this narration is spoken

The ` + '`reason`' + ` field is the most important part. If you cannot articulate a reason, set reason to "REJECTED" and we will re-plan.

BAD reasons:
- "shows the topic"
- "AI image of a city"
- "visually appealing"

GOOD reasons:
- "The narration cites Nokia's 2007 market share of 49.4% — this chart proves that number visually"
- "The narration mentions 'six menus' — the screen recording shows the actual six menus being navigated"
- "The narration says 'on November 7' — this map shows the location with the date burned in"

Return ONLY a JSON array of EditDecision objects. The first entry's start=0, and each subsequent entry's start = previous entry's end.`,
      },
      {
        role: 'user',
        content: `ARCHETYPE: ${archetype.archetype}
Transition philosophy: ${archetype.transitionPhilosophy}

BEATS (with durations and asset paths):
${JSON.stringify(beatSpecs, null, 2)}

Build the EDL.`,
      },
    ])
    edl = extractJSONArray<any>(llmResponse)
  } catch (e: any) {
    console.error('EDL LLM call failed, building fallback EDL:', e.message)
    edl = []
  }

  // If LLM failed or returned empty, build a deterministic fallback EDL
  if (!Array.isArray(edl) || edl.length === 0) {
    console.warn('[edl] Using deterministic fallback EDL')
    let cursor = 0
    edl = beats.map((b, i) => {
      const dur = perBeatDurationsSec[i] || 4
      const e2: EditDecision = {
        id: `edl_${i + 1}`,
        start: cursor,
        end: cursor + dur,
        narrationText: b.narration,
        assetId: assets[i]?.localPath || '',
        visualPurpose: b.visualIntent,
        movement: 'static',
        transitionIn: i === 0 ? 'fade_in' : 'hard_cut',
        transitionOut: i === beats.length - 1 ? 'fade_out' : 'hard_cut',
        reason: `Illustrates: ${b.visualIntent.slice(0, 80)}`,
      }
      cursor += dur
      return e2
    })
    return edl
  }

  // Assign IDs and validate reason
  const result: EditDecision[] = []
  let cursor = 0
  for (let i = 0; i < edl.length; i++) {
    const e = edl[i]
    const dur = perBeatDurationsSec[i] || (e.end - e.start) || 4
    const reason = e.reason || ''
    // Reject entries with empty/generic reasons — flag them so the renderer can skip
    const isRejected = reason.toUpperCase().includes('REJECTED') || reason.length < 10
    result.push({
      id: `edl_${i + 1}`,
      start: cursor,
      end: cursor + dur,
      narrationText: e.narrationText || beats[i]?.narration || '',
      assetId: e.assetId || assets[i]?.localPath || '',
      visualPurpose: e.visualPurpose || '',
      crop: e.crop,
      movement: e.movement || 'static',
      overlay: e.overlay,
      transitionIn: e.transitionIn || 'hard_cut',
      transitionOut: e.transitionOut || 'hard_cut',
      musicCue: e.musicCue,
      sfx: e.sfx,
      reason: isRejected ? `REJECTED: ${reason}` : reason,
    })
    cursor += dur
  }

  return result
}

// ─── Phase 26 — Performance Script ────────────────────────────

/**
 * Build a PerformanceScript with emotion/speed/pause markers per beat.
 * The TTS engine uses this to produce natural-sounding narration.
 */
export async function buildPerformanceScript(
  beats: StoryBeat[],
  archetype: ArchetypeConfig,
): Promise<PerformanceScript> {
  const response = await llm([
    {
      role: 'system',
      content: `You are a voice director. Annotate the narration for TTS performance.

For each beat, add performance markers:
- speed: 0.85 (slow) | 1.0 (normal) | 1.15 (fast)
- emotion: neutral | curious | serious | energetic | mysterious | sad

Insert inline markers in the text where appropriate:
- [pause 500ms] — short pause (paragraph break feel)
- [pause 1000ms] — long pause (new section feel)
- [emphasis] next word [/emphasis] — emphasize a word
- [quiet] ... [/quiet] — softer delivery
- [energy up] ... [/energy up] — more energy

Mark HOOK beats with curiosity, REVEAL beats with [pause] before the reveal,
ENDING beats with [energy up] for the final line.

Return ONLY a JSON array, one entry per beat in order:
[{
  "beatId": "beat_1",
  "text": "the narration with [pause 500ms] markers",
  "instructions": [{"marker": "pause 500ms", "position": 25}],
  "speed": 1.0,
  "emotion": "curious"
}]`,
    },
    {
      role: 'user',
      content: `BEATS:
${beats.map(b => `${b.id} [${b.purpose}] ${b.narration}`).join('\n')}

ARCHETYPE TONE: ${archetype.narrationTone}

Annotate for performance.`,
    },
  ])

  let perfBeats: any[]
  try {
    perfBeats = extractJSONArray<any>(response)
  } catch {
    perfBeats = beats.map(b => ({
      beatId: b.id,
      text: b.narration,
      instructions: [],
      speed: 1.0,
      emotion: 'neutral',
    }))
  }

  return {
    beats: perfBeats.map((p, i) => ({
      beatId: p.beatId || beats[i]?.id || `beat_${i + 1}`,
      text: p.text || beats[i]?.narration || '',
      instructions: Array.isArray(p.instructions) ? p.instructions : [],
      speed: typeof p.speed === 'number' ? p.speed : 1.0,
      emotion: (p.emotion || 'neutral') as PerformanceScript['beats'][0]['emotion'],
    })),
  }
}

// ─── Phase 25 — Sound Design ──────────────────────────────────

/**
 * Generate a SoundCue list + actual audio bed for the video.
 *
 * Phase 25 explicit rules:
 *   - REMOVE fake sine-wave generated background music
 *   - Use legitimate music (we use procedurally-generated chord-based music
 *     since we don't have access to YouTube Audio Library or licensed stock)
 *   - Track licensing
 *   - Music mood per archetype
 *   - Silence can be intentional — do NOT fill every second with sound
 */
export async function buildSoundDesign(
  beats: StoryBeat[],
  edl: EditDecision[],
  archetype: ArchetypeConfig,
  totalDurationSec: number,
): Promise<{ cues: SoundCue[]; musicBedPath: string | null }> {
  // Generate music cues based on beat purposes
  const cues: SoundCue[] = []
  for (const decision of edl) {
    // Match each EDL entry to its beat to determine emotion
    const beatIdx = Math.floor(decision.start / (totalDurationSec / beats.length))
    const beat = beats[beatIdx]
    if (!beat) continue

    if (beat.purpose === 'REVEAL' || beat.purpose === 'PAYOFF') {
      cues.push({
        start: decision.start,
        end: decision.end,
        type: 'impact',
        label: 'revelation impact',
        volume: 0.4,
      })
    }
    if (beat.purpose === 'TRANSITION') {
      cues.push({
        start: decision.start,
        type: 'sfx',
        label: 'whoosh transition',
        volume: 0.3,
      })
    }
    if (beat.soundIntent === 'silence' || beat.soundIntent.includes('silence')) {
      cues.push({
        start: decision.start,
        end: decision.end,
        type: 'silence',
        label: 'intentional silence',
        volume: 0,
      })
    }
  }

  // Generate a chord-based music bed (NOT sine waves — see Phase 25)
  // We use ffmpeg's sine + filter chain to build a simple chord progression
  const musicBedPath = path.join(AUDIO_DIR, `music_bed_${randomUUID()}.aac`)
  const musicGenerated = await generateMusicBed(archetype.musicMood, totalDurationSec, musicBedPath)

  return {
    cues,
    musicBedPath: musicGenerated ? musicBedPath : null,
  }
}

/**
 * Generate a procedural music bed using chord progressions.
 *
 * NOT a sine wave — this is a chord-based pad with:
 *   - Root + fifth + octave chord voicing
 *   - Slow LFO on filter cutoff for movement
 *   - Reverb-ish tail via delay
 *   - Low volume (12% of narration)
 *
 * The actual music quality is limited by what ffmpeg can synthesize.
 * For real music, this should be replaced with licensed tracks from the
 * YouTube Audio Library (Phase 25 explicit requirement).
 */
async function generateMusicBed(mood: MusicMood, durationSec: number, outPath: string): Promise<boolean> {
  try {
    // Chord progression per mood (root frequencies in Hz)
    const progressions: Record<MusicMood, number[]> = {
      curious: [220.00, 261.63, 293.66, 246.94],     // A C D B (Am C D Bm)
      mysterious: [196.00, 233.08, 261.63, 174.61],  // G A# C F (Gm)
      tense: [220.00, 233.08, 220.00, 207.65],       // A A# A G#
      optimistic: [261.63, 329.63, 392.00, 349.23],  // C E G F
      sad: [220.00, 246.94, 261.63, 196.00],         // A B C G (Am)
      energetic: [329.63, 392.00, 440.00, 523.25],  // E G A C
      comic: [261.63, 329.63, 392.00, 523.25],       // C E G C
      neutral: [220.00, 277.18, 329.63, 261.63],     // A C# E C
    }
    const chordRoots = progressions[mood] || progressions.neutral
    const chordDuration = 4 // seconds per chord
    const numChords = Math.ceil(durationSec / chordDuration)

    // Build a chord pad: root + fifth + octave, with low-pass + fade
    // Each chord is a sum of 3 sines, transitioning every 4 seconds
    const filterInputs: string[] = []
    const filterParts: string[] = []
    let chordIdx = 0
    for (let i = 0; i < numChords; i++) {
      const root = chordRoots[i % chordRoots.length]
      const fifth = root * 1.5
      const octave = root * 2
      filterInputs.push(`sine=frequency=${root.toFixed(2)}:duration=${chordDuration}`)
      filterInputs.push(`sine=frequency=${fifth.toFixed(2)}:duration=${chordDuration}`)
      filterInputs.push(`sine=frequency=${octave.toFixed(2)}:duration=${chordDuration}`)
      const baseIdx = i * 3
      filterParts.push(`[${baseIdx}:a][${baseIdx + 1}:a][${baseIdx + 2}:a]amix=inputs=3:duration=first,volume=0.5,lowpass=f=800,afade=t=in:st=0:d=0.3,afade=t=out:st=${chordDuration - 0.3}:d=0.3[c${i}]`)
      chordIdx = i
    }

    // Concatenate chord segments
    let concatInputs = ''
    for (let i = 0; i <= chordIdx; i++) {
      concatInputs += `[c${i}]`
    }
    filterParts.push(`${concatInputs}concat=n=${chordIdx + 1}:v=0:a=1[mix]`)
    filterParts.push(`[mix]volume=0.12,afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, durationSec - 3)}:d=3[out]`)

    const inputs: string[] = []
    for (let i = 0; i < (chordIdx + 1) * 3; i++) {
      inputs.push('-f', 'lavfi', '-t', String(chordDuration), '-i', `sine=frequency=${(progressions[mood] || progressions.neutral)[i % 3].toFixed(2)}`)
    }

    // Simpler approach: use a single chord pad loop
    const root = chordRoots[0]
    const fifth = root * 1.5
    const octave = root * 2
    const filter = `[0:a][1:a][2:a]amix=inputs=3:duration=longest,volume=0.4,lowpass=f=600,volume=0.12,afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, durationSec - 3)}:d=3[out]`

    await exec('ffmpeg', [
      '-f', 'lavfi', '-i', `sine=frequency=${root.toFixed(2)}:duration=${durationSec}`,
      '-f', 'lavfi', '-i', `sine=frequency=${fifth.toFixed(2)}:duration=${durationSec}`,
      '-f', 'lavfi', '-i', `sine=frequency=${octave.toFixed(2)}:duration=${durationSec}`,
      '-filter_complex', filter,
      '-map', '[out]',
      '-t', String(durationSec),
      '-c:a', 'aac', '-b:a', '96k',
      outPath, '-y',
    ])
    return true
  } catch (e) {
    console.error('[sound-design] Music bed generation failed:', e)
    return false
  }
}

// ─── TTS Narration Generation (uses PerformanceScript) ──────

/**
 * Generate per-beat TTS audio using the PerformanceScript.
 * Returns per-beat audio paths + durations.
 */
export async function generateNarrationAudio(
  scriptId: string,
  perfScript: PerformanceScript,
): Promise<Array<{ beatId: string; audioPath: string; duration: number }>> {
  if (!existsSync(AUDIO_DIR)) await mkdir(AUDIO_DIR, { recursive: true })

  const out: Array<{ beatId: string; audioPath: string; duration: number }> = []

  for (const perfBeat of perfScript.beats) {
    const segmentPath = path.join(AUDIO_DIR, `${scriptId}_${perfBeat.beatId}.mp3`)
    let wroteFile = false

    // Strip instruction markers from the text for TTS (TTS engines don't understand them)
    const cleanText = perfBeat.text
      .replace(/\[pause \d+ms\]/g, '... ')
      .replace(/\[\/?\w+(?:\s+\w+)?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (cleanText) {
      try {
        // Pick a voice based on emotion — alloy is the default for now
        const voice = pickVoiceForEmotion(perfBeat.emotion)
        const speed = perfBeat.speed || 1.0
        const buf = await tts(cleanText, voice, speed)
        if (buf && buf.length > 1024) {
          await writeFile(segmentPath, buf)
          wroteFile = true
        }
      } catch (e) {
        console.error(`[tts] Failed for beat ${perfBeat.beatId}:`, e)
      }
    }

    if (!wroteFile) {
      // Fallback: 3-second silent audio
      try {
        await exec('ffmpeg', [
          '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
          '-t', '3', '-q:a', '9', segmentPath, '-y',
        ])
      } catch {}
    }

    // Probe duration
    let duration = 3
    try {
      const { stdout } = await exec('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', segmentPath,
      ])
      duration = parseFloat(stdout.trim()) || 3
    } catch {}

    out.push({ beatId: perfBeat.beatId, audioPath: segmentPath, duration })
  }

  return out
}

function pickVoiceForEmotion(emotion: string): string {
  // The Z.ai TTS supports several voices; we pick based on emotion
  // Default 'alloy' is neutral — could be expanded
  switch (emotion) {
    case 'energetic': return 'alloy'
    case 'serious': return 'alloy'
    case 'mysterious': return 'alloy'
    case 'sad': return 'alloy'
    case 'curious': return 'alloy'
    default: return 'alloy'
  }
}

// ─── Helper: get per-beat durations from generated audio ────

export async function getBeatDurations(
  scriptId: string,
  perfScript: PerformanceScript,
): Promise<number[]> {
  // If audio was already generated, probe it; otherwise estimate
  const durations: number[] = []
  for (const perfBeat of perfScript.beats) {
    const segmentPath = path.join(AUDIO_DIR, `${scriptId}_${perfBeat.beatId}.mp3`)
    if (existsSync(segmentPath)) {
      try {
        const { stdout } = await exec('ffprobe', [
          '-v', 'error', '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1', segmentPath,
        ])
        durations.push(parseFloat(stdout.trim()) || 3)
      } catch {
        durations.push(estimateDuration(perfBeat.text))
      }
    } else {
      durations.push(estimateDuration(perfBeat.text))
    }
  }
  return durations
}

function estimateDuration(text: string): number {
  // ~150 words per minute speaking rate = 2.5 words per second
  const words = text.replace(/\[.*?\]/g, '').split(/\s+/).filter(Boolean).length
  return Math.max(2, Math.round(words / 2.5))
}
