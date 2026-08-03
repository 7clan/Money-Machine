/**
 * One-off DB cleanup script:
 *  - Remove duplicate ContentPillar rows (keep oldest by createdAt)
 *  - Normalize existing AuditLog rows that were saved with action='strategy_change'
 *    into proper categories using the same logic as engine/agent.ts categorizeAction.
 *
 * Run once: bun run src/scripts/cleanup-db.ts
 */
import { db } from '../lib/db'

function categorize(message: string): string {
  const m = (message || '').toLowerCase()
  if (/(emergency stop|e-?stop|paused|resuming|agent start)/.test(m)) return 'emergency_stop'
  if (/(mode change|simulation mode|private production|autonomous)/.test(m)) return 'mode_change'
  if (/(upload|thumbnail upload|youtube)/.test(m)) return 'upload'
  if (/(quality review|review passed|review failed|fact check|originality|policy)/.test(m)) return 'metadata_update'
  if (/(render|video rendered|encoding)/.test(m)) return 'metadata_update'
  if (/(script|writing script)/.test(m)) return 'metadata_update'
  if (/(research|topic research|niche research)/.test(m)) return 'metadata_update'
  if (/(strategy|channel|pillar|niche)/.test(m)) return 'strategy_change'
  if (/(error|fail|failed)/.test(m)) return 'metadata_update'
  return 'metadata_update'
}

async function main() {
  // 1) Deduplicate ContentPillar by name (keep oldest)
  const pillars = await db.contentPillar.findMany({ orderBy: { createdAt: 'asc' } })
  const seen = new Set<string>()
  let pillarDeleted = 0
  for (const p of pillars) {
    if (seen.has(p.name)) {
      // Reassign any VideoIdeas referencing the duplicate to the kept pillar id
      const keptId = pillars.find(x => x.name === p.name && x.id !== p.id)?.id
      if (keptId) {
        await db.videoIdea.updateMany({ where: { pillarId: p.id }, data: { pillarId: keptId } })
      }
      await db.contentPillar.delete({ where: { id: p.id } })
      pillarDeleted++
    } else {
      seen.add(p.name)
    }
  }
  console.log(`ContentPillar dedup: removed ${pillarDeleted} duplicates`)

  // 2) Normalize AuditLog action categories
  const logs = await db.auditLog.findMany()
  let logUpdated = 0
  for (const log of logs) {
    let message = ''
    if (log.details) {
      try {
        const parsed = JSON.parse(log.details)
        if (parsed && typeof parsed === 'object' && 'message' in parsed) {
          message = parsed.message
        } else {
          message = String(log.details)
        }
      } catch {
        message = String(log.details)
      }
    }
    const newAction = categorize(message)
    if (log.action !== newAction) {
      await db.auditLog.update({ where: { id: log.id }, data: { action: newAction } })
      logUpdated++
    }
  }
  console.log(`AuditLog recategorized: ${logUpdated} of ${logs.length} rows updated`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
