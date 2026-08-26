/**
 * D-ANIM-PROOF — GLOW HOUR vector overlay characters.
 *
 * Simple, characterful shape-built creatures rendered with pure inline styles
 * (no external assets) so they can be layered over any scene background and
 * animated frame-by-frame by Remotion:
 *
 *   • Pip     — cream mushroom kid with a warm amber cap (cream/yellow glow)
 *   • Bramble — tall green lantern creature with a brass lamp belly (warm glow)
 *   • Dot     — tiny red LED firefly (red glow, strobing core)
 *
 * Every character accepts a "pose" object computed by the composition from the
 * animation primitives in ./characterMotion — the components themselves are
 * stateless and deterministic.
 */

import React from 'react'

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const SHADOW: React.CSSProperties = { position: 'absolute', borderRadius: '50%' }

/** Soft radial glow disc (cheaper than CSS blur in headless Chrome). */
const GlowDisc: React.FC<{
  size: number
  color: string
  intensity: number
  style?: React.CSSProperties
}> = ({ size, color, intensity, style }) => {
  const a = Math.max(0, Math.min(1, intensity))
  return (
    <div
      style={{
        ...SHADOW,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color.replace('ALPHA', (a * 0.6).toFixed(3))} 0%, ${color.replace('ALPHA', (a * 0.22).toFixed(3))} 45%, rgba(0,0,0,0) 70%)`,
        ...style,
      }}
    />
  )
}

/** Ground contact shadow — shrinks/fades as the character leaves the ground. */
const GroundShadow: React.FC<{
  x: number
  groundY: number
  width: number
  lift: number
  maxLift?: number
}> = ({ x, groundY, width, lift, maxLift = 90 }) => {
  const k = Math.max(0.35, 1 - lift / maxLift)
  return (
    <div
      style={{
        ...SHADOW,
        left: x,
        top: groundY - 8,
        width: width * k,
        height: 30 * k,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(ellipse, rgba(8,6,18,${0.42 * k}) 0%, rgba(8,6,18,0) 68%)`,
      }}
    />
  )
}

