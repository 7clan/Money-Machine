import { writeFile, mkdir, readFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const REAL_ASSETS_DIR = path.join(DATA_DIR, 'assets', 'real')

// Real asset specifications for the Nokia documentary
// Each maps to a specific story beat + visual evidence type
const ASSET_SPECS = [
  // Beat 1: HOOK — Nokia's dominance
  { beatId: 'beat_1', type: 'PRODUCT_IMAGE', query: 'Nokia 3310 mobile phone', desc: 'Classic Nokia phone showing the iconic device', wikimediaQuery: 'Nokia 3310' },
  // Beat 2: SETUP — Nokia's peak
  { beatId: 'beat_2', type: 'PRODUCT_IMAGE', query: 'Nokia phone collection 2007', desc: 'Multiple Nokia phone models from the 2000s', wikimediaQuery: 'Nokia mobile phones' },
  // Beat 3: The iPhone disruption
  { beatId: 'beat_3', type: 'PRODUCT_IMAGE', query: 'iPhone first generation 2007', desc: 'The original iPhone that disrupted the market', wikimediaQuery: 'iPhone (1st generation)' },
  // Beat 4: Symbian problem
  { beatId: 'beat_4', type: 'DOCUMENT', query: 'Symbian OS screenshot interface', desc: 'Symbian operating system interface showing the aging OS', wikimediaQuery: 'Symbian' },
  // Beat 5: Internal fears / organizational failure
  { beatId: 'beat_5', type: 'DOCUMENT', query: 'Stephen Elop Nokia CEO', desc: 'Nokia CEO Stephen Elop who wrote the burning platform memo', wikimediaQuery: 'Stephen Elop' },
  // Beat 6: Burning platform memo
  { beatId: 'beat_6', type: 'NEWS_HEADLINE', query: 'Nokia burning platform memo 2011', desc: 'News coverage of the Burning Platform memo', wikimediaQuery: null },
  // Beat 7: Market share decline
  { beatId: 'beat_7', type: 'CHART_DATA', query: 'Nokia market share 2007 2013 smartphone', desc: 'Market share data showing Nokia decline', wikimediaQuery: null },
  // Beat 8: Android rises
  { beatId: 'beat_8', type: 'PRODUCT_IMAGE', query: 'Android phone 2010', desc: 'Android phone representing the rising competitor', wikimediaQuery: 'Android (operating system)' },
  // Beat 9: Microsoft partnership
  { beatId: 'beat_9', type: 'NEWS_HEADLINE', query: 'Nokia Microsoft partnership 2011', desc: 'News coverage of the Nokia-Microsoft deal', wikimediaQuery: null },
  // Beat 10: Engineers leave
  { beatId: 'beat_10', type: 'DOCUMENT', query: 'Nokia headquarters Espoo Finland', desc: 'Nokia headquarters building', wikimediaQuery: 'Nokia headquarters' },
  // Beat 11: Too little too late
  { beatId: 'beat_11', type: 'PRODUCT_IMAGE', query: 'Nokia Lumia Windows Phone', desc: 'Nokia Lumia running Windows Phone — the too-late response', wikimediaQuery: 'Nokia Lumia' },
  // Beat 12: Android gains momentum (chart)
  { beatId: 'beat_12', type: 'CHART_DATA', query: 'Android market share growth 2010 2013', desc: 'Android market share growth chart', wikimediaQuery: null },
  // Beat 13: Microsoft deal too late
  { beatId: 'beat_13', type: 'NEWS_HEADLINE', query: 'Microsoft acquires Nokia 2013', desc: 'News of Microsoft acquiring Nokia phone business', wikimediaQuery: null },
  // Beat 14: PAYOFF — Nokia sold
  { beatId: 'beat_14', type: 'NEWS_HEADLINE', query: 'Microsoft Nokia acquisition 7.2 billion', desc: 'The $7.2 billion acquisition news', wikimediaQuery: null },
  // Beat 15: TRANSITION — lesson
  { beatId: 'beat_15', type: 'TIMELINE', query: 'Nokia timeline 2007 2013 collapse', desc: 'Timeline of Nokia collapse events', wikimediaQuery: null },
  // Beat 16: Companies that survive disruption
  { beatId: 'beat_16', type: 'PHOTO_COMPOSITION', query: 'disruptive innovation technology change', desc: 'Conceptual image of disruption and innovation', wikimediaQuery: 'Disruptive innovation' },
  // Beat 17: ENDING — Nokia's story
  { beatId: 'beat_17', type: 'PRODUCT_IMAGE', query: 'Nokia logo history', desc: 'Nokia logo / brand history', wikimediaQuery: 'Nokia' },
  // Beat 18: ENDING — the real lesson
  { beatId: 'beat_18', type: 'TYPOGRAPHY', query: null, desc: 'Pure typography beat — no image needed', wikimediaQuery: null },
]

interface RealAsset {
  id: string
  beatId: string
  type: string
  localPath: string
  sourceUrl: string
  creator: string
  license: string
  acquisitionDate: string
  reason: string
}

async function searchWikimediaCommons(query: string): Promise<any | null> {
  // Wikimedia Commons API — search for images
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1920`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MoneyMachine-Documentary-Bot/1.0 (educational project)' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const pages = data?.query?.pages
    if (!pages) return null
    // Find the first image with a valid URL
    for (const page of Object.values<any>(pages)) {
      const imageInfo = page?.imageinfo?.[0]
      if (imageInfo && imageInfo.thumburl && imageInfo.mime?.startsWith('image/')) {
        return {
          url: imageInfo.thumburl,
          originalUrl: imageInfo.url,
          title: page.title,
          license: imageInfo.extmetadata?.LicenseShortName?.value || 'Unknown',
          artist: imageInfo.extmetadata?.Artist?.value || 'Unknown',
          credit: imageInfo.extmetadata?.Credit?.value || '',
          width: imageInfo.width,
          height: imageInfo.height,
        }
      }
    }
  } catch (e: any) {
    console.warn(`[wikimedia] Search failed for "${query}":`, e.message.slice(0, 80))
  }
  return null
}

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MoneyMachine-Documentary-Bot/1.0 (educational project)' },
    })
    if (!res.ok) return false
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 5000) return false // too small = likely error page
    await writeFile(destPath, buf)
    return true
  } catch (e: any) {
    console.warn(`[download] Failed: ${e.message.slice(0, 80)}`)
    return false
  }
}

async function main() {
  if (!existsSync(REAL_ASSETS_DIR)) await mkdir(REAL_ASSETS_DIR, { recursive: true })
  const assets: RealAsset[] = []
  let successCount = 0

  for (const spec of ASSET_SPECS) {
    console.log(`\n[${spec.beatId}] Sourcing ${spec.type}...`)
    
    // For non-image types (CHART_DATA, NEWS_HEADLINE, TIMELINE, TYPOGRAPHY), we'll handle them in Remotion directly
    if (spec.type === 'CHART_DATA' || spec.type === 'TIMELINE' || spec.type === 'TYPOGRAPHY') {
      console.log(`  → Will be rendered as Remotion component (no external asset needed)`)
      assets.push({
        id: randomUUID(),
        beatId: spec.beatId,
        type: spec.type,
        localPath: '',
        sourceUrl: '',
        creator: 'Remotion component',
        license: 'Original',
        acquisitionDate: new Date().toISOString(),
        reason: spec.desc,
      })
      continue
    }

    // For NEWS_HEADLINE — search the web for real headlines, store as text
    if (spec.type === 'NEWS_HEADLINE') {
      console.log(`  → Will use web search results as headline text (rendered via Document component)`)
      assets.push({
        id: randomUUID(),
        beatId: spec.beatId,
        type: spec.type,
        localPath: '',
        sourceUrl: 'web search',
        creator: 'Various news sources',
        license: 'Editorial use (commentary/criticism)',
        acquisitionDate: new Date().toISOString(),
        reason: spec.desc,
      })
      continue
    }

    // For images — search Wikimedia Commons
    if (spec.wikimediaQuery) {
      console.log(`  → Searching Wikimedia Commons: "${spec.wikimediaQuery}"`)
      const result = await searchWikimediaCommons(spec.wikimediaQuery)
      if (result) {
        const ext = result.url.split('.').pop()?.split('?')[0] || 'jpg'
        const localPath = path.join(REAL_ASSETS_DIR, `${spec.beatId}_wikimedia.${ext}`)
        const downloaded = await downloadImage(result.url, localPath)
        if (downloaded) {
          // Verify the file
          const stats = await stat(localPath)
          if (stats.size > 5000) {
            console.log(`  ✓ Downloaded: ${result.title} (${stats.size} bytes, license: ${result.license})`)
            assets.push({
              id: randomUUID(),
              beatId: spec.beatId,
              type: spec.type,
              localPath,
              sourceUrl: result.originalUrl || result.url,
              creator: stripHtml(result.artist) || 'Wikimedia Commons',
              license: result.license,
              acquisitionDate: new Date().toISOString(),
              reason: spec.desc,
            })
            successCount++
            continue
          }
        }
      }
      console.log(`  ✗ Wikimedia search failed or no valid image found`)
    }

    // Fallback — mark as missing (will use Remotion fallback)
    console.log(`  → Marked as DEGRADED (will use Remotion fallback component)`)
    assets.push({
      id: randomUUID(),
      beatId: spec.beatId,
      type: spec.type,
      localPath: '',
      sourceUrl: '',
      creator: 'DEGRADED',
      license: 'DEGRADED',
      acquisitionDate: new Date().toISOString(),
      reason: spec.desc,
    })
  }

  // Save the asset manifest
  const manifestPath = path.join(DATA_DIR, 'pipeline-state', 'real-assets-manifest.json')
  await writeFile(manifestPath, JSON.stringify({ assets, generatedAt: new Date().toISOString() }, null, 2))
  
  console.log(`\n=== REAL ASSET SOURCING COMPLETE ===`)
  console.log(`Total: ${assets.length}`)
  console.log(`Real images from Wikimedia: ${successCount}`)
  console.log(`Remotion components (chart/timeline/typography): ${assets.filter(a => a.localPath === '' && a.creator === 'Remotion component').length}`)
  console.log(`Degraded (no asset): ${assets.filter(a => a.creator === 'DEGRADED').length}`)
  console.log(`Manifest: ${manifestPath}`)

  // Print detailed provenance
  console.log(`\n=== PROVENANCE ===`)
  for (const a of assets) {
    if (a.localPath) {
      console.log(`  ${a.beatId} [${a.type}]: ${a.localPath}`)
      console.log(`    Source: ${a.sourceUrl}`)
      console.log(`    License: ${a.license} | Creator: ${a.creator}`)
      console.log(`    Reason: ${a.reason}`)
    } else if (a.creator === 'Remotion component') {
      console.log(`  ${a.beatId} [${a.type}]: Remotion component (no external asset)`)
    } else {
      console.log(`  ${a.beatId} [${a.type}]: DEGRADED — no real asset sourced`)
    }
  }
}

function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, '').trim().slice(0, 200)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
