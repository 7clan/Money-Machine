/**
 * D-PILOT — GLOW HOUR animated pilot composition (50 seconds, 1500 frames).
 *
 * Extends the proven 12s animation-proof pattern to pilot length using ONLY
 * the reusable primitives from ../animation/characterMotion and the vector
 * characters from ../animation/GlowHourCharacters. No background image
 * (pure dark-gradient dusk) and no audio — this is the VISUAL proof that the
 * animation system sustains intentional character motion for 50 seconds:
 *
 *   ACT 1  0–12s   Bramble alone in the dark; lamp flickers on; idle glow,
 *                  weight shifts, two small hops, a call-out into the night
 *   ACT 2  12–25s  Pip spring-enters left (bounce hops + squash), shuffles
 *                  closer; Bramble SPEAKS (word-rhythm glow + arcs); Pip
 *                  listens (tilt, wide eyes, nods) then replies (hops, mouth)
 *   ACT 3  25–38s  Dot pops in; Pip surprise-shakes then excited-hops; Dot
 *                  flies a wide lissajous loop between them; group glow-pulse
 *   ACT 4  38–50s  Characters settle (Pip one last hop, Dot descends to
 *                  hover), gentle synchronized glow-pulse, fade to black
 *
 * Every character is in constant visible motion (idle bob, blinking, glow
 * breathing) layered with act-specific entrances, hops, shakes, speech arcs
 * and flight — never a frozen pose.
 */

import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import {
  eyeOpenness,
  glowPulse,
  hop,
  idleBob,
  moteDrift,
  popIn,
  seededRandom,
  speakingGlow,
  springEnter,
  surpriseShake,
} from '../animation/characterMotion'
import { Bramble, Dot, Pip } from '../animation/GlowHourCharacters'

export const PILOT_COMP_ID = 'animated-pilot'
export const PILOT_FPS = 30
export const PILOT_WIDTH = 1920
export const PILOT_HEIGHT = 1080
export const PILOT_DURATION = 1500 // 50s × 30fps

const GROUND_Y = 880
const BRAMBLE_X = 960
const PIP_X = 470
const DOT_HOME_X = 715
const DOT_HOME_Y = 640
const DOT_SETTLE_Y = 700

/* Act boundaries (frames @ 30fps) */
const ACT2 = 360 // 12s — Pip enters
const ACT3 = 750 // 25s — Dot pops in
const ACT4 = 1140 // 38s — settle + fade

/** Timeline beats (frames). */
const T = {
  brambleGrow: 20,
  brambleCall: { from: 270, to: 330 },
  brambleHops: [200, 300],
  pipEnter: 390,
  brambleSpeak: { from: 440, to: 620 },
  pipNods: [500, 510, 520, 530, 556, 566, 576, 586],
  pipNodTilts: [0, 5, 0, 4, 0, 4, 0, 3],
  pipReply: { from: 630, to: 720 },
  dotPop: 780,
  pipShake: 786,
  pipExcited: { from: 810, to: 870 },
  group3: { from: 930, to: ACT4 },
  dotSettle: { from: ACT4, to: 1260 },
  pipLastHop: 1160,
  group4: { from: 1260, to: 1470 },
  captionIn: [10, 30],
  captionOut: [1425, 1465],
  fadeOut: [1440, 1497],
} as const

/** Pip landing frames (entry / reply / excited / last hops) → squash bumps. */
const PIP_LANDINGS: Array<[number, number]> = [
  [408, 6], [426, 6], [444, 6], // entry bounces
  [652, 6], [668, 6], [684, 6], [700, 6], [716, 5], // reply hops
  [822, 5], [834, 5], [846, 5], [858, 5], [870, 5], // excited hops
  [1186, 7], // act-4 last hop landing
]

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const

export type AnimatedPilotProps = {
  /** Reserved for future use (e.g. background image path) — unused for now. */
  backgroundPath?: string
}

