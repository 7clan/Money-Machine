/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const ROOT = '/home/z/my-project'
const LOG_DIR = path.join(ROOT, 'data', 'reconstructions', 'capability-showcase-001', 'logs')
fs.mkdirSync(LOG_DIR, { recursive: true })
const out = fs.openSync(path.join(LOG_DIR, 'reconstruction.stdout.log'), 'w')
const err = fs.openSync(path.join(LOG_DIR, 'reconstruction.stderr.log'), 'w')
const child = spawn('bunx', ['tsx', 'scripts/reconstruct/capability-showcase-001.ts'], {
  cwd: ROOT,
  env: { ...process.env, CYCLE_DETACHED: '1' },
  detached: true,
  stdio: ['ignore', out, err],
})
child.unref()
console.log(`launched reconstruction pid=${child.pid}`)
process.exit(0)
