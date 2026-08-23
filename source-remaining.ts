import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'

const REAL_ASSETS_DIR = path.join('/home/z/my-project/data/assets/real')

async function searchAndDownload(query: string, beatId: string): Promise<any> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search',
    gsrsearch: query, gsrnamespace: '6', gsrlimit: '5',
    prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '1920',
  })
  const url = `https://commons.wikimedia.org/w/api.php?${params}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MoneyMachineDocBot/1.0' } })
    if (!res.ok) return null
    const data = await res.json()
    const pages = data?.query?.pages
    if (!pages) return null
    for (const page of Object.values<any>(pages)) {
      const ii = page?.imageinfo?.[0]
      if (!ii || !ii.mime?.startsWith('image/')) continue
      const imgUrl = ii.thumburl || ii.url
      if (!imgUrl) continue
      // Download
      const dlRes = await fetch(imgUrl, { headers: { 'User-Agent': 'MoneyMachineDocBot/1.0' } })
      if (!dlRes.ok) continue
      const buf = Buffer.from(await dlRes.arrayBuffer())
      if (buf.length < 5000) continue
      const ext = ii.mime === 'image/svg+xml' ? 'png' : (ii.mime === 'image/jpeg' ? 'jpg' : 'png')
      const localPath = path.join(REAL_ASSETS_DIR, `${beatId}_real.${ext}`)
      await writeFile(localPath, buf)
      return {
        beatId, localPath, size: buf.length,
        sourceUrl: ii.url, title: page.title,
        license: ii.extmetadata?.LicenseShortName?.value || 'See source',
        artist: (ii.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 200),
      }
    }
  } catch (e: any) {
    console.warn(`  Error: ${e.message.slice(0, 80)}`)
  }
  return null
}

async function main() {
  if (!existsSync(REAL_ASSETS_DIR)) await mkdir(REAL_ASSETS_DIR, { recursive: true })
  
  // Retry the failed beats with different queries
  const retries = [
    { beatId: 'beat_4', query: 'Nokia smartphone Symbian OS' },
    { beatId: 'beat_5', query: 'Nokia CEO' },
    { beatId: 'beat_10', query: 'Nokia office building Finland' },
    { beatId: 'beat_11', query: 'Windows Phone Nokia' },
    { beatId: 'beat_17', query: 'Nokia company' },
  ]
  
  for (const r of retries) {
    console.log(`[${r.beatId}] Retrying: "${r.query}"`)
    const result = await searchAndDownload(r.query, r.beatId)
    if (result) {
      console.log(`  ✓ Downloaded: ${result.title} (${result.size} bytes, ${result.license})`)
    } else {
      console.log(`  ✗ Still no result`)
    }
    await new Promise(resolve => setTimeout(resolve, 2000)) // be polite
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
