/**
 * Script Writer
 * 
 * Uses Z.AI LLM to write original scripts for videos.
 * Ensures originality, proper structure, no copying.
 */

import { llm } from './zai-provider'
import { extractJSONObject } from './json-utils'
import { db } from '@/lib/db'

export interface ScriptResult {
  /** Database id of the newly-created Script row. */
  id: string
  content: string
  outline: string
  hook: string
  callToAction: string
  scenes: Array<{
    order: number
    title: string
    description: string
    narrationText: string
    visualType: string
    visualNotes: string
    duration: number
  }>
  wordCount: number
  estimatedMinutes: number
}

/**
 * Write (or revise) a script for a video idea.
 *
 * Pass an optional `revisionNote` to instruct the LLM to address issues from
 * a failed quality review (or any other revision guidance). When provided,
 * the note is appended to the user prompt as explicit revision instructions.
 */
export async function writeScript(
  videoIdeaId: string,
  revisionNote?: string
): Promise<ScriptResult> {
  const idea = await db.videoIdea.findUnique({
    where: { id: videoIdeaId },
    include: {
      researchSources: true,
      claims: true,
    },
  })
  if (!idea) throw new Error(`VideoIdea ${videoIdeaId} not found`)

  const isShort = idea.type === 'short'
  const targetWords = isShort ? 120 : 1800 // ~60s short vs ~10min longform
  const targetMinutes = isShort ? 1 : 10

  // Get niche context
  const nicheState = await db.agentState.findUnique({ where: { key: 'selected_niche' } })
  const niche = nicheState ? JSON.parse(nicheState.value) : null

  const revisionBlock = revisionNote?.trim()
    ? `\n\nREVISION INSTRUCTIONS — A previous version of this script was rejected during quality review. Address the following issues and produce a corrected, fully-original script:\n${revisionNote.trim()}\n\nRewrite the script to fix these problems while keeping the same topic and overall structure. Do NOT reuse any wording from the previous version that caused the issues.`
    : ''

  const scriptResponse = await llm([
    { role: 'system', content: `You are an expert YouTube script writer and producer. Write an ORIGINAL script for this video.

CRITICAL RULES:
- NEVER copy wording from sources - write completely original content
- Include a truthful, compelling opening hook (no clickbait or exaggeration)
- Address a clear viewer problem or question
- Provide immediate value within the first 30 seconds
- Use logical structure with clear sections
- Include original explanations, examples, and demonstrations
- Add pattern interruptions every 2-3 minutes for long-form
- Use natural transitions between sections
- End with a strong but honest conclusion
- Include a relevant, non-pushy call to action
- NO filler content to pad length
- NO exaggerated earnings promises
- NO misleading urgency
- If AI-generated content, note it clearly

VISUAL DIRECTION (CRITICAL — the visualNotes field will be used verbatim as an image-generation prompt for an AI image model):
- Each scene's visualNotes must be a CONCRETE, DESCRIBABLE visual — not abstract instructions like "show a chart" but a vivid scene like "an organized desk with a laptop showing code editor at sunset, warm light, books and coffee cup on the side, photorealistic, 50mm lens, shallow depth of field".
- Include: subject, setting, lighting, mood, color palette, style (photorealistic / illustration / 3D render / flat design / isometric / etc.)
- NO text in the image (no on-screen words, no signs, no UI labels). The video editor burns in the title separately.
- Each scene should have a DISTINCT visual so the video feels dynamic — vary the angle, setting, or style between scenes.

SCRIPT FORMAT - Return JSON:
{
  "outline": "Section breakdown",
  "hook": "The opening 2-3 sentences",
  "callToAction": "The closing CTA",
  "scenes": [{
    "order": number,
    "title": "Section title (3-6 words)",
    "description": "What happens in this scene (1 sentence)",
    "narrationText": "The spoken narration for this scene (1-4 sentences, natural spoken language)",
    "visualType": "screenrecording|diagram|animation|chart|image|text|custom",
    "visualNotes": "Vivid image-generation prompt: subject + setting + lighting + mood + style + color palette. ~30-50 words. No text in image.",
    "duration": seconds
  }]
}

${isShort ? 'This is a YouTube Short (under 60 seconds). Deliver ONE complete useful idea with original narration across 3-5 quick scenes. Use vertical framing cues in visualNotes.' : 'This is a long-form video. Target ~' + targetMinutes + ' minutes. Use 8-14 scenes. Include chapter-style titles.'}` },
    { role: 'user', content: `Video Title: "${idea.title}"
Video Type: ${idea.type}
Niche: ${niche?.nicheName || 'General'}

Research Sources:
${idea.researchSources.map((s, i) => `[${i}] ${s.title} - ${s.notes || s.sourceUrl}`).join('\n')}

Key Claims:
${idea.claims.map(c => `- ${c.claim}${c.isUncertain ? ' (UNCERTAIN)' : ''}${c.isConflicting ? ' (CONFLICTING)' : ''}`).join('\n')}

Write the complete original script now.${revisionBlock}` },
  ])

  // Parse response
  let scriptData: any
  const parsed = extractJSONObject(scriptResponse)
  if (parsed && parsed.scenes) {
    scriptData = parsed
  } else {
    // Fallback: use the raw response as the script content
    scriptData = {
      outline: 'Auto-generated',
      hook: scriptResponse.slice(0, 200),
      callToAction: 'Subscribe for more content',
      scenes: [{
        order: 1, title: idea.title, description: 'Main content',
        narrationText: scriptResponse, visualType: 'text',
        visualNotes: 'Display text on screen', duration: targetMinutes * 60,
      }],
    }
  }

  // Build full content from scenes
  const fullContent = scriptData.scenes?.map((s: any) => s.narrationText).join('\n\n') || ''
  const wordCount = fullContent.split(/\s+/).length
  const estimatedMinutes = wordCount / 150 // ~150 wpm speaking rate

  // Store script in database
  const script = await db.script.create({
    data: {
      videoIdeaId,
      content: fullContent,
      outline: scriptData.outline || '',
      hook: scriptData.hook || '',
      callToAction: scriptData.callToAction || '',
      wordCount,
      estimatedMinutes,
      status: 'draft',
      scenes: {
        create: (scriptData.scenes || []).map((s: any) => ({
          order: s.order || 1,
          title: s.title || '',
          description: s.description || '',
          narrationText: s.narrationText || '',
          visualType: s.visualType || 'text',
          visualNotes: s.visualNotes || '',
          duration: s.duration || 30,
        })),
      },
    },
    include: { scenes: true },
  })

  // Update idea status
  await db.videoIdea.update({
    where: { id: videoIdeaId },
    data: { status: 'scripted' },
  })

  return {
    id: script.id,
    content: fullContent,
    outline: scriptData.outline || '',
    hook: scriptData.hook || '',
    callToAction: scriptData.callToAction || '',
    scenes: scriptData.scenes || [],
    wordCount,
    estimatedMinutes,
  }
}
