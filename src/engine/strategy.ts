/**
 * Strategy Engine
 * 
 * Defines channel identity, content pillars, visual identity,
 * and generates the initial content calendar based on selected niche.
 * 
 * Uses multiple smaller LLM calls to avoid token limits and truncation.
 */

import { llm, webSearch } from './zai-provider'
import { extractJSONObject, extractJSONArray } from './json-utils'
import { db } from '@/lib/db'
import { getSelectedNiche } from './niche-research'

export interface ChannelStrategy {
  channelName: string
  channelDescription: string
  positioning: string
  targetViewer: string
  brandPromise: string
  contentPillars: Array<{ name: string; description: string; color: string }>
  uploadCadence: string
  visualIdentity: {
    primaryColor: string
    secondaryColor: string
    styleKeywords: string[]
  }
  differentiation: string
  first30VideoIdeas: Array<{ title: string; type: string; pillar: string }>
  first60ShortIdeas: Array<{ title: string; pillar: string }>
  calendar90Days: Array<{ week: number; videos: string[]; shorts: string[] }>
}

export async function createChannelStrategy(): Promise<ChannelStrategy> {
  const niche = await getSelectedNiche()
  if (!niche) throw new Error('No niche selected. Run niche research first.')

  // Step 1: Generate core strategy (channel name, description, pillars)
  const coreResponse = await llm([
    { role: 'system', content: `Create a YouTube channel strategy. Return ONLY valid JSON, no markdown code fences.

RULES:
- Original positioning, not a clone
- All content must be producible with original scripts, screen recordings, code demos, diagrams
- No copyrighted footage
- Genuine viewer value, no clickbait

Return JSON:
{
  "channelName": string,
  "channelDescription": string,
  "positioning": string,
  "targetViewer": string,
  "brandPromise": string,
  "contentPillars": [{ "name": string, "description": string, "color": string }],
  "uploadCadence": string,
  "visualIdentity": { "primaryColor": string, "secondaryColor": string, "styleKeywords": [string] },
  "differentiation": string
}` },
    { role: 'user', content: `Create channel strategy for niche: "${niche.nicheName}"

Scores: compositeScore=${niche.compositeScore}, searchDemand=${niche.searchDemand}, advertiserValue=${niche.advertiserValue}
Notes: ${niche.notes}` },
  ])

  const coreData = extractJSONObject(coreResponse)
  if (!coreData || !coreData.channelName) {
    console.error('Core strategy parse failed. Raw:', coreResponse.slice(0, 500))
    throw new Error('Cannot parse core strategy response')
  }

  // Step 2: Generate video ideas
  const pillarNames = (coreData.contentPillars || []).map((p: any) => p.name).join(', ')
  
  const ideasResponse = await llm([
    { role: 'system', content: `Generate YouTube video ideas. Return ONLY valid JSON, no markdown.

Return:
{
  "longform": [{ "title": string, "pillar": string }],
  "shorts": [{ "title": string, "pillar": string }]
}

Generate 15 longform ideas and 20 shorts ideas.
Each idea must be producible with original scripts, screen recordings, code demos, or diagrams.
No copyrighted content. No clickbait titles.` },
    { role: 'user', content: `Niche: "${niche.nicheName}"
Channel: "${coreData.channelName}"
Content pillars: ${pillarNames}

Generate the ideas now.` },
  ])

  const ideasData = extractJSONObject(ideasResponse)
  
  // Step 3: Generate 90-day calendar
  const calendarResponse = await llm([
    { role: 'system', content: `Create a 90-day content calendar. Return ONLY valid JSON array, no markdown.

Return: [{ "week": number, "videos": [title strings], "shorts": [title strings] }]

Schedule: 1 longform video per week, 2-3 shorts per week.
Be realistic for a solo creator.` },
    { role: 'user', content: `Niche: "${niche.nicheName}"
Longform ideas: ${(ideasData?.longform || []).slice(0, 15).map((i: any) => i.title).join(', ')}
Shorts ideas: ${(ideasData?.shorts || []).slice(0, 20).map((i: any) => i.title).join(', ')}` },
  ])

  const calendarData = extractJSONArray(calendarResponse)

  // Assemble full strategy
  const strategy: ChannelStrategy = {
    channelName: coreData.channelName,
    channelDescription: coreData.channelDescription || '',
    positioning: coreData.positioning || '',
    targetViewer: coreData.targetViewer || '',
    brandPromise: coreData.brandPromise || '',
    contentPillars: coreData.contentPillars || [],
    uploadCadence: coreData.uploadCadence || '1 longform/week, 2-3 shorts/week',
    visualIdentity: coreData.visualIdentity || { primaryColor: '#e94560', secondaryColor: '#1a1a2e', styleKeywords: ['clean', 'modern'] },
    differentiation: coreData.differentiation || '',
    first30VideoIdeas: (ideasData?.longform || []).map((i: any) => ({ ...i, type: 'longform' })),
    first60ShortIdeas: ideasData?.shorts || [],
    calendar90Days: calendarData,
  }

  // Store in database
  const existingChannel = await db.channel.findFirst()
  if (!existingChannel) {
    await db.channel.create({
      data: {
        name: strategy.channelName,
        niche: niche.nicheName,
        description: strategy.channelDescription,
        positioning: strategy.positioning,
        targetViewer: strategy.targetViewer,
        brandPromise: strategy.brandPromise,
        uploadCadence: strategy.uploadCadence,
        visualIdentity: JSON.stringify(strategy.visualIdentity),
        bannerSpec: '2560x1440',
        profileImageSpec: '800x800',
      },
    })
  }

  // Create content pillars
  for (const pillar of strategy.contentPillars) {
    await db.contentPillar.create({
      data: { name: pillar.name, description: pillar.description, color: pillar.color },
    })
  }

  // Create video ideas
  const pillars = await db.contentPillar.findMany()
  
  for (const idea of strategy.first30VideoIdeas) {
    const pillar = pillars.find(p => p.name === idea.pillar)
    await db.videoIdea.create({
      data: { title: idea.title, type: 'longform', status: 'idea', pillarId: pillar?.id },
    })
  }

  for (const idea of strategy.first60ShortIdeas) {
    const pillar = pillars.find(p => p.name === idea.pillar)
    await db.videoIdea.create({
      data: { title: idea.title, type: 'short', status: 'idea', pillarId: pillar?.id },
    })
  }

  // Store strategy
  await db.agentState.upsert({
    where: { key: 'channel_strategy' },
    create: { key: 'channel_strategy', value: JSON.stringify(strategy) },
    update: { value: JSON.stringify(strategy) },
  })

  return strategy
}

export async function getChannelStrategy(): Promise<ChannelStrategy | null> {
  const state = await db.agentState.findUnique({ where: { key: 'channel_strategy' } })
  if (!state) return null
  return JSON.parse(state.value)
}
