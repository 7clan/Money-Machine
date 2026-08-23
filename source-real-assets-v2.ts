import { writeFile, mkdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const REAL_ASSETS_DIR = path.join(DATA_DIR, 'assets', 'real')

const ASSET_SPECS = [
  { beatId: 'beat_1', query: 'Nokia 3310', desc: 'Classic Nokia phone — the iconic device that symbolized Nokia dominance' },
  { beatId: 'beat_2', query: 'Nokia mobile phone', desc: 'Nokia phone product line representing peak market dominance' },
  { beatId: 'beat_3', query: 'iPhone first generation', desc: 'The original iPhone that disrupted Nokia in 2007' },
  { beatId: 'beat_4', query: 'Symbian', desc: 'Symbian OS logo/interface — the aging platform that couldn\'t compete' },
  { beatId: 'beat_5', query: 'Stephen Elop', desc: 'Nokia CEO Stephen Elop who wrote the burning platform memo' },
  { beatId: 'beat_8', query: 'Android operating system', desc: 'Android logo — the rising competitor that displaced Nokia' },
  { beatId: 'beat_10', query: 'Nokia headquarters Espoo', desc: 'Nokia headquarters building in Espoo, Finland' },
  { beatId: 'beat_11', query: 'Nokia Lumia', desc: 'Nokia Lumia running Windows Phone — the too-late response' },
  { beatId: 'beat_16', query: 'Nokia logo', desc: 'Nokia corporate logo — for the lesson/transition section' },
  { beatId: 'beat_17', query: 'Nokia Corporation', desc: 'Nokia brand identity for the ending section' },
]

async function searchWikimediaCommons(query: string): Promise<any | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '5',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size|mime',
    iiurlwidth: '1920',
  })
  const url = `https://commons.wikimedia.org/w/api.php?${params}`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MoneyMachineDocumentaryBot/1.0 (educational research; contact@example.com)' },
    })
    if (!res.ok) {
      console.warn(`  API returned HTTP ${res.status}`)
      return null
    }
    const data = await res.json()
    const pages = data?.query?.pages
    if (!pages) return null
    // Find the first valid image
    for (const page of Object.values<any>(pages)) {
      const imageInfo = page?.imageinfo?.[0]
      if (!imageInfo) continue
      // Prefer thumburl, fall back to url
      const imgUrl = imageInfo.thumburl || imageInfo.url
      if (!imgUrl || !imageInfo.mime?.startsWith('image/')) continue
      // Skip SVG (poor quality for video) unless it's the only option
      const isSvg = imageInfo.mime === 'image/svg+xml'
      return {
        url: imgUrl,
        originalUrl: imageInfo.url,
        title: page.title,
        license: imageInfo.extmetadata?.LicenseShortName?.value || 'See source',
        artist: stripHtml(imageInfo.extmetadata?.Artist?.value || ''),
        credit: stripHtml(imageInfo.extmetadata?.Credit?.value || ''),
        width: imageInfo.thumbwidth || imageInfo.width,
        height: imageInfo.thumbheight || imageInfo.height,
        isSvg,
        mime: imageInfo.mime,
      }
    }
  } catch (e: any) {
    console.warn(`  Wikimedia API error for "${query}": ${e.message.slice(0, 80)}`)
  }
  return null
}

async function downloadImage(url: string, destPath: string): Promise<number> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MoneyMachineDocumentaryBot/1.0 (educational research)' },
    })
    if (!res.ok) return 0
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 5000) return 0
    await writeFile(destPath, buf)
    return buf.length
  } catch (e: any) {
    return 0
  }
}

function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim().slice(0, 200)
}

async function main() {
  if (!existsSync(REAL_ASSETS_DIR)) await mkdir(REAL_ASSETS_DIR, { recursive: true })
  const results: any[] = []
  let successCount = 0

  for (const spec of ASSET_SPECS) {
    console.log(`\n[${spec.beatId}] Searching Wikimedia Commons: "${spec.query}"`)
    const result = await searchWikimediaCommons(spec.query)
    if (!result) {
      console.log(`  ✗ No image found`)
      results.push({ ...spec, status: 'NOT_FOUND' })
      continue
    }
    
    const ext = result.url.includes('.png') ? 'png' : result.url.includes('.jpg') || result.url.includes('.jpeg') ? 'jpg' : 'png'
    const localPath = path.join(REAL_ASSETS_DIR, `${spec.beatId}_real.${ext}`)
    const size = await downloadImage(result.url, localPath)
    
    if (size > 5000) {
      console.log(`  ✓ Downloaded: ${result.title}`)
      console.log(`    Size: ${size} bytes | ${result.width}x${result.height} | License: ${result.license}`)
      console.log(`    Creator: ${result.artist || 'Unknown'}`)
      results.push({
        ...spec,
        status: 'DOWNLOADED',
        localPath,
        sourceUrl: result.originalUrl,
        license: result.license,
        artist: result.artist,
        size,
      })
      successCount++
    } else {
      console.log(`  ✗ Download failed`)
      results.push({ ...spec, status: 'DOWNLOAD_FAILED' })
    }
    
    // Be polite to the API
    await new Promise(r => setTimeout(r, 1000))
  }

  // Save manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalRequested: ASSET_SPECS.length,
    successful: successCount,
    assets: results,
  }
  const manifestPath = path.join(DATA_DIR, 'pipeline-state', 'real-assets-manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`\n=== REAL ASSET SOURCING COMPLETE ===`)
  console.log(`Downloaded: ${successCount}/${ASSET_SPECS.length}`)
  console.log(`Manifest: ${manifestPath}`)
  
  // List all downloaded files with provenance
  console.log(`\n=== PROVENANCE REPORT ===`)
  for (const r of results.filter(r => r.status === 'DOWNLOADED')) {
    console.log(`  ${r.beatId}: ${r.query}`)
    console.log(`    File: ${r.localPath} (${r.size} bytes)`)
    console.log(`    Source: ${r.sourceUrl}`)
    console.log(`    License: ${r.license} | Creator: ${r.artist || 'Unknown'}`)
    console.log(`    Reason: ${r.desc}`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
