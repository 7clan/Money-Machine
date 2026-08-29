/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Daemon launcher for `bun run dev` — fully detaches the Next.js dev server.
 */
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = '/home/z/my-project'
const out = fs.openSync(path.join(ROOT, 'dev.log'), 'w')
const err = fs.openSync(path.join(ROOT, 'dev.log'), 'a')

const child = spawn('bun', ['run', 'dev'], {
  cwd: ROOT,
  env: { ...process.env, CYCLE_DETACHED: '1' },
  detached: true,
  stdio: ['ignore', out, err],
})

child.unref()
console.log(`launched next dev pid=${child.pid}`)
process.exit(0)
