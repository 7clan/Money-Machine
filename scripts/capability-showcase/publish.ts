/**
 * AUTONOMOUS CYCLE 001 — Publishing Worker
 *
 * Uses the existing youtube-client.ts uploadVideo() to upload the final
 * video as PRIVATE to the connected YouTube channel. Creates the necessary
 * VideoProject + VideoIdea rows in the DB so uploadVideo() can record against them.
 *
 * Run: bunx tsx scripts/capability-showcase-001/publish.ts
 */
import { uploadVideo, isYouTubeConnected } from '../../src/engine/youtube-client'
import { db } from '../../src/lib/db'
import { readFileSync, writeFileSync } from 'fs'

async function main() {
  const videoPath = process.env.CAPABILITY_SHOWCASE_VIDEO_PATH!
  const title = process.env.CAPABILITY_SHOWCASE_TITLE!
  const description = process.env.CAPABILITY_SHOWCASE_DESCRIPTION!
  const tags = JSON.parse(process.env.CAPABILITY_SHOWCASE_TAGS ?? '[]') as string[]
  const category = process.env.CAPABILITY_SHOWCASE_CATEGORY ?? '27'
  const privacy = (process.env.CAPABILITY_SHOWCASE_PRIVACY ?? 'private') as 'private' | 'unlisted' | 'public'
  const manifestPath = process.env.CAPABILITY_SHOWCASE_MANIFEST!

  console.log('[publish] Cycle 001 publishing worker start')
  console.log(`[publish] videoPath=${videoPath}`)
  console.log(`[publish] title="${title}"`)
  console.log(`[publish] privacy=${privacy}`)

  if (privacy !== 'private') {
    throw new Error(`Cycle 001 MUST publish PRIVATE_ONLY — got privacy=${privacy}. Aborting.`)
  }

  const connected = await isYouTubeConnected()
  if (!connected) {
    throw new Error('YouTube not connected — OAuth required before publishing. Connect via /api/youtube/auth.')
  }
  console.log('[publish] YouTube connection verified')

  // Find or create a ContentPillar for autonomous productions
  let pillar = await db.contentPillar.findFirst({ where: { name: 'Capability Showcase' } })
  if (!pillar) {
    pillar = await db.contentPillar.create({
      data: {
        name: 'Capability Showcase',
        description: 'Autonomously-produced videos by MONEY MACHINE',
        color: '#10b981',
        icon: 'bot',
        priority: 100,
      },
    })
  }
  console.log(`[publish] pillar=${pillar.id}`)

  // Create VideoIdea + Script + VideoProject rows uploadVideo() expects
  const videoIdea = await db.videoIdea.create({
    data: {
      title,
      description,
      pillarId: pillar.id,
      type: 'longform',
      status: 'uploaded',
      tags: JSON.stringify(tags),
    },
  })
  const scriptRow = await db.script.create({
    data: {
      videoIdeaId: videoIdea.id,
      content: description,
      version: 1,
      status: 'approved',
      wordCount: description.split(/\s+/).length,
    },
  })
  const videoProject = await db.videoProject.create({
    data: {
      videoIdeaId: videoIdea.id,
      title,
      status: 'uploading',
      videoFilePath: videoPath,
      resolution: '1080p',
      isApproved: true,
    },
  })
  console.log(`[publish] DB rows ready: videoIdea=${videoIdea.id} script=${scriptRow.id} videoProject=${videoProject.id}`)

  // uploadVideo() handles resumable upload, retries, processing checks, Upload row
  const result = await uploadVideo(videoProject.id, videoPath, {
    title,
    description,
    tags,
    category,
    privacy: 'private', // hard-enforce
    language: 'en-US',
    madeForKids: false,
    isAiGenerated: true,
  })
  console.log(`[publish] uploadVideo result: ${JSON.stringify(result)}`)

  // Update VideoProject + VideoIdea to reflect successful upload
  await db.videoProject.update({ where: { id: videoProject.id }, data: { status: 'uploaded' } })
  await db.videoIdea.update({ where: { id: videoIdea.id }, data: { status: 'published' } })

  // Update manifest with result
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.youtubeVideoId = result.youtubeVideoId
  manifest.uploadStatus = result.uploadStatus
  manifest.privacyStatus = 'private'
  manifest.publishedAt = new Date().toISOString()
  manifest.videoIdeaId = videoIdea.id
  manifest.videoProjectId = videoProject.id
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`[publish] manifest updated: videoId=${result.youtubeVideoId}`)

  await db.$disconnect()
}

main().catch((e) => {
  console.error('[publish] FATAL:', e instanceof Error ? e.message : String(e))
  console.error(e instanceof Error ? e.stack : '')
  process.exit(1)
})
