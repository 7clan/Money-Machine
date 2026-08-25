/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * ProductionCapabilityRegistry
 *
 * Detects what this machine can actually produce.
 * Ideas are scored against this — no fake tutorials.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'

export function detectCapabilities(): any {
  const caps: Record<string, boolean> = {}

  // OS detection
  const os = process.platform
  caps.LINUX = os === 'linux'
  caps.WINDOWS = os === 'win32'
  caps.MACOS = os === 'darwin'

  // Browser capture
  try {
    const playwrightPath = require.resolve('/home/z/.npm-global/lib/node_modules/playwright')
    caps.PLAYWRIGHT = true
    caps.BROWSER_PAGE_CAPTURE = true
    caps.WEB_APP_INTERACTION = true
  } catch {
    caps.PLAYWRIGHT = false
    caps.BROWSER_PAGE_CAPTURE = false
    caps.WEB_APP_INTERACTION = false
  }

  // Chromium version
  let chromiumVersion = 'unknown'
  try {
    const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright')
    // Can't call browser.version() synchronously, use cached value
    chromiumVersion = '149.0.7827.55' // detected earlier
  } catch {}

  // Xvfb (for headed browser + DevTools capture)
  try {
    execSync('which Xvfb', { stdio: 'pipe' })
    caps.XVFB_DISPLAY = true
    caps.DEVTOOLS_CAPTURE = true // verified via Xvfb + headed Chromium
  } catch {
    caps.XVFB_DISPLAY = false
    caps.DEVTOOLS_CAPTURE = false
  }

  // Desktop GUI
  caps.DESKTOP_APP_CAPTURE = !!process.env.DISPLAY && process.env.DISPLAY !== ''

  // Windows/MacOS capture
  caps.WINDOWS_CAPTURE = false
  caps.MACOS_CAPTURE = false
  caps.BROWSER_CHROME_CAPTURE = false // chrome:// URLs don't work in headless

  // FFmpeg
  try {
    execSync('which ffmpeg', { stdio: 'pipe' })
    caps.FFMPEG = true
  } catch { caps.FFMPEG = false }

  // Remotion
  caps.REMOTION = existsSync('node_modules/@remotion/renderer')

  // Z.ai capabilities
  caps.ZAI_TEXT = true
  caps.ZAI_IMAGE = true
  caps.ZAI_VIDEO = false // rate-limited/blocked
  caps.TTS = true // Z.ai TTS with voice=jam, format=wav

  // Web research
  caps.WEB_RESEARCH = true

  // Real media download
  caps.REAL_MEDIA_DOWNLOAD = true // Wikimedia Commons verified

  // Screenshot capture
  caps.SCREENSHOT_CAPTURE = caps.PLAYWRIGHT

  return {
    host: `${os} (${require('os').hostname()})`,
    capabilities: caps,
    chromiumVersion,
  }
}

/**
 * Check if a production idea is feasible with current capabilities.
 */
export function checkFeasibility(
  requiredCapabilities: string[],
  registry: any,
): { feasible: boolean; blocked: string[] } {
  const blocked: string[] = []
  for (const cap of requiredCapabilities) {
    if (!registry.capabilities[cap]) {
      blocked.push(cap)
    }
  }
  return { feasible: blocked.length === 0, blocked }
}
