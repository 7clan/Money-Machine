/**
 * Z.AI Provider - Single AI provider for all autonomous agent operations.
 * Uses z-ai-web-dev-sdk exclusively. No external AI APIs.
 */

import ZAI from 'z-ai-web-dev-sdk'

let _zai: ZAI | null = null

export async function getZAI(): Promise<ZAI> {
  if (!_zai) {
    _zai = await ZAI.create()
  }
  return _zai
}

/** LLM chat completion - the brain of the agent */
export async function llm(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  opts?: { thinking?: boolean; model?: string }
): Promise<string> {
  const zai = await getZAI()
  const res = await zai.chat.completions.create({
    messages,
    model: opts?.model,
    thinking: opts?.thinking ? { type: 'enabled' } : { type: 'disabled' },
  })
  // Handle streaming or non-streaming response
  if (typeof res === 'string') return res
  if (res?.choices?.[0]?.message?.content) return res.choices[0].message.content
  if (res?.content) return res.content
  return JSON.stringify(res)
}

/** Web search - for research */
export async function webSearch(query: string, num: number = 10): Promise<Array<{
  url: string; name: string; snippet: string; host_name: string; rank: number; date: string
}>> {
  const zai = await getZAI()
  return zai.functions.invoke('web_search', { query, num })
}

/** Read a web page */
export async function readPage(url: string): Promise<{
  title: string; html: string; publishedTime?: string
}> {
  const zai = await getZAI()
  const res = await zai.functions.invoke('page_reader', { url })
  return res.data
}

/** Text-to-speech - for narration */
export async function tts(
  text: string,
  voice?: string,
  speed?: number
): Promise<Buffer> {
  const zai = await getZAI()
  const res = await zai.audio.tts.create({
    input: text,
    voice: voice || 'alloy',
    speed: speed || 1.0,
    response_format: 'mp3',
  })
  // Response may be a buffer, arraybuffer, or base64
  if (Buffer.isBuffer(res)) return res
  if (res instanceof ArrayBuffer) return Buffer.from(res)
  if (typeof res === 'string') return Buffer.from(res, 'base64')
  if (res?.data) return Buffer.from(res.data, 'base64')
  return Buffer.from(JSON.stringify(res))
}

/** Image generation - for thumbnails and visuals */
export async function generateImage(
  prompt: string,
  size?: '1024x1024' | '1344x768' | '1440x720'
): Promise<Buffer> {
  const zai = await getZAI()
  const res = await zai.images.generations.create({
    prompt,
    size: size || '1344x768',
  })
  if (res?.data?.[0]?.base64) {
    return Buffer.from(res.data[0].base64, 'base64')
  }
  throw new Error('Image generation returned no data')
}

/** Image search - for finding reference/stock images */
export async function searchImages(
  query: string,
  count: number = 5
): Promise<Array<{ original_url: string; caption?: string }>> {
  const zai = await getZAI()
  const res = await zai.images.search.create({ query, count, rank: true })
  return res.results
}

/** Vision model - for analyzing images/thumbnails */
export async function vision(
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>
  }>,
  model?: string
): Promise<string> {
  const zai = await getZAI()
  const res = await zai.chat.completions.createVision({
    messages: messages as any,
    model: model || 'glm-4v-flash',
  })
  if (typeof res === 'string') return res
  if (res?.choices?.[0]?.message?.content) return res.choices[0].message.content
  return JSON.stringify(res)
}
