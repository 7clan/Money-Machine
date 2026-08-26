/**
 * D-ANIM-PROOF — Reusable character animation primitives.
 *
 * Pure, deterministic functions of `frame` (no React, no hooks) so they can be
 * unit-reasoned about and reused by any Remotion composition that needs to
 * make characters visibly MOVE: spring entrances, idle bob, glow pulse,
 * surprise shake, exit slides, eye blinks, speaking glow and hop arcs.
 */

import { interpolate, spring } from 'remotion'

/* ------------------------------------------------------------------ */
/* Entrances                                                           */
/* ------------------------------------------------------------------ */

/**
 * Spring entrance progress. Returns a value that rises 0 → 1 and may
 * overshoot above 1 before settling (bouncy arrive).
 */
export const springEnter = ({
  frame,
  fps,
  delay,
  damping = 11,
  stiffness = 110,
  mass = 0.9,
}: {
  frame: number
  fps: number
  delay: number
  damping?: number
  stiffness?: number
  mass?: number
}): number => {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping, stiffness, mass },
  })
}

/**
 * "Pop" entrance — snappier and punchier than springEnter, for small
 * characters that should materialise with a squash pop.
 */
export const popIn = ({
  frame,
  fps,
  delay,
}: {
  frame: number
  fps: number
  delay: number
}): number => {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 8, stiffness: 190, mass: 0.6 },
  })
}

/* ------------------------------------------------------------------ */
/* Idle life                                                           */
/* ------------------------------------------------------------------ */

/**
 * Subtle breathing bob — a slow sine so the character is never frozen.
 * `speed` is radians per frame; keep it small (0.04–0.12).
 */
export const idleBob = ({
  frame,
  amp = 5,
  speed = 0.08,
  phase = 0,
}: {
  frame: number
  amp?: number
  speed?: number
  phase?: number
}): number => {
  return Math.sin(frame * speed + phase) * amp
}

/**
 * Glow intensity around a base level, breathing gently.
 * Returns roughly `base ± amp`.
 */
export const glowPulse = ({
  frame,
  base = 0.55,
  amp = 0.12,
  speed = 0.07,
  phase = 0,
}: {
  frame: number
  base?: number
  amp?: number
  speed?: number
  phase?: number
}): number => {
  return base + Math.sin(frame * speed + phase) * amp
}

/**
 * Eye openness 0..1. Blinks shut and reopens over `blinkDuration` frames,
 * once every `interval` frames. `seed` staggers characters.
 */
export const eyeOpenness = ({
  frame,
  seed = 0,
  interval = 110,
  blinkDuration = 6,
}: {
  frame: number
  seed?: number
  interval?: number
  blinkDuration?: number
}): number => {
  const t = (frame + seed * 41.7 + seed) % interval
  if (t < blinkDuration) {
    return 1 - Math.sin((Math.PI * t) / blinkDuration)
  }
  return 1
}

/* ------------------------------------------------------------------ */
/* Reactions                                                           */
/* ------------------------------------------------------------------ */

/**
 * Quick decaying side-to-side shake (surprise / alarm).
 * `start`/`duration` in frames. Returns px offset (± amp).
 */
export const surpriseShake = ({
  frame,
  start,
  duration = 16,
  amp = 14,
}: {
  frame: number
  start: number
  duration?: number
  amp?: number
}): number => {
  const t = frame - start
  if (t < 0 || t > duration) return 0
  const decay = 1 - t / duration
  return Math.sin(t * 1.9) * amp * decay
}

/**
 * Single (or repeated) hop arc — parabolic, positive px = up.
 * `hops` arcs of `hopDuration` frames each, `height` px tall.
 */
export const hop = ({
  frame,
  start,
  hopDuration = 12,
  height = 45,
  hops = 1,
}: {
  frame: number
  start: number
  hopDuration?: number
  height?: number
  hops?: number
}): number => {
  const t = frame - start
  if (t < 0 || t > hopDuration * hops) return 0
  const arc = (t % hopDuration) / hopDuration
  return Math.sin(arc * Math.PI) * height
}

/**
 * Speaking glow: while `active`, brightness oscillates fast (word-ish rhythm);
 * eases in/out over `ramp` frames at the boundaries.
 */
export const speakingGlow = ({
  frame,
  activeFrom,
  activeTo,
  ramp = 6,
  speed = 0.55,
}: {
  frame: number
  activeFrom: number
  activeTo: number
  ramp?: number
  speed?: number
}): number => {
  if (frame < activeFrom || frame > activeTo) return 0
  const inRamp = interpolate(frame, [activeFrom, activeFrom + ramp], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const outRamp = interpolate(frame, [activeTo - ramp, activeTo], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const envelope = Math.min(inRamp, outRamp)
  const word = 0.5 + 0.5 * Math.sin(frame * speed * Math.PI)
  return envelope * (0.45 + 0.55 * word)
}

/* ------------------------------------------------------------------ */
/* Exits                                                               */
/* ------------------------------------------------------------------ */

/**
 * Exit slide progress 0..1 with easeIn so the character accelerates
 * out of frame.
 */
export const exitSlide = ({
  frame,
  start,
  duration = 45,
}: {
  frame: number
  start: number
  duration?: number
}): number => {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (2 - t),
  })
}

/* ------------------------------------------------------------------ */
/* Ambient / misc                                                      */
/* ------------------------------------------------------------------ */

/**
 * Deterministic pseudo-random in [0,1) from an integer seed — used to
 * stagger firefly drift paths without Math.random().
 */
export const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Firefly / dust-mote drift: returns {x, y, twinkle} for mote `i` at `frame`.
 * Motes wander on a slow lissajous path and twinkle their opacity.
 */
export const moteDrift = ({
  frame,
  index,
  width,
  height,
}: {
  frame: number
  index: number
  width: number
  height: number
}): { x: number; y: number; twinkle: number; size: number } => {
  const r1 = seededRandom(index * 3 + 1)
  const r2 = seededRandom(index * 5 + 2)
  const r3 = seededRandom(index * 7 + 3)
  const speed = 0.006 + r1 * 0.008
  const x =
    (r1 * 1.1 - 0.05) * width + Math.sin(frame * speed + r2 * Math.PI * 2) * 90
  const y =
    (0.15 + r3 * 0.6) * height +
    Math.cos(frame * speed * 1.4 + r1 * Math.PI * 2) * 70
  const twinkle =
    0.25 + 0.75 * (0.5 + 0.5 * Math.sin(frame * 0.09 + index * 2.4))
  const size = 3 + r2 * 5
  return { x, y, twinkle, size }
}
