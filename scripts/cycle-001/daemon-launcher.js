/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Daemon launcher — fully detaches the cycle-001 orchestrator so it survives
 * the parent bash session exit. Uses child_process.spawn(detached:true) + unref().
 */
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = '/home/z/my-project'
const LOG_DIR = path.join(ROOT, 'data', 'autonomous-runs', 'cycle-001', 'logs')
fs.mkdirSync(LOG_DIR, { recursive: true })

const out = fs.openSync(path.join(LOG_DIR, 'orchestrator.stdout.log'), 'w')
const err = fs.openSync(path.join(LOG_DIR, 'orchestrator.stderr.log'), 'w')

const child = spawn('bunx', ['tsx', 'scripts/cycle-001/orchestrator.ts'], {
  cwd: ROOT,
  env: { ...process.env, CYCLE_DETACHED: '1' },
  detached: true,
  stdio: ['ignore', out, err],
})

child.unref()
console.log(`launched cycle-001 orchestrator pid=${child.pid}`)
process.exit(0)
