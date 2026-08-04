/**
 * Emergency Stop Control
 * 
 * The agent checks this before every action. When stopped,
 * no uploads, no publishing, no new production jobs run.
 * Existing rendering jobs complete but their output is not uploaded.
 */

import { db } from '@/lib/db'

const STOP_KEY = 'emergency_stop'
const MODE_KEY = 'operating_mode'

export type OperatingMode = 'simulation' | 'private_production' | 'autonomous_publication'

export async function isStopped(): Promise<boolean> {
  const state = await db.agentState.findUnique({ where: { key: STOP_KEY } })
  if (!state) return false
  return state.value === 'true'
}

export async function setStopped(stopped: boolean): Promise<void> {
  await db.agentState.upsert({
    where: { key: STOP_KEY },
    create: { key: STOP_KEY, value: String(stopped) },
    update: { value: String(stopped) },
  })
  await db.auditLog.create({
    data: {
      action: 'emergency_stop',
      actor: 'owner',
      details: JSON.stringify({ stopped }),
    },
  })
}

export async function getOperatingMode(): Promise<OperatingMode> {
  const state = await db.agentState.findUnique({ where: { key: MODE_KEY } })
  if (!state) return 'private_production' // default
  return (state.value as OperatingMode) || 'private_production'
}

export async function setOperatingMode(mode: OperatingMode): Promise<void> {
  await db.agentState.upsert({
    where: { key: MODE_KEY },
    create: { key: MODE_KEY, value: mode },
    update: { value: mode },
  })
  await db.auditLog.create({
    data: {
      action: 'mode_change',
      actor: 'owner',
      details: JSON.stringify({ mode }),
    },
  })
}

/**
 * Guard: throws if the agent is stopped.
 * Call this at the start of any autonomous action.
 */
export async function guardNotStopped(): Promise<void> {
  if (await isStopped()) {
    throw new Error('AGENT_STOPPED: Emergency stop is active. All autonomous actions are suspended.')
  }
}