/** Pair of eyes with blink + widen support. */
const Eyes: React.FC<{
  left: number
  top: number
  gap: number
  w: number
  h: number
  open: number
  widen: number
  color: string
  border?: string
  glowCore?: boolean
}> = ({ left, top, gap, w, h, open, widen, color, border, glowCore }) => {
  const eyeStyle = (offset: number): React.CSSProperties => ({
    position: 'absolute',
    left: left + offset,
    top,
    width: w,
    height: h * open * widen,
    borderRadius: '50%',
    background: glowCore
      ? 'radial-gradient(circle at 40% 35%, #FFF3C4 0%, #FFC24D 70%)'
      : color,
    border: border ? `${Math.max(2, w * 0.2)}px solid ${border}` : undefined,
    transform: `scaleY(${Math.max(0.08, open * widen)})`,
    transformOrigin: 'center',
  })
  return (
    <>
      <div style={eyeStyle(0)} />
      <div style={eyeStyle(gap)} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Pip — cream mushroom kid                                            */
/* ------------------------------------------------------------------ */

export type PipPose = {
  x: number
  groundY: number
  yOff: number
  squashX: number
  squashY: number
  tilt: number
  eyeOpen: number
  eyeWiden: number
  glow: number
  mouthOpen: number
  opacity: number
  xShake: number
}

export const Pip: React.FC<PipPose> = ({
  x,
  groundY,
  yOff,
  squashX,
  squashY,
  tilt,
  eyeOpen,
  eyeWiden,
  glow,
  mouthOpen,
  opacity,
  xShake,
}) => {
  const bodyW = 150
  const bodyH = 172
  return (
    <>
      <GroundShadow x={x + xShake} groundY={groundY} width={130} lift={yOff} />
      <GlowDisc
        size={300}
        color="rgba(255,204,92,ALPHA)"
        intensity={glow}
        style={{
          left: x + xShake,
          top: groundY - bodyH / 2 - 6,
          transform: `translate(-50%, -50%) scale(${0.75 + glow * 0.45})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x + xShake - bodyW / 2,
          top: groundY - bodyH,
          width: bodyW,
          height: bodyH,
          opacity,
          transform: `translateY(${-yOff}px) rotate(${tilt}deg) scale(${squashX}, ${squashY})`,
          transformOrigin: '50% 100%',
        }}
      >
        {/* stem */}
        <div
          style={{
            position: 'absolute',
            left: 34,
            top: 68,
            width: 82,
            height: 100,
            borderRadius: '36px 36px 18px 18px',
            background: 'linear-gradient(180deg, #FBF2D9 0%, #E9D6A8 100%)',
            border: '4px solid #C2A470',
          }}
        />
        {/* cap */}
        <div
          style={{
            position: 'absolute',
            left: 2,
            top: 0,
            width: 146,
            height: 80,
            borderRadius: '73px 73px 16px 16px',
            background: 'linear-gradient(180deg, #FFCB4F 0%, #EF9A2C 100%)',
            border: '4px solid #A8621C',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 24,
              top: 20,
              width: 16,
              height: 13,
              borderRadius: '50%',
              background: '#FFE9B8',
              opacity: 0.85,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 70,
              top: 10,
              width: 12,
              height: 10,
              borderRadius: '50%',
              background: '#FFE9B8',
              opacity: 0.85,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 106,
              top: 26,
              width: 14,
              height: 11,
              borderRadius: '50%',
              background: '#FFE9B8',
              opacity: 0.85,
            }}
          />
        </div>
        {/* eyes */}
        <Eyes
          left={52}
          top={94}
          gap={34}
          w={13}
          h={18}
          open={eyeOpen}
          widen={eyeWiden}
          color="#4A3520"
        />
        {/* cheeks */}
        <div
          style={{
            ...SHADOW,
            left: 40,
            top: 116,
            width: 16,
            height: 10,
            background: 'rgba(240,140,120,0.45)',
          }}
        />
        <div
          style={{
            ...SHADOW,
            left: 94,
            top: 116,
            width: 16,
            height: 10,
            background: 'rgba(240,140,120,0.45)',
          }}
        />
        {/* mouth — smiles, opens when excited */}
        {mouthOpen > 0.08 ? (
          <div
            style={{
              position: 'absolute',
              left: 67,
              top: 126,
              width: 16,
              height: 6 + 12 * mouthOpen,
              borderRadius: '50%',
              background: '#7A4A2B',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              left: 66,
              top: 128,
              width: 20,
              height: 9,
              borderRadius: '0 0 20px 20px',
              borderBottom: '3px solid #7A4A2B',
            }}
          />
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bramble — green lantern creature                                    */
/* ------------------------------------------------------------------ */

export type BramblePose = {
  x: number
  groundY: number
  yOff: number
  growScale: number
  tilt: number
  eyeOpen: number
  eyeWiden: number
  glow: number
  windowBright: number
  speaking: number
  arcCycle: number
  opacity: number
}

export const Bramble: React.FC<BramblePose> = ({
  x,
  groundY,
  yOff,
  growScale,
  tilt,
  eyeOpen,
  eyeWiden,
  glow,
  windowBright,
  speaking,
  arcCycle,
  opacity,
}) => {
  const bodyW = 132
  const bodyH = 252
  return (
    <>
      <GroundShadow x={x} groundY={groundY} width={140} lift={yOff + 10} maxLift={40} />
      <GlowDisc
        size={360}
        color="rgba(255,190,80,ALPHA)"
        intensity={glow}
        style={{
          left: x,
          top: groundY - bodyH / 2,
          transform: `translate(-50%, -50%) scale(${0.7 + glow * 0.5})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - bodyW / 2,
          top: groundY,
          width: bodyW,
          height: bodyH,
          opacity,
          transform: `translateY(${-yOff}px) rotate(${tilt}deg) scale(1, ${growScale})`,
          transformOrigin: '50% 100%',
        }}
      >
        {/* feet */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: bodyH - 22,
            width: 34,
            height: 22,
            borderRadius: '12px 12px 9px 9px',
            background: '#26452F',
            border: '3px solid #1B3524',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 82,
            top: bodyH - 22,
            width: 34,
            height: 22,
            borderRadius: '12px 12px 9px 9px',
            background: '#26452F',
            border: '3px solid #1B3524',
          }}
        />
        {/* body */}
        <div
          style={{
            position: 'absolute',
            left: 6,
            top: 78,
            width: 120,
            height: 154,
            borderRadius: '34px 34px 20px 20px',
            background: 'linear-gradient(180deg, #4E7D5B 0%, #35543F 100%)',
            border: '4px solid #23402F',
          }}
        />
        {/* lamp window (the light source) */}
        <div
          style={{
            position: 'absolute',
            left: 29,
            top: 106,
            width: 74,
            height: 92,
            borderRadius: 16,
            background: `linear-gradient(180deg, rgba(255,236,170,${0.45 + 0.55 * windowBright}) 0%, rgba(255,178,64,${0.35 + 0.55 * windowBright}) 100%)`,
            border: '5px solid #C9963F',
            boxShadow: `0 0 ${18 + 26 * windowBright}px rgba(255,190,90,${0.5 + 0.5 * windowBright})`,
          }}
        >
          {/* window cross-bars */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 6,
              width: 4,
              height: 80,
              background: 'rgba(160,110,40,0.65)',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 6,
              top: '50%',
              width: 62,
              height: 4,
              background: 'rgba(160,110,40,0.65)',
              transform: 'translateY(-50%)',
            }}
          />
        </div>
        {/* head */}
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 26,
            width: 96,
            height: 58,
            borderRadius: '26px 26px 12px 12px',
            background: 'linear-gradient(180deg, #569065 0%, #3A6649 100%)',
            border: '4px solid #23402F',
          }}
        />
        {/* brass dome + finial */}
        <div
          style={{
            position: 'absolute',
            left: 36,
            top: 4,
            width: 60,
            height: 32,
            borderRadius: '30px 30px 0 0',
            background: 'linear-gradient(180deg, #D9A44B 0%, #A97B2F 100%)',
            border: '4px solid #7E5920',
            borderBottom: 'none',
          }}
        />
        <div
          style={{
            ...SHADOW,
            left: 60,
            top: -10,
            width: 14,
            height: 14,
            background: '#D9A44B',
            border: '3px solid #7E5920',
          }}
        />
        {/* eyes — amber, glowing */}
        <Eyes
          left={36}
          top={44}
          gap={30}
          w={16}
          h={16}
          open={eyeOpen}
          widen={eyeWiden}
          color="#FFC24D"
          border="#1E3A2A"
          glowCore
        />
        {/* mouth */}
        {speaking > 0.25 ? (
          <div
            style={{
              position: 'absolute',
              left: 56,
              top: 68,
              width: 20,
              height: 8 + 10 * speaking,
              borderRadius: '50%',
              background: '#1E3A2A',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              left: 54,
              top: 72,
              width: 24,
              height: 10,
              borderRadius: '0 0 24px 24px',
              borderBottom: '3px solid #1E3A2A',
            }}
          />
        )}
      </div>
      {/* speech arcs — emanate while speaking */}
      {speaking > 0.05 &&
        [0, 1, 2].map((i) => {
          const phase = (arcCycle + 1 - i / 3) % 1
          const size = 22
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x + 62,
                top: groundY - bodyH + 40,
                width: size,
                height: size,
                borderRadius: '50%',
                border: `${Math.max(2, 4)}px solid rgba(255,214,130,${(speaking * (1 - phase) * 0.9).toFixed(3)})`,
                borderLeftColor: 'transparent',
                borderBottomColor: 'transparent',
                transform: `rotate(-45deg) scale(${0.6 + phase * 1.1})`,
                transformOrigin: 'center',
                opacity: speaking,
              }}
            />
          )
        })}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Dot — tiny red LED firefly                                          */
