/**
 * D-ANIM-PROOF — generate the GLOW HOUR scene background.
 *
 * The TEST D scene images (public/test-d/) were not present in this environment,
 * so we generate one canonical GLOW HOUR background (storybook dusk street with
 * warm lamp glow, NO characters) that the animation-proof composition overlays
 * its vector characters onto.
 *
 * Output: public/test-d/scene-01.png
 */
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { generateImage } from './src/engine/zai-provider'

const OUT_DIR = path.join(process.cwd(), 'public', 'test-d')
const OUT_PATH = path.join(OUT_DIR, 'scene-01.png')

const PROMPT = [
  'Cozy storybook illustration of a quiet cobblestone village street at twilight,',
  '"glow hour" dusk, two warm glowing vintage street lamps, purple-amber sky with early stars,',
  'soft painterly children\'s animation background art, gentle rim light on rooftops,',
  'completely empty street with NO characters, NO people, NO animals,',
  'wide establishing shot, cinematic 16:9, warm and inviting calm mood',
].join(' ')

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log('[bg] generating GLOW HOUR background scene...')
  const buf = await generateImage(PROMPT, '1344x768')
  await writeFile(OUT_PATH, buf)
  console.log(`[bg] wrote ${OUT_PATH} (${(buf.length / 1024).toFixed(0)} KB)`)
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
