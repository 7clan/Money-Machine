/**
 * D-PILOT — VLM verdict on the 50s GLOW HOUR animated pilot contact sheet.
 *
 * Frames sampled at 2s / 10s / 20s / 30s / 40s / 48s from
 * data/videos/test-d-pilot-animated.mp4 and tiled 3x2.
 *
 * Run: bun run tmp-scripts/vlm-verdict-pilot.ts
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { vision } from '../src/engine/zai-provider'

const QUESTION = [
  'This is a contact sheet of 6 frames sampled from a 50-second animated short.',
  'Frames read left-to-right, top-to-bottom (sampled at 2s, 10s, 20s, 30s, 40s, 48s).',
  '',
  'Question: Is this intentionally animated with characters that move?',
  '',
  'Criteria: Do characters visibly CHANGE position, pose, expression, or glow between frames?',
  'Do characters appear and multiply across the timeline (e.g., one character alone early,',
  'more characters joining later)? Do they react to each other?',
  '',
  'Answer with exactly one letter first:',
  'A = animated (characters visibly move, enter, react, and/or interact between frames)',
  'B = slideshow (static images with only slow zoom/pan, no meaningful character motion)',
  '',
  'Then explain your reasoning in 2-3 sentences, listing which characters you see and what changes across the frames.',
].join('\n')

async function main() {
  const buf = await readFile('data/benchmark/test-d/pilot-animated-contact-sheet.jpg')
  const b64 = buf.toString('base64')
  const out = await vision([{
    role: 'user',
    content: [
      { type: 'text', text: QUESTION },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
    ],
  }])
  console.log('=== VLM VERDICT (animated-pilot, 50s) ===')
  console.log(out)
  const dir = path.join(process.cwd(), 'data', 'benchmark', 'test-d')
  await mkdir(dir, { recursive: true })
  const record = {
    task: 'D-PILOT',
    video: 'data/videos/test-d-pilot-animated.mp4',
    contactSheet: 'data/benchmark/test-d/pilot-animated-contact-sheet.jpg',
    sampleTimesSec: [2, 10, 20, 30, 40, 48],
    question: QUESTION,
    verdict: out,
    firstLetter: out.trim()[0]?.toUpperCase() || '?',
    timestamp: new Date().toISOString(),
  }
  await writeFile(
    path.join(dir, 'pilot-animated-vlm-verdict.json'),
    JSON.stringify(record, null, 2)
  )
  console.log('\n[saved] data/benchmark/test-d/pilot-animated-vlm-verdict.json')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e.message)
  process.exit(1)
})
