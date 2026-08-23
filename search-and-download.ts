import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const REAL_ASSETS_DIR = '/home/z/my-project/data/assets/real'

async function searchWikimedia(query: string): Promise<any[]> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search',
    gsrsearch: query, gsrnamespace: '6', gsrlimit: '10',
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1920',
  })
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'MoneyMachineDocumentaryBot/1.0 (research; educational)' },
  })
  if (!res.ok) return []
  const data = await res.json()
  const pages = data?.query?.pages
  if (!pages) return []
  return Object.values<any>(pages).map(p => ({
    title: p.title,
    url: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url,
    mime: p.imageinfo?.[0]?.mime,
    license: p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value || '',
    artist: (p.imageinfo?.[0]?.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 100),
  })).filter(r => r.url && r.mime?.startsWith('image/'))
}

async function download(url: string, dest: string): Promise<number> {
  const res = await fetch(url, { headers: { 'User-Agent': 'MoneyMachineDocBot/1.0' } })
  if (!res.ok) return 0
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 5000) return 0
  await writeFile(dest, buf)
  return buf.length
}

async function main() {
  if (!existsSync(REAL_ASSETS_DIR)) await mkdir(REAL_ASSETS_DIR, { recursive: true })
  
  const targets = [
    { beatId: 'beat_4', queries: ['Nokia N70', 'Nokia Symbian phone', 'Nokia smartphone 2005'] },
    { beatId: 'beat_5', queries: ['Stephen Elop Nokia', 'Nokia CEO 2011'] },
    { beatId: 'beat_10', queries: ['Nokia House Espoo', 'Nokia headquarters building', 'Nokia office'] },
    { beatId: 'beat_11', queries: ['Nokia Lumia 925', 'Nokia Lumia Windows Phone', 'Nokia Lumia 800'] },
    { beatId: 'beat_17', queries: ['Nokia Corporation logo', 'Nokia brand', 'Nokia sign'] },
  ]
  
  for (const target of targets) {
    console.log(`\n[${target.beatId}] Searching...`)
    let found = false
    for (const q of target.queries) {
      if (found) break
      const results = await searchWikimedia(q)
      for (const r of results) {
        if (r.mime === 'image/svg+xml') continue // skip SVG
        const ext = r.mime === 'image/jpeg' ? 'jpg' : 'png'
        const dest = path.join(REAL_ASSETS_DIR, `${target.beatId}_real.${ext}`)
        const size = await download(r.url, dest)
        if (size > 5000) {
          console.log(`  ✓ "${r.title}" — ${size} bytes, license: ${r.license || 'See source'}`)
          found = true
          break
        }
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    if (!found) console.log(`  ✗ No suitable image found`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
