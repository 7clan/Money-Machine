/**
 * OperatingMode — formal operational modes for MONEY MACHINE.
 *
 * OFF                  — no autonomous productions at all
 * DRY_RUN              — research → selection → planning → QC planning only.
 *                        No expensive production, no upload.
 * PRIVATE_ONLY         — full autonomous production + PRIVATE upload. Never public.
 * REVIEW_BEFORE_PUBLIC — full autonomous production, private/review state first,
 *                        explicit human approval required before public.
 * FULL_AUTOPILOT       — may publish autonomously per configured safety/budget policies.
 *
 * DEFAULT = PRIVATE_ONLY
 *
 * FULL_AUTOPILOT is NEVER the default and must be set explicitly by the owner.
 */
import { db } from '@/lib/db'

export type OperatingMode =
  | 'OFF'
  | 'DRY_RUN'
  | 'PRIVATE_ONLY'
  | 'REVIEW_BEFORE_PUBLIC'
  | 'FULL_AUTOPILOT'

export const DEFAULT_MODE: OperatingMode = 'PRIVATE_ONLY'
export const ALL_MODES: OperatingMode[] = [
  'OFF',
  'DRY_RUN',
  'PRIVATE_ONLY',
  'REVIEW_BEFORE_PUBLIC',
  'FULL_AUTOPILOT',
]

const MODE_KEY = 'operating_mode'

export interface ModeCapabilities {
  canResearch: boolean
  canPlan: boolean
  canProduce: boolean // expensive rendering / TTS / image gen
  canPublishPrivate: boolean
  canPublishPublic: boolean
  requiresHumanApprovalBeforePublic: boolean
}

export function modeCapabilities(mode: OperatingMode): ModeCapabilities {
  switch (mode) {
    case 'OFF':
      return { canResearch: false, canPlan: false, canProduce: false, canPublishPrivate: false, canPublishPublic: false, requiresHumanApprovalBeforePublic: false }
    case 'DRY_RUN':
      return { canResearch: true, canPlan: true, canProduce: false, canPublishPrivate: false, canPublishPublic: false, requiresHumanApprovalBeforePublic: false }
    case 'PRIVATE_ONLY':
      return { canResearch: true, canPlan: true, canProduce: true, canPublishPrivate: true, canPublishPublic: false, requiresHumanApprovalBeforePublic: false }
    case 'REVIEW_BEFORE_PUBLIC':
      return { canResearch: true, canPlan: true, canProduce: true, canPublishPrivate: true, canPublishPublic: true, requiresHumanApprovalBeforePublic: true }
    case 'FULL_AUTOPILOT':
      return { canResearch: true, canPlan: true, canProduce: true, canPublishPrivate: true, canPublishPublic: true, requiresHumanApprovalBeforePublic: false }
  }
}

export async function getOperatingMode(): Promise<OperatingMode> {
  const state = await db.agentState.findUnique({ where: { key: MODE_KEY } })
  if (!state) return DEFAULT_MODE
  const v = state.value as OperatingMode
  return ALL_MODES.includes(v) ? v : DEFAULT_MODE
}

export async function setOperatingMode(mode: OperatingMode): Promise<void> {
  if (!ALL_MODES.includes(mode)) throw new Error(`invalid operating mode: ${mode}`)
  await db.agentState.upsert({
    where: { key: MODE_KEY },
    create: { key: MODE_KEY, value: mode },
    update: { value: mode },
  })
  await db.auditLog.create({
    data: {
      action: 'mode_change',
      actor: 'owner',
      details: JSON.stringify({ mode, at: new Date().toISOString() }),
    },
  })
}

/**
 * Hard guard: throws if the requested action is not allowed in the current mode.
 * Call before any expensive or external action.
 */
export async function guardAction(action: 'research' | 'plan' | 'produce' | 'publish_private' | 'publish_public'): Promise<void> {
  const mode = await getOperatingMode()
  const caps = modeCapabilities(mode)
  const map: Record<typeof action, keyof ModeCapabilities> = {
    research: 'canResearch',
    plan: 'canPlan',
    produce: 'canProduce',
    publish_private: 'canPublishPrivate',
    publish_public: 'canPublishPublic',
  }
  const capKey = map[action]
  if (!caps[capKey]) {
    throw new Error(`MODE_GUARD: action "${action}" is not allowed in mode ${mode}`)
  }
}
