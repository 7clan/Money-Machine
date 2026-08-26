import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { vision } from '../src/engine/zai-provider'

const QUESTION = [
  'This is a contact sheet of 6 frames sampled every 2 seconds from a short video.',
  'Look across the frames left-to-right, top-to-bottom (frames at 1s, 3s, 5s, 7s, 9s, 11s).',
  '',
  'Question: Is this an intentionally animated scene with characters that move, react, and interact?',
  'Or is it a slideshow of static images (e.g., only slow zoom/pan on stills)?',
  '',
  'Criteria: Do characters visibly CHANGE position, pose, expression, or glow between frames?',
  'Do characters enter and exit the frame? Do they react to each other?',
  '',
  'Answer with exactly one letter first:',
  'A = animated (characters visibly move, react, and/or interact between frames)',
  'B = slideshow / static images (no meaningful character motion)',
  '',
  'Then explain your reasoning in 2-3 sentences, listing which characters you see and what changes across the frames.',
].join('\n')

async function main() {
  const buf = await readFile('data/benchmark/test-d/animation-proof-contact-sheet.jpg')
  const b64 = buf.toString('base64')
  const out = await vision([{
    role: 'user',
    content: [
      { type: 'text', text: QUESTION },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
    ],
  }])
  console.log('=== VLM VERDICT (animation-proof) ===')
  console.log(out)
  const dir = path.join(process.cwd(), 'data', 'benchmark', 'test-d')
  await mkdir(dir, { recursive: true })
  const record = {
    task: 'D-ANIM-PROOF',
    video: 'data/videos/test-d-animation-proof.mp4',
    contactSheet: 'data/benchmark/test-d/animation-proof-contact-sheet.jpg',
    question: QUESTION,
    verdict: out,
    firstLetter: out.trim()[0]?.toUpperCase() || '?',
    timestamp: new Date().toISOString(),
  }
  await writeFile(path.join(dir, 'animation-proof-vlm-verdict.json'), JSON.stringify(record, null, 2))
  console.log('\n[saved] data/benchmark/test-d/animation-proof-vlm-verdict.json')
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1) })
