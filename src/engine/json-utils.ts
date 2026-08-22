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

  // Step 6: If all else fails, try to REPAIR truncated JSON
  // LLM responses are often cut off mid-array due to token limits
  const repaired = repairTruncatedJson(text)
  if (repaired) return repaired

  return null
}

/**
 * Repair truncated JSON by closing open brackets/braces.
 * LLM responses are frequently cut off mid-array due to max_tokens limits.
 */
function repairTruncatedJson(text: string): Record<string, any> | null {
  if (!text || typeof text !== 'string') return null

  let cleaned = text
    .replace(/```json\s*\n?/gi, '')
    .replace(/```\s*\n?/g, '')
    .replace(/```/g, '')
    .trim()

  const start = cleaned.search(/[{[]/)
  if (start === -1) return null

  // Track bracket nesting to find where the JSON becomes unbalanced
  // Strategy: walk the string, track depth. When we encounter a closing
  // bracket that would make depth negative, or when the string ends with
  // depth > 0, we need to repair.
  let jsonStr = cleaned.slice(start)

  // Walk the string and find the last position where the depth is valid
  // (i.e., the last `}` or `]` that matches an opener)
  const stack: string[] = []
  let inString = false
  let escape = false
  let lastValidPos = -1 // position after the last complete token

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '{' || ch === '[') {
      stack.push(ch)
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0) {
        const expected = ch === '}' ? '{' : '['
        if (stack[stack.length - 1] === expected) {
          stack.pop()
          // Mark this as a potential truncation point
          if (stack.length > 0) lastValidPos = i + 1
        }
      }
    }
  }

  // If the stack is empty, the JSON is complete — no repair needed
  if (stack.length === 0) {
    try {
      return JSON.parse(jsonStr)
    } catch {
      return null
    }
  }

  // The JSON is truncated — we need to close the open brackets.
  // Truncate at the last valid position (after a complete value)
  // to remove any partial trailing content.
  if (lastValidPos > 0) {
    // Check what comes after lastValidPos — if it's a comma or whitespace, trim it
    let trimPos = lastValidPos
    while (trimPos < jsonStr.length && /[\s,]/.test(jsonStr[trimPos])) trimPos++
    if (trimPos > lastValidPos) lastValidPos = trimPos - 1 // keep the comma for proper JSON

    // But if there's a partial key (e.g. `"narra`), trim back to before the key
    const after = jsonStr.slice(lastValidPos)
    if (after.includes('"')) {
      // There's a partial key — find the last comma before it
      const lastComma = jsonStr.lastIndexOf(',', lastValidPos)
      if (lastComma > 0) {
        lastValidPos = lastComma
      }
    }

    jsonStr = jsonStr.slice(0, lastValidPos + 1)
    // Remove trailing comma if present
    jsonStr = jsonStr.replace(/,\s*$/, '')
  }

  // Re-count the stack after truncation
  const remainingStack: string[] = []
  inString = false
  escape = false
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') remainingStack.push(ch)
    else if (ch === '}' || ch === ']') {
      if (remainingStack.length > 0) remainingStack.pop()
    }
  }

  // Close all remaining open brackets in reverse order
  for (let i = remainingStack.length - 1; i >= 0; i--) {
    jsonStr += remainingStack[i] === '{' ? '}' : ']'
  }

  console.warn(`[json-repair] Closed ${remainingStack.length} open brackets`)

  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.warn('[json-repair] Final parse failed:', (e as Error).message.slice(0, 100))
    return null
  }
}