export const AnimatedPilotComposition: React.FC<AnimatedPilotProps> = () => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  /* --------------------------- group moments ---------------------------- */

  const inGroup3 = frame >= T.group3.from && frame < T.group3.to
  const groupPulse = inGroup3 ? Math.sin(frame * 0.42) : 0 // -1..1, synced fast
  const groupBob3 = inGroup3 ? Math.sin(frame * 0.28) * 7 : 0

  const inGroup4 = frame >= T.group4.from && frame < T.group4.to
  const gentlePulse = inGroup4 ? Math.sin(frame * 0.16) : 0 // slow, gentle
  const groupBob4 = inGroup4 ? Math.sin(frame * 0.16) * 5 : 0

  const groupBob = groupBob3 + groupBob4

  /* ------------------------------ Bramble ------------------------------- */

  const brambleGrow = springEnter({
    frame,
    fps,
    delay: T.brambleGrow,
    damping: 14,
    stiffness: 95,
    mass: 1,
  })
  const brambleGrowScale = 0.15 + 0.85 * brambleGrow
  const brambleOpacity = Math.min(1, brambleGrow * 1.7)

  // lamp flickers on: staggered multi-keyframe ignition
  const lampOn = interpolate(
    frame,
    [45, 50, 54, 58, 63, 68, 75],
    [0, 0.65, 0.15, 0.85, 0.3, 1, 1],
    clamp
  )
  const lampJitter =
    (0.05 * Math.sin(frame * 0.9) + 0.03 * Math.sin(frame * 2.31)) * lampOn

  const brambleCall = speakingGlow({
    frame,
    activeFrom: T.brambleCall.from,
    activeTo: T.brambleCall.to,
  })
  const brambleSpeak = speakingGlow({
    frame,
    activeFrom: T.brambleSpeak.from,
    activeTo: T.brambleSpeak.to,
  })
  const brambleSpeaking = Math.max(brambleCall, brambleSpeak)

  const brambleSurprise = interpolate(
    frame,
    [T.dotPop, T.dotPop + 6, T.dotPop + 30],
    [0, 1, 0],
    clamp
  )

  const brambleHop =
    hop({ frame, start: T.brambleHops[0], hopDuration: 20, height: 26 }) +
    hop({ frame, start: T.brambleHops[1], hopDuration: 20, height: 26 })

  const glowMul = 0.3 + 0.7 * lampOn
  const brambleGlow =
    (glowPulse({ frame, base: 0.34, amp: 0.1, speed: 1 / 34, phase: 1.2 }) +
      brambleCall * 0.45 +
      brambleSpeak * 0.55 +
      brambleSurprise * 0.15 +
      Math.max(0, groupPulse) * 0.35 +
      Math.max(0, gentlePulse) * 0.2) *
    glowMul
  const brambleWindow = Math.min(
    1,
    lampOn +
      lampJitter +
      brambleCall * 0.4 +
      brambleSpeak * 0.5 +
      brambleSurprise * 0.2 +
      Math.max(0, groupPulse) * 0.4 +
      Math.max(0, gentlePulse) * 0.25
  )

  const brambleBob =
    idleBob({ frame, amp: 3, speed: 0.06, phase: 2 }) + brambleHop + groupBob
  // slow "looking around" sway + lean-in while speaking + surprise flinch
  const brambleTilt =
    idleBob({ frame, amp: 3, speed: 0.02, phase: 0.5 }) +
    idleBob({ frame, amp: 1.4, speed: 0.045, phase: 0 }) +
    brambleSpeak * 2.5 +
    brambleCall * 2 -
    brambleSurprise * 3

  /* -------------------------------- Pip --------------------------------- */

  const pipProgress = springEnter({
    frame,
    fps,
    delay: T.pipEnter,
    damping: 11,
    stiffness: 110,
    mass: 0.9,
  })
  const pipEnterX = interpolate(pipProgress, [0, 1], [-240, PIP_X])
  const pipEnterHop =
    hop({ frame, start: 390, hopDuration: 18, height: 80 }) +
    hop({ frame, start: 408, hopDuration: 18, height: 44 }) +
    hop({ frame, start: 426, hopDuration: 18, height: 20 })
  const pipShuffle = interpolate(frame, [444, 496], [0, 55], {
    ...clamp,
    easing: easeInOut,
  })
  const pipReplyHop = hop({
    frame,
    start: 636,
    hopDuration: 16,
    height: 36,
    hops: 5,
  })
  const pipExcitedHop = hop({
    frame,
    start: T.pipExcited.from,
    hopDuration: 12,
    height: 44,
    hops: 5,
  })
  const pipLastHop = hop({
    frame,
    start: T.pipLastHop,
    hopDuration: 26,
    height: 30,
  })

  const bumpAt = (b: number, w: number) => Math.max(0, 1 - Math.abs(frame - b) / w)
  const pipSquashAmt = PIP_LANDINGS.reduce(
    (m, [b, w]) => Math.max(m, bumpAt(b, w)),
    0
  )

  const pipListen = interpolate(
    frame,
    [432, 444, 620, 632],
    [0, 1, 1, 0],
    clamp
  )
  const pipNod = interpolate(
    frame,
    [...T.pipNods],
    [...T.pipNodTilts],
    clamp
  )
  const pipTalkEnv = interpolate(
    frame,
    [T.pipReply.from, T.pipReply.from + 6, T.pipReply.to - 6, T.pipReply.to],
    [0, 1, 1, 0],
    clamp
  )
  const pipShock = interpolate(
    frame,
    [T.pipShake, T.pipShake + 4, T.pipShake + 26],
    [0, 1, 0],
    clamp
  )
  const pipShakeX = surpriseShake({
    frame,
    start: T.pipShake,
    duration: 16,
    amp: 13,
  })

  const pipX = pipEnterX + pipShuffle + pipShakeX
  const pipY =
    pipEnterHop +
    pipReplyHop +
    pipExcitedHop +
    pipLastHop +
    (frame >= 444 ? idleBob({ frame, amp: 4, speed: 0.09 }) : 0) +
    groupBob
  const pipTilt =
    idleBob({ frame, amp: 1.5, speed: 0.05, phase: 1 }) +
    pipListen * 6 +
    pipNod +
    pipTalkEnv * 3 +
    pipShock * -4
  const pipSquashY = 1 - 0.22 * pipSquashAmt
  const pipSquashX = 1 + 0.2 * pipSquashAmt
  const pipGlow =
    glowPulse({ frame, base: 0.42, amp: 0.08, speed: 1 / 30 }) +
    pipShock * 0.15 +
    pipTalkEnv * 0.1 +
    Math.max(0, groupPulse) * 0.35 +
    Math.max(0, gentlePulse) * 0.2
  const pipMouthOpen = Math.max(
    pipTalkEnv * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(frame * 0.9))),
    inGroup3 ? 0.25 : 0,
    inGroup4 ? 0.15 : 0
  )

  /* -------------------------------- Dot --------------------------------- */

  const dotPop = popIn({ frame, fps, delay: T.dotPop })
  const dotScale = Math.max(0.001, dotPop)

  // Phase A: excited hover at pop-in spot
  const dotExciteBob =
    frame >= T.dotPop && frame < 880 ? Math.sin(frame * 0.5) * 14 : 0
  const dotExciteX =
    frame >= T.dotPop && frame < 880 ? Math.sin(frame * 0.23) * 12 : 0

  // Phase B: wide lissajous flight between Pip and Bramble
  const flightX = DOT_HOME_X + Math.sin(frame * 0.045) * 230
  const flightY = 620 + Math.sin(frame * 0.075) * 110
  const fb = interpolate(frame, [860, 900], [0, 1], clamp)

  // Phase C: descend to a calm hover spot (act 4 settle)
  const st = interpolate(frame, [T.dotSettle.from, T.dotSettle.to], [0, 1], {
    ...clamp,
    easing: easeInOut,
  })
  const dotXRaw = (DOT_HOME_X + dotExciteX) * (1 - fb) + flightX * fb
  const dotYRaw = (DOT_HOME_Y + dotExciteBob) * (1 - fb) + flightY * fb
  const dotX = dotXRaw + (DOT_HOME_X - dotXRaw) * st
  const hoverRamp = interpolate(frame, [1260, 1300], [0, 1], clamp)
  const dotY =
    dotYRaw + (DOT_SETTLE_Y - dotYRaw) * st +
    idleBob({ frame, amp: 7, speed: 0.12, phase: 1 }) * hoverRamp

  const dotCore = 0.55 + 0.45 * (Math.sin(frame * 1.15) > 0.15 ? 1 : 0.25)
  const dotGlow =
    0.5 + 0.2 * Math.sin(frame * 0.2) +
    Math.max(0, groupPulse) * 0.3 +
    Math.max(0, gentlePulse) * 0.2
  const dotTrail = interpolate(
    frame,
    [T.dotPop, T.dotPop + 6, 830, 900, ACT4, 1210],
    [0, 0.7, 0.7, 0.45, 0.45, 0],
    clamp
  )

  /* ---------------------------- background ------------------------------ */

  const ambient =
    glowPulse({ frame, base: 0.13, amp: 0.05, speed: 1 / 38 }) * glowMul
  const moonPulse = 0.5 + 0.1 * Math.sin(frame * 0.03)
  const floorWarm =
    0.12 * lampOn +
    0.06 * Math.max(0, groupPulse) +
    0.04 * Math.max(0, gentlePulse)

  const fadeIn = interpolate(frame, [0, 15], [1, 0], clamp)
  const fadeOut = interpolate(
    frame,
    [T.fadeOut[0], T.fadeOut[1]],
    [0, 1],
    clamp
  )
  const captionOpacity = interpolate(
    frame,
    [T.captionIn[0], T.captionIn[1], T.captionOut[0], T.captionOut[1]],
    [0, 1, 1, 0],
    clamp
  )
  const moteBoost = inGroup3 ? 1.5 : inGroup4 ? 1.2 : 1

  /* ------------------------------- render ------------------------------- */

  return (
    <AbsoluteFill style={{ backgroundColor: '#0D0A1A', overflow: 'hidden' }}>
      {/* dusk sky gradient (no image) */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, #0D0A1A 0%, #1C1230 48%, #2A1830 78%, #33202C 100%)',
        }}
      />

      {/* stars — deterministic positions, twinkling */}
      {Array.from({ length: 22 }).map((_, i) => {
        const sx = seededRandom(i * 13 + 5) * width
        const sy = seededRandom(i * 29 + 11) * height * 0.55
        const s = 1.5 + seededRandom(i * 7 + 3) * 2.5
        const tw =
          0.25 + 0.75 * (0.5 + 0.5 * Math.sin(frame * 0.06 + i * 2.3))
        return (
          <div
            key={`star-${i}`}
            style={{
              position: 'absolute',
              left: sx,
              top: sy,
              width: s,
              height: s,
              borderRadius: '50%',
              background: `rgba(255,236,190,${(tw * 0.8).toFixed(3)})`,
              boxShadow: `0 0 ${s * 2}px rgba(255,220,150,${(tw * 0.5).toFixed(3)})`,
            }}
          />
        )
      })}

      {/* moon with breathing halo */}
      <div
        style={{
          position: 'absolute',
          left: 1585,
          top: 200,
          width: 300,
          height: 300,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, rgba(245,231,192,${(0.16 * moonPulse).toFixed(3)}) 0%, rgba(245,231,192,0) 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1585,
          top: 200,
          width: 104,
          height: 104,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle at 38% 32%, #FBF0CE 0%, #EBD6A2 65%, #D8BE86 100%)',
        }}
      />

      {/* ground plane */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(20,12,26,0) 72%, rgba(24,14,20,0.6) 82%, rgba(16,10,14,0.85) 100%)',
        }}
      />

      {/* ambient halo behind Bramble's lamp */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 950px 720px at 50% 52%, rgba(255,178,80,${ambient.toFixed(3)}) 0%, rgba(255,178,80,0) 60%)`,
        }}
      />

      {/* warm light pool on the ground around Bramble */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 700px 180px at 50% 88%, rgba(255,170,80,${floorWarm.toFixed(3)}) 0%, rgba(255,170,80,0) 70%)`,
        }}
      />

      {/* group-moment flashes */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1100px 600px at 48% 78%, rgba(255,204,110,${(Math.max(0, groupPulse) * 0.1).toFixed(3)}) 0%, rgba(255,204,110,0) 65%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1200px 660px at 50% 74%, rgba(255,204,110,${(Math.max(0, gentlePulse) * 0.06).toFixed(3)}) 0%, rgba(255,204,110,0) 65%)`,
        }}
      />

      {/* drifting fireflies / dusk motes */}
      {Array.from({ length: 14 }).map((_, i) => {
        const m = moteDrift({ frame, index: i, width, height })
        return (
          <div
            key={`mote-${i}`}
            style={{
              position: 'absolute',
              left: m.x,
              top: m.y,
              width: m.size,
              height: m.size,
              borderRadius: '50%',
              background: `rgba(255,214,120,${(m.twinkle * 0.55 * moteBoost).toFixed(3)})`,
              boxShadow: `0 0 ${m.size * 2}px rgba(255,200,100,${(m.twinkle * 0.4 * moteBoost).toFixed(3)})`,
            }}
          />
        )
      })}

      {/* Bramble — rooted center stage, ignites in Act 1, speaks in Act 2 */}
      <Bramble
        x={BRAMBLE_X}
        groundY={GROUND_Y}
        yOff={brambleBob}
        growScale={brambleGrowScale}
        tilt={brambleTilt}
        eyeOpen={eyeOpenness({ frame, seed: 7 })}
        eyeWiden={
          1 + brambleSurprise * 0.3 + brambleSpeak * 0.08 + (inGroup3 ? 0.12 : 0)
        }
        glow={brambleGlow}
        windowBright={brambleWindow}
        speaking={brambleSpeaking}
        arcCycle={(frame * 0.055) % 1}
        opacity={brambleOpacity}
      />

      {/* Pip — spring-enters in Act 2, listens, replies, stays to the end */}
      <Pip
        x={pipX}
        groundY={GROUND_Y}
        yOff={pipY}
        squashX={pipSquashX}
        squashY={pipSquashY}
        tilt={pipTilt}
        eyeOpen={eyeOpenness({ frame, seed: 2 })}
        eyeWiden={1 + pipListen * 0.3 + pipShock * 0.25 + (inGroup3 ? 0.12 : 0)}
        glow={pipGlow}
        mouthOpen={pipMouthOpen}
        opacity={1}
        xShake={pipShakeX}
      />

      {/* Dot — pops in during Act 3, flies a loop, settles to hover in Act 4 */}
      <Dot
        x={dotX}
        y={dotY}
        scale={dotScale}
        glow={dotGlow}
        core={dotCore}
        trail={dotTrail}
        opacity={Math.min(1, dotPop * 2)}
      />

      {/* caption */}
      <div
        style={{
          position: 'absolute',
          left: 64,
          bottom: 54,
          opacity: captionOpacity,
        }}
      >
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: 10,
            color: '#FFE9B8',
            textShadow: '0 2px 18px rgba(255,180,80,0.55)',
            lineHeight: 1,
          }}
        >
          GLOW HOUR
        </div>
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 19,
            fontStyle: 'italic',
            letterSpacing: 4,
            color: 'rgba(255,222,160,0.78)',
            marginTop: 10,
          }}
        >
          pip · bramble · dot — animated pilot
        </div>
      </div>

      {/* opening fade-in from black */}
      <AbsoluteFill
        style={{ backgroundColor: '#050308', opacity: fadeIn }}
      />
      {/* closing fade-out to black */}
      <AbsoluteFill
        style={{ backgroundColor: '#050308', opacity: fadeOut }}
      />
    </AbsoluteFill>
  )
}
