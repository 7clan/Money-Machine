/**
 * D-ANIM-PROOF — AnimatedSceneProof composition (TEST D "GLOW HOUR").
 *
 * A 12-second, 360-frame @ 30fps proof that layered vector characters can be
 * animated OVER a generated scene background so the result reads as
 * intentional animation (not a Ken Burns slideshow):
 *
 *   0–2s   empty dusk scene, ambient glow, Bramble the lantern ignites
 *   2–4s   Pip the mushroom kid springs in from the left with bounce hops
 *   4–6s   Bramble SPEAKS (glow brightens + speech arcs), Pip listens (tilt,
 *          wide eyes)
 *   6–8s   Dot the LED firefly pops in, Pip does a surprise shake then
 *          excited hops
 *   8–10s  group moment — all three glow-pulse in sync
 *   10–12s Pip exits right, Dot follows, Bramble dims
 *
 * All motion comes from the primitives in ../animation/characterMotion.
 */

import React from 'react'
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import {
  eyeOpenness,
  exitSlide,
  glowPulse,
  hop,
  idleBob,
  moteDrift,
  popIn,
  speakingGlow,
  springEnter,
  surpriseShake,
} from '../animation/characterMotion'
import { Bramble, Dot, Pip } from '../animation/GlowHourCharacters'

export const ANIMATION_PROOF_COMP_ID = 'animation-proof'
export const ANIMATION_PROOF_FPS = 30
export const ANIMATION_PROOF_WIDTH = 1920
export const ANIMATION_PROOF_HEIGHT = 1080
export const ANIMATION_PROOF_DURATION = 360 // 12s × 30fps

const GROUND_Y = 880
const PIP_X = 300
const BRAMBLE_X = 700
const DOT_X = 550
const DOT_Y = 760

/** Timeline beats (frames @ 30fps). */
const T = {
  brambleIgnite: 22,
  pipEnter: 60,
  pipHops: [60, 78, 96],
  brambleSpeak: { from: 120, to: 180 },
  dotPop: 182,
  pipShake: 186,
  pipExcited: { from: 204, to: 240 },
  group: { from: 240, to: 300 },
  pipExit: 300,
  dotExit: 316,
  captionIn: [12, 26],
  captionOut: [338, 354],
} as const

export type AnimationProofProps = {
  backgroundPath?: string
}

