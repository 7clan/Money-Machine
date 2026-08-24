/**
 * Diagram Component — organizational/architecture diagrams
 *
 * Renders progressive-build diagrams for:
 * - Organizational hierarchy (fear blocking communication)
 * - Symbian architecture layers
 * - Brain drain (arrows leaving)
 * - Silo diagram (departments isolated)
 *
 * Nodes appear progressively, arrows draw in, labels fade.
 */

import React from 'react'
import { AbsoluteFill, interpolate, Easing } from 'remotion'
import type { StoryBeat } from '../../engine/v3/types'
import type { VisualShot } from '../../engine/v3/visual-shots'

interface DiagramComponentProps {
  beat: StoryBeat
  frame: number
  fps: number
  durationFrames: number
  shot?: VisualShot
}

export const DiagramComponent: React.FC<DiagramComponentProps> = ({ beat, frame, durationFrames, shot }) => {
  const purpose = shot?.purpose || beat.visualIntent || ''
  const progress = interpolate(frame, [0, Math.min(60, durationFrames * 0.6)], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  })

  // Determine diagram type from the purpose text
  const isOrgChart = /hierarch|communication|fear|suppress/i.test(purpose)
  const isArchitecture = /symbian|architecture|layer|complex/i.test(purpose)
  const isBrainDrain = /brain drain|engineers.*left|leaving/i.test(purpose)
  const isSilos = /silo|collaboration|department/i.test(purpose)
  const isComparison = /comparison|fear.*vs|safe/i.test(purpose)

  if (isOrgChart) {
    return <OrgChartDiagram progress={progress} beat={beat} />
  }
  if (isArchitecture) {
    return <ArchitectureDiagram progress={progress} beat={beat} />
  }
  if (isBrainDrain) {
    return <BrainDrainDiagram progress={progress} beat={beat} />
  }
  if (isSilos) {
    return <SiloDiagram progress={progress} beat={beat} />
  }
  if (isComparison) {
    return <ComparisonDiagram progress={progress} beat={beat} />
  }
  return <GenericDiagram progress={progress} beat={beat} />
}

