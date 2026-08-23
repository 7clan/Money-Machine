import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const REAL_ASSETS_DIR = '/home/z/my-project/data/assets/real'

// Known Wikimedia Commons image URLs for Nokia documentary
const KNOWN_IMAGES = [
  { beatId: 'beat_4', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Nokia_N70_%282005%29.JPG/1920px-Nokia_N70_%282005%29.JPG', ext: 'jpg', title: 'Nokia N70 running Symbian', license: 'CC BY-SA 3.0', artist: 'Unknown' },
  { beatId: 'beat_5', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Stephen_Elop_2011.jpg/1920px-Stephen_Elop_2011.jpg', ext: 'jpg', title: 'Stephen Elop', license: 'CC BY 2.0', artist: 'Unknown' },
  { beatId: 'beat_10', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Nokia_House.jpg/1920px-Nokia_House.jpg', ext: 'jpg', title: 'Nokia House headquarters', license: 'CC BY-SA 3.0', artist: 'Unknown' },
  { beatId: 'beat_11', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Nokia_Lumia_925.jpg/1920px-Nokia_Lumia_925.jpg', ext: 'jpg', title: 'Nokia Lumia 925 Windows Phone', license: 'CC BY-SA 3.0', artist: 'Unknown' },
]

async function main() {
  if (!existsSync(REAL_ASSETS_DIR)) await mkdir(REAL_ASSETS_DIR, { recursive: true })
  
  for (const img of KNOWN_IMAGES) {
    console.log(`[${img.beatId}] Downloading ${img.title}...`)
    try {
      const res = await fetch(img.url, { headers: { 'User-Agent': 'MoneyMachineDocBot/1.0' } })
      if (!res.ok) {
        console.log(`  ✗ HTTP ${res.status}`)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 5000) {
        console.log(`  ✗ Too small (${buf.length} bytes)`)
        continue
      }
      const localPath = path.join(REAL_ASSETS_DIR, `${img.beatId}_real.${img.ext}`)
      await writeFile(localPath, buf)
      console.log(`  ✓ Downloaded: ${buf.length} bytes, license: ${img.license}`)
    } catch (e: any) {
      console.log(`  ✗ Error: ${e.message.slice(0, 80)}`)
    }
    await new Promise(r => setTimeout(r, 1000))
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
