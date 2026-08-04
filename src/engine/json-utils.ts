/**
 * JSON extraction utility - handles LLM responses that may contain
 * markdown code fences, extra text, or malformed JSON.
 */

export function extractJSON(text: string): any {
  if (!text || typeof text !== 'string') return null

  // Step 1: Remove markdown code fences
  let cleaned = text
    .replace(/```json\s*\n?/gi, '')
    .replace(/```\s*\n?/g, '')
    .replace(/```/g, '')
    .trim()

  // Step 2: Try direct parse
  try {
    return JSON.parse(cleaned)
  } catch {}

  // Step 3: Find JSON array in text
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0])
    } catch {}
  }

  // Step 4: Find JSON object in text
  const objectMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0])
    } catch {}
  }

  // Step 5: Try to find balanced brackets
  let depth = 0
  let start = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '[' || cleaned[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (cleaned[i] === ']' || cleaned[i] === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1))
        } catch {}
      }
    }
  }

  return null
}

/** Extract JSON array specifically */
export function extractJSONArray(text: string): any[] {
  const result = extractJSON(text)
  if (Array.isArray(result)) return result
  return []
}

/** Extract JSON object specifically */
export function extractJSONObject(text: string): Record<string, any> | null {
  const result = extractJSON(text)
  if (result && typeof result === 'object' && !Array.isArray(result)) return result
  return null
}