// ─── Org Chart: hierarchy with fear blocking upward communication ───
const OrgChartDiagram: React.FC<{ progress: number; beat: StoryBeat }> = ({ progress, beat }) => {
  const nodeOpacity = (delay: number) => interpolate(progress, [delay, delay + 0.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const arrowProgress = interpolate(progress, [0.5, 0.9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      <div style={{ position: 'absolute', top: 80, left: 60, color: '#ffffff', fontSize: 36, fontWeight: 'bold', fontFamily: 'Arial' }}>
        {beat.title || 'Organizational Culture'}
      </div>

      {/* Top: CEO/Management */}
      <div style={{
        position: 'absolute', top: 180, left: '50%', transform: 'translateX(-50%)',
        backgroundColor: '#1e3a5f', borderRadius: 8, padding: '16px 32px',
        color: '#ffffff', fontSize: 24, fontFamily: 'Arial', opacity: nodeOpacity(0),
      }}>
        Top Management
      </div>

      {/* Middle: Middle Management (with fear label) */}
      <div style={{
        position: 'absolute', top: 300, left: '50%', transform: 'translateX(-50%)',
        backgroundColor: '#7f1d1d', borderRadius: 8, padding: '16px 32px',
        color: '#ffffff', fontSize: 24, fontFamily: 'Arial', opacity: nodeOpacity(0.15),
      }}>
        Middle Management
        <div style={{ fontSize: 16, color: '#fca5a5', marginTop: 4 }}>Fear of speaking up</div>
      </div>

      {/* Bottom: Engineers/Staff */}
      <div style={{
        position: 'absolute', top: 440, left: '50%', transform: 'translateX(-50%)',
        backgroundColor: '#1e3a5f', borderRadius: 8, padding: '16px 32px',
        color: '#ffffff', fontSize: 24, fontFamily: 'Arial', opacity: nodeOpacity(0.3),
      }}>
        Engineers & Staff
      </div>

      {/* Blocked upward arrow (red X) */}
      <div style={{
        position: 'absolute', top: 370, left: '50%', transform: 'translateX(-50%)',
        fontSize: 40, color: '#ff3d57', opacity: arrowProgress * 0.9,
      }}>
        ✕ Blocked
      </div>

      {/* Downward arrow (information flows down but not up) */}
      <div style={{
        position: 'absolute', top: 250, left: '45%',
        fontSize: 30, color: '#6b7280', opacity: arrowProgress,
      }}>
        ↓
      </div>

      <div style={{ position: 'absolute', bottom: 60, left: 60, color: '#9ca3af', fontSize: 20, fontFamily: 'Arial' }}>
        Source: Insead study, 2015
      </div>
    </AbsoluteFill>
  )
}

// ─── Architecture: Symbian layers ───
const ArchitectureDiagram: React.FC<{ progress: number; beat: StoryBeat }> = ({ progress, beat }) => {
  const layers = ['UI Framework', 'Application Layer', 'Middleware', 'OS Kernel', 'Hardware Abstraction']
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      <div style={{ position: 'absolute', top: 80, left: 60, color: '#ffffff', fontSize: 36, fontWeight: 'bold', fontFamily: 'Arial' }}>
        Symbian Architecture
      </div>
      {layers.map((layer, i) => {
        const layerProgress = interpolate(progress, [i * 0.15, i * 0.15 + 0.15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899']
        return (
          <div key={i} style={{
            position: 'absolute',
            top: 180 + i * 80,
            left: '15%', right: '15%',
            backgroundColor: colors[i],
            borderRadius: 8,
            padding: '12px 24px',
            color: '#ffffff', fontSize: 22, fontFamily: 'Arial',
            opacity: layerProgress,
            transform: `translateX(${(1 - layerProgress) * -50}px)`,
          }}>
            {layer}
          </div>
        )
      })}
      <div style={{ position: 'absolute', bottom: 60, right: 60, color: '#ff3d57', fontSize: 20, fontFamily: 'Arial', opacity: progress > 0.8 ? 1 : 0 }}>
        5 layers → difficult to modify
      </div>
    </AbsoluteFill>
  )
}

// ─── Brain Drain: arrows leaving ───
const BrainDrainDiagram: React.FC<{ progress: number; beat: StoryBeat }> = ({ progress, beat }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      <div style={{ position: 'absolute', top: 80, left: 60, color: '#ffffff', fontSize: 36, fontWeight: 'bold', fontFamily: 'Arial' }}>
        Brain Drain
      </div>
      {/* Nokia box */}
      <div style={{
        position: 'absolute', top: 250, left: '15%',
        backgroundColor: '#1e3a5f', borderRadius: 8, padding: '20px 40px',
        color: '#ffffff', fontSize: 28, fontFamily: 'Arial',
        opacity: interpolate(progress, [0, 0.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        Nokia
      </div>
      {/* Departing engineers */}
      {['Engineer 1', 'Engineer 2', 'Engineer 3'].map((label, i) => {
        const p = interpolate(progress, [0.3 + i * 0.15, 0.5 + i * 0.15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return (
          <div key={i}>
            <div style={{
              position: 'absolute',
              top: 200 + i * 80,
              left: `${40 + p * 35}%`,
              color: '#ff3d57', fontSize: 24, fontFamily: 'Arial', opacity: p,
            }}>
              → {label}
            </div>
          </div>
        )
      })}
      <div style={{ position: 'absolute', top: 250, right: '10%', color: '#10b981', fontSize: 28, fontFamily: 'Arial', opacity: progress > 0.8 ? 1 : 0 }}>
        Competitors
      </div>
    </AbsoluteFill>
  )
}

// ─── Silo Diagram: departments isolated ───
const SiloDiagram: React.FC<{ progress: number; beat: StoryBeat }> = ({ progress, beat }) => {
  const depts = ['Hardware', 'Software', 'Design', 'Marketing']
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      <div style={{ position: 'absolute', top: 80, left: 60, color: '#ffffff', fontSize: 36, fontWeight: 'bold', fontFamily: 'Arial' }}>
        Internal Silos
      </div>
      {depts.map((dept, i) => {
        const p = interpolate(progress, [i * 0.1, i * 0.1 + 0.2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        return (
          <div key={i} style={{
            position: 'absolute',
            top: 220,
            left: `${10 + i * 22}%`,
            backgroundColor: '#1e3a5f',
            borderRadius: 8,
            padding: '16px 24px',
            color: '#ffffff', fontSize: 20, fontFamily: 'Arial',
            opacity: p,
            border: '2px solid #374151',
          }}>
            {dept}
            {/* Blocked arrows between departments */}
            {i < 3 && (
              <div style={{
                position: 'absolute', top: '50%', right: -30,
                color: '#ff3d57', fontSize: 20, opacity: p > 0.5 ? 0.6 : 0,
              }}>✕</div>
            )}
          </div>
        )
      })}
      <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', color: '#9ca3af', fontSize: 22, fontFamily: 'Arial', opacity: progress > 0.7 ? 1 : 0 }}>
        No cross-department collaboration
      </div>
    </AbsoluteFill>
  )
}

// ─── Comparison Diagram: fear vs safety ───
const ComparisonDiagram: React.FC<{ progress: number; beat: StoryBeat }> = ({ progress, beat }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      <div style={{ position: 'absolute', top: 80, left: 60, color: '#ffffff', fontSize: 36, fontWeight: 'bold', fontFamily: 'Arial' }}>
        Culture Comparison
      </div>
      {/* Left: Fear-based */}
      <div style={{
        position: 'absolute', top: 200, left: '5%', width: '40%',
        backgroundColor: '#7f1d1d', borderRadius: 12, padding: 32,
        opacity: interpolate(progress, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <div style={{ color: '#ffffff', fontSize: 28, fontWeight: 'bold', fontFamily: 'Arial' }}>Fear-Based</div>
        <div style={{ color: '#fca5a5', fontSize: 20, marginTop: 16, fontFamily: 'Arial' }}>• Bad news suppressed</div>
        <div style={{ color: '#fca5a5', fontSize: 20, marginTop: 8, fontFamily: 'Arial' }}>• Innovation stifled</div>
        <div style={{ color: '#fca5a5', fontSize: 20, marginTop: 8, fontFamily: 'Arial' }}>• Talent leaves</div>
      </div>
      {/* Right: Safety-based */}
      <div style={{
        position: 'absolute', top: 200, right: '5%', width: '40%',
        backgroundColor: '#14532d', borderRadius: 12, padding: 32,
        opacity: interpolate(progress, [0.3, 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <div style={{ color: '#ffffff', fontSize: 28, fontWeight: 'bold', fontFamily: 'Arial' }}>Psychological Safety</div>
        <div style={{ color: '#86efac', fontSize: 20, marginTop: 16, fontFamily: 'Arial' }}>• Dissent encouraged</div>
        <div style={{ color: '#86efac', fontSize: 20, marginTop: 8, fontFamily: 'Arial' }}>• Innovation thrives</div>
        <div style={{ color: '#86efac', fontSize: 20, marginTop: 8, fontFamily: 'Arial' }}>• Talent stays</div>
      </div>
      {/* VS */}
      <div style={{
        position: 'absolute', top: 280, left: '50%', transform: 'translateX(-50%)',
        color: '#6b7280', fontSize: 36, fontWeight: 'bold', fontFamily: 'Arial',
        opacity: interpolate(progress, [0.4, 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        VS
      </div>
    </AbsoluteFill>
  )
}

// ─── Generic Diagram ───
const GenericDiagram: React.FC<{ progress: number; beat: StoryBeat }> = ({ progress, beat }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0f1a' }}>
      <div style={{
        position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
        color: '#ffffff', fontSize: 36, fontWeight: 'bold', fontFamily: 'Arial',
        opacity: progress,
      }}>
        {beat.title || beat.narration.slice(0, 60)}
      </div>
    </AbsoluteFill>
  )
}
