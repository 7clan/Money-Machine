/**
 * Research Engine
 * 
 * For each video topic: searches sources, records claims, fact-checks.
 * Ensures all content is original and properly sourced.
 */

import { llm, webSearch, readPage } from './zai-provider'
import { extractJSONObject } from './json-utils'
import { db } from '@/lib/db'

export interface ResearchResult {
  sources: Array<{
    title: string
    publisher: string
    url: string
    sourceType: string
    isVerified: boolean
  }>
  claims: Array<{
    claim: string
    sourceIndices: number[]
    isConflicting: boolean
    isUncertain: boolean
  }>
  summary: string
  keyFacts: string[]
}

export async function researchTopic(videoIdeaId: string): Promise<ResearchResult> {
  const idea = await db.videoIdea.findUnique({ where: { id: videoIdeaId } })
  if (!idea) throw new Error(`VideoIdea ${videoIdeaId} not found`)

  // Step 1: Web search for the topic
  const searchResults = await webSearch(
    `${idea.title} explained guide tutorial 2025`,
    10
  )

  // Step 2: Read top results for content
  const pageContents: Array<{ title: string; content: string; url: string }> = []
  for (const result of searchResults.slice(0, 5)) {
    try {
      const page = await readPage(result.url)
      // Truncate to avoid token limits
      pageContents.push({
        title: page.title,
        content: page.html.replace(/<[^>]*>/g, ' ').slice(0, 3000),
        url: result.url,
      })
    } catch {
      // Skip pages that can't be read
    }
  }

  // Step 3: Use LLM to extract claims and sources
  const researchResponse = await llm([
    { role: 'system', content: `You are a research analyst. Extract factual claims from these sources about: "${idea.title}"

For each claim:
- State the claim precisely
- Note which source(s) support it
- Flag if claims conflict between sources
- Flag if a claim is uncertain or unverifiable
- Identify time-sensitive information that may change

RULES:
- Never copy source wording - paraphrase accurately
- Prefer primary/official sources
- Mark uncertain claims clearly
- Separate verified facts from speculation

Return JSON:
{
  "claims": [{ "claim": string, "sourceIndices": number[], "isConflicting": boolean, "isUncertain": boolean }],
  "summary": string,
  "keyFacts": string[]
}` },
    { role: 'user', content: `Sources:\n${pageContents.map((p, i) => `[${i}] ${p.title} (${p.url}):\n${p.content}`).join('\n\n')}` },
  ])

  // Parse response
  let research: { claims: any[]; summary: string; keyFacts: string[] }
  const parsed = extractJSONObject(researchResponse)
  if (parsed && (parsed.claims || parsed.summary)) {
    research = parsed as any
  } else {
    research = { claims: [], summary: researchResponse, keyFacts: [] }
  }

  // Step 4: Store sources in database
  const sourceRecords: Awaited<ReturnType<typeof db.researchSource.create>>[] = []
  for (const result of searchResults) {
    const source = await db.researchSource.create({
      data: {
        videoIdeaId,
        title: result.name,
        publisher: result.host_name,
        sourceUrl: result.url,
        sourceLocation: result.url,
        sourceType: 'secondary',
        notes: result.snippet,
      },
    })
    sourceRecords.push(source)
  }

  // Step 5: Store claims
  for (const claim of research.claims || []) {
    await db.claimLedger.create({
      data: {
        videoIdeaId,
        claim: claim.claim,
        sourceIds: JSON.stringify(claim.sourceIndices || []),
        isConflicting: claim.isConflicting || false,
        isUncertain: claim.isUncertain || false,
      },
    })
  }

  // Step 6: Update idea status
  await db.videoIdea.update({
    where: { id: videoIdeaId },
    data: { status: 'researched' },
  })

  return {
    sources: searchResults.map(r => ({
      title: r.name,
      publisher: r.host_name,
      url: r.url,
      sourceType: 'secondary',
      isVerified: false,
    })),
    claims: research.claims || [],
    summary: research.summary || '',
    keyFacts: research.keyFacts || [],
  }
}