export const AnimatedSceneProof: React.FC<AnimationProofProps> = ({
  backgroundPath = 'test-d/scene-01.png',
}) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const inGroup = frame >= T.group.from && frame < T.group.to
  const groupPulse = inGroup ? Math.sin(frame * 0.42) : 0 // -1..1, synced
  const groupBob = inGroup ? Math.sin(frame * 0.28) * 7 : 0

  /* ----------------------------- background ----------------------------- */

  const bgScale = interpolate(frame, [0, ANIMATION_PROOF_DURATION], [1.03, 1.09])
  const bgDrift = interpolate(frame, [0, ANIMATION_PROOF_DURATION], [0, -24])
  const ambient = glowPulse({ frame, base: 0.13, amp: 0.05, speed: 1 / 38 })

  /* ------------------------------ Bramble ------------------------------- */

  const brambleGrow = springEnter({
    frame,
    fps,
    delay: T.brambleIgnite,
    damping: 14,
    stiffness: 95,
    mass: 1,
  })
  const brambleGrowScale = 0.15 + 0.85 * brambleGrow
  const brambleOpacity = Math.min(1, brambleGrow * 1.7)

  const brambleSpeak = speakingGlow({
    frame,
    activeFrom: T.brambleSpeak.from,
    activeTo: T.brambleSpeak.to,
  })
  const brambleSurprise = interpolate(
    frame,
    [T.dotPop, T.dotPop + 6, T.dotPop + 28],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const brambleDim = interpolate(frame, [300, 340], [1, 0.45], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const brambleGlow =
    (glowPulse({ frame, base: 0.34, amp: 0.1, speed: 1 / 34, phase: 1.2 }) +
      brambleSpeak * 0.5 +
      brambleSurprise * 0.15 +
      Math.max(0, groupPulse) * 0.3) *
    brambleDim
  const brambleWindow = Math.min(
    1,
    0.5 +
      brambleSpeak * 0.5 +
      brambleSurprise * 0.2 +
      Math.max(0, groupPulse) * 0.4
  ) * brambleDim

  const brambleBob =
    idleBob({ frame, amp: 3, speed: 0.06, phase: 2 }) + groupBob
  const brambleTilt =
    idleBob({ frame, amp: 1.4, speed: 0.045, phase: 0 }) +
    brambleSpeak * 2.5 -
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
  const pipEnterX = interpolate(pipProgress, [0, 1], [-220, PIP_X])
  const pipEnterHop =
    hop({ frame, start: T.pipHops[0], hopDuration: 18, height: 75 }) +
    hop({ frame, start: T.pipHops[1], hopDuration: 18, height: 40 }) +
    hop({ frame, start: T.pipHops[2], hopDuration: 18, height: 18 })
  const pipExcitedHop = hop({
    frame,
    start: T.pipExcited.from,
    hopDuration: 12,
    height: 44,
    hops: 3,
  })

  // landing squash bumps (entry hops land at 78/96/114, excited hops at 216/228/240)
  const bumpAt = (b: number, w: number) => Math.max(0, 1 - Math.abs(frame - b) / w)
  const pipSquashAmt = Math.max(
    bumpAt(78, 6),
    bumpAt(96, 6),
    bumpAt(114, 6),
    bumpAt(216, 5) * 0.85,
    bumpAt(228, 5) * 0.85,
    bumpAt(240, 5) * 0.85
  )

  const pipExitP = exitSlide({ frame, start: T.pipExit, duration: 45 })
  const pipExitHop = hop({ frame, start: T.pipExit, hopDuration: 14, height: 30 })

  const pipListen = interpolate(
    frame,
    [118, 128, 172, 182],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const pipShock = interpolate(
    frame,
    [T.pipShake, T.pipShake + 4, T.pipShake + 24],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  const pipX = pipEnterX + pipExitP * 2500
  const pipY =
    pipEnterHop +
    pipExcitedHop +
    (frame >= 114 ? idleBob({ frame, amp: 4, speed: 0.09 }) : 0) +
    groupBob +
    pipExitHop
  const pipTilt = pipListen * 6 + pipShock * -4 + pipExitP * 10
  const pipShakeX = surpriseShake({
    frame,
    start: T.pipShake,
    duration: 16,
    amp: 13,
  })
  const pipSquashY = 1 - 0.22 * pipSquashAmt
  const pipSquashX = 1 + 0.2 * pipSquashAmt
  const pipGlow =
    glowPulse({ frame, base: 0.42, amp: 0.08, speed: 1 / 30 }) +
    pipShock * 0.15 +
    Math.max(0, groupPulse) * 0.35
  const pipMouthOpen = Math.max(
    interpolate(
      frame,
      [T.pipExcited.from, T.pipExcited.from + 6, T.pipExcited.to - 4, T.pipExcited.to + 4],
      [0, 1, 1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    ),
    inGroup ? 0.25 : 0
  )

  /* -------------------------------- Dot --------------------------------- */

  const dotPop = popIn({ frame, fps, delay: T.dotPop })
  const dotScale = Math.max(0.001, dotPop)
  const dotExciteBob =
    frame >= T.dotPop && frame < T.pipExcited.to
      ? Math.sin(frame * 0.5) * 14
      : 0
  const dotIdle = frame >= T.pipExcited.to ? idleBob({ frame, amp: 6, speed: 0.15, phase: 1 }) : 0
  const dotXWobble =
    frame >= T.dotPop && frame < T.pipExcited.to
      ? Math.sin(frame * 0.23) * 10
      : 0
  const dotExitP = exitSlide({ frame, start: T.dotExit, duration: 40 })
  const dotX = DOT_X + dotXWobble + dotExitP * 2200
  const dotY = DOT_Y + dotExciteBob + groupBob + dotIdle
  const dotCore = 0.55 + 0.45 * (Math.sin(frame * 1.15) > 0.15 ? 1 : 0.25)
  const dotGlow =
    0.5 + 0.2 * Math.sin(frame * 0.2) + Math.max(0, groupPulse) * 0.3
  const dotTrail = Math.max(
    interpolate(dotExitP, [0.05, 0.2, 0.85, 1], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    interpolate(frame, [T.dotPop, T.dotPop + 6, 205, 215], [0, 0.8, 0.8, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  )

  /* ------------------------------ caption ------------------------------- */

  const captionOpacity = interpolate(
    frame,
    [T.captionIn[0], T.captionIn[1], T.captionOut[0], T.captionOut[1]],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )

  /* ------------------------------- render ------------------------------- */

  return (
    <AbsoluteFill style={{ backgroundColor: '#141024', overflow: 'hidden' }}>
      {/* scene background */}
      <AbsoluteFill>
        <Img
          src={staticFile(backgroundPath)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${bgScale}) translateX(${bgDrift}px)`,
          }}
        />
      </AbsoluteFill>

      {/* dusk colour grade */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(40,26,64,0.18) 0%, rgba(20,14,40,0.05) 40%, rgba(24,14,8,0.26) 100%)',
        }}
      />
      {/* ambient lamp glow, breathing */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 900px 700px at 32% 46%, rgba(255,178,80,${ambient.toFixed(3)}) 0%, rgba(255,178,80,0) 60%)`,
        }}
      />
      {/* group-moment flash */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1100px 600px at 48% 78%, rgba(255,204,110,${(Math.max(0, groupPulse) * 0.1).toFixed(3)}) 0%, rgba(255,204,110,0) 65%)`,
        }}
      />
      {/* darkening band so characters read against the street */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(12,8,24,0) 60%, rgba(12,8,24,0.52) 100%)',
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 75% 70% at 50% 46%, rgba(0,0,0,0) 55%, rgba(8,5,18,0.5) 100%)',
        }}
      />

      {/* drifting fireflies / dusk motes */}
      {Array.from({ length: 14 }).map((_, i) => {
        const m = moteDrift({ frame, index: i, width, height })
        const boost = inGroup ? 1.5 : 1
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: m.x,
              top: m.y,
              width: m.size,
              height: m.size,
              borderRadius: '50%',
              background: `rgba(255,214,120,${(m.twinkle * 0.55 * boost).toFixed(3)})`,
              boxShadow: `0 0 ${m.size * 2}px rgba(255,200,100,${(m.twinkle * 0.4 * boost).toFixed(3)})`,
            }}
          />
        )
      })}

      {/* Bramble — already rooted, ignites early */}
      <Bramble
        x={BRAMBLE_X}
        groundY={GROUND_Y}
        yOff={brambleBob}
        growScale={brambleGrowScale}
        tilt={brambleTilt}
        eyeOpen={eyeOpenness({ frame, seed: 7 })}
        eyeWiden={1 + brambleSurprise * 0.3 + (inGroup ? 0.12 : 0)}
        glow={brambleGlow}
        windowBright={brambleWindow}
        speaking={brambleSpeak}
        arcCycle={(frame * 0.055) % 1}
        opacity={brambleOpacity}
      />

      {/* Pip — springs in, reacts, exits right */}
      <Pip
        x={pipX}
        groundY={GROUND_Y}
        yOff={pipY}
        squashX={pipSquashX}
        squashY={pipSquashY}
        tilt={pipTilt}
        eyeOpen={eyeOpenness({ frame, seed: 2 })}
        eyeWiden={1 + pipListen * 0.3 + pipShock * 0.25}
        glow={pipGlow}
        mouthOpen={pipMouthOpen}
        opacity={1}
        xShake={pipShakeX}
      />

      {/* Dot — pops in, bounces excitedly, follows Pip out */}
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
          pip · bramble · dot — animation proof
        </div>
      </div>
    </AbsoluteFill>
  )
}
