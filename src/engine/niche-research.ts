/**
 * Niche Research Engine
 * 
 * Researches and scores 30+ YouTube niches using Z.AI LLM + web search.
 * Selects the best niche based on demand, competition, originality, monetisation.
 */

import { llm, webSearch } from './zai-provider'
import { extractJSONArray } from './json-utils'
import { db } from '@/lib/db'

export interface NicheScores {
  nicheName: string
  searchDemand: number
  audienceSize: number
  competition: number
  advertiserValue: number
  sponsorshipPotential: number
  affiliatePotential: number
  evergreenPotential: number
  topicCapacity: number
  productionDifficulty: number
  paidToolsNeeded: number
  copyrightRisk: number
  misinformationRisk: number
  retentionPotential: number
  longFormSuitability: number
  shortsSuitability: number
  internationalPotential: number
  timeToMonetisation: number
  revenuePerHour: number
  compositeScore: number
  notes: string
}

const SCORE_FIELDS = `For each niche, score on a 0-10 scale:
- searchDemand, audienceSize, competition (10=saturated), advertiserValue, sponsorshipPotential, affiliatePotential
- evergreenPotential, topicCapacity (sustain 200+ topics), productionDifficulty (10=hard), paidToolsNeeded
- copyrightRisk, misinformationRisk, retentionPotential, longFormSuitability, shortsSuitability
- internationalPotential, timeToMonetisation (inverse: 10=fast), revenuePerHour
- compositeScore: weighted avg prioritizing originality, viewer value, monetisation, sustainability
- notes: brief explanation

RULES: Prefer ORIGINAL demos/explanations, reject copyrighted footage, reject high misinformation risk, prefer screen recordings/diagrams/code demos.`

export async function researchNiches(): Promise<NicheScores[]> {
  // Generate niches in 3 batches of 10 to avoid token limits
  const batches = [
    'Technology education, software tutorials, coding tutorials, web development, Python programming, JavaScript tutorials, data science, machine learning basics, API development, database tutorials',
    'Cybersecurity basics, Linux tutorials, DevOps tools, cloud computing basics, open-source software, automation tools, no-code platforms, productivity software, AI tools practical, tech career advice',
    'Science explanations, math visualization, statistics basics, electronics basics, 3D printing, home automation, smart home tech, digital privacy, browser extensions, spreadsheet mastery'
  ]

  let allNiches: NicheScores[] = []

  for (let i = 0; i < batches.length; i++) {
    const response = await llm([
      { role: 'system', content: `You are a YouTube channel strategy expert. Return ONLY a valid JSON array. No markdown, no code fences, just the raw JSON array.

${SCORE_FIELDS}` },
      { role: 'user', content: `Score these 10 YouTube niches for a solo creator who writes original scripts, creates screen recordings/code demos/diagrams, and uses properly licensed assets:

${batches[i]}

Return the JSON array now.` },
    ])

    const parsed = extractJSONArray(response)
    // Normalize field names (LLM may return "niche" instead of "nicheName")
    const normalized = parsed.map((item: any) => ({
      ...item,
      nicheName: item.nicheName || item.niche || item.name || `Niche ${parsed.indexOf(item) + 1}`,
    }))
    if (normalized.length > 0 && normalized[0].nicheName) {
      allNiches = allNiches.concat(normalized)
    } else {
      console.warn(`Batch ${i + 1} failed to parse. Response preview:`, response.slice(0, 200))
    }
  }

  if (allNiches.length === 0) {
    throw new Error('All niche research batches failed - LLM did not return valid JSON')
  }

  // Supplement top candidates with web search
  const topNiches = allNiches
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, 10)

  for (const niche of topNiches) {
    try {
      const searchResults = await webSearch(
        `YouTube ${niche.nicheName} channel how to grow 2025`,
        5
      )
      niche.notes = (niche.notes || '') + ` | Search: ${searchResults.slice(0, 2).map(r => r.snippet).join('; ')}`
    } catch (e) {
      console.warn(`Web search failed for niche "${niche.nicheName}"`)
    }
  }

  // Store results in database
  for (const niche of allNiches) {
    await db.nicheAnalysis.create({
      data: {
        nicheName: niche.nicheName,
        searchDemand: niche.searchDemand || 5,
        audienceSize: niche.audienceSize || 5,
        competition: niche.competition || 5,
        advertiserValue: niche.advertiserValue || 5,
        sponsorshipPotential: niche.sponsorshipPotential || 5,
        affiliatePotential: niche.affiliatePotential || 5,
        evergreenPotential: niche.evergreenPotential || 5,
        topicCapacity: niche.topicCapacity || 5,
        productionDifficulty: niche.productionDifficulty || 5,
        paidToolsNeeded: niche.paidToolsNeeded || 5,
        copyrightRisk: niche.copyrightRisk || 5,
        misinformationRisk: niche.misinformationRisk || 5,
        retentionPotential: niche.retentionPotential || 5,
        longFormSuitability: niche.longFormSuitability || 5,
        shortsSuitability: niche.shortsSuitability || 5,
        internationalPotential: niche.internationalPotential || 5,
        timeToMonetisation: niche.timeToMonetisation || 5,
        revenuePerHour: niche.revenuePerHour || 5,
        compositeScore: niche.compositeScore || 5,
        notes: niche.notes || '',
      },
    })
  }

  // Select the best niche
  const best = allNiches.sort((a, b) => b.compositeScore - a.compositeScore)[0]
  await db.nicheAnalysis.updateMany({
    where: { nicheName: best.nicheName },
    data: { isSelected: true },
  })

  await db.agentState.upsert({
    where: { key: 'selected_niche' },
    create: { key: 'selected_niche', value: JSON.stringify(best) },
    update: { value: JSON.stringify(best) },
  })

  return allNiches.sort((a, b) => b.compositeScore - a.compositeScore)
}

export async function getSelectedNiche(): Promise<NicheScores | null> {
  const state = await db.agentState.findUnique({ where: { key: 'selected_niche' } })
  if (!state) return null
  return JSON.parse(state.value)
}

export async function getAllNicheAnalyses() {
  return db.nicheAnalysis.findMany({ orderBy: { compositeScore: 'desc' } })
}