/* ------------------------------------------------------------------ */

export type DotPose = {
  x: number
  y: number
  scale: number
  glow: number
  core: number
  trail: number
  opacity: number
}

export const Dot: React.FC<DotPose> = ({
  x,
  y,
  scale,
  glow,
  core,
  trail,
  opacity,
}) => {
  const body = 38
  return (
    <>
      {/* motion trail ghosts when moving fast */}
      {[1, 2, 3].map((i) => {
        const t = trail * (1 - i / 4)
        if (t <= 0.02) return null
        return (
          <div
            key={i}
            style={{
              ...SHADOW,
              left: x - i * 30,
              top: y - i * 6,
              width: body * (1 - i * 0.18),
              height: body * (1 - i * 0.18),
              background: `rgba(255,90,78,${0.3 * t})`,
              transform: `translate(-50%, -50%) scale(${scale})`,
            }}
          />
        )
      })}
      <GlowDisc
        size={150}
        color="rgba(255,82,70,ALPHA)"
        intensity={glow}
        style={{
          left: x,
          top: y,
          transform: `translate(-50%, -50%) scale(${0.8 + glow * 0.5})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: x - body / 2,
          top: y - body / 2 - 10,
          width: body,
          height: body + 10,
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: '50% 50%',
        }}
      >
        {/* antenna */}
        <div
          style={{
            position: 'absolute',
            left: 17,
            top: -8,
            width: 4,
            height: 14,
            background: '#8F1410',
            borderRadius: 2,
          }}
        />
        <div
          style={{
            ...SHADOW,
            left: 14,
            top: -14,
            width: 10,
            height: 10,
            background: '#FF6A5E',
            border: '2px solid #8F1410',
          }}
        />
        {/* body */}
        <div
          style={{
            ...SHADOW,
            left: 0,
            top: 8,
            width: body,
            height: body,
            background: 'radial-gradient(circle at 35% 30%, #FFB0A6 0%, #FF4438 55%, #D92C22 100%)',
            border: '3px solid #8F1410',
          }}
        >
          {/* strobing LED core */}
          <div
            style={{
              ...SHADOW,
              left: 9,
              top: 9,
              width: 12,
              height: 12,
              background: `rgba(255,255,240,${(0.35 + 0.65 * core).toFixed(3)})`,
            }}
          />
          {/* tiny eyes */}
          <div
            style={{
              ...SHADOW,
              left: 10,
              top: 20,
              width: 5,
              height: 6,
              background: '#5A0E08',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              ...SHADOW,
              left: 22,
              top: 20,
              width: 5,
              height: 6,
              background: '#5A0E08',
              borderRadius: '50%',
            }}
          />
        </div>
      </div>
    </>
  )
}
