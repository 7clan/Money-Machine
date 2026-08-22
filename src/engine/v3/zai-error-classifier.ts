/**
 * Z.ai Error Classifier (Phase: spec section 2)
 *
 * Parses Z.ai API errors and classifies them into actionable states.
 * The pipeline uses the classification to decide: retry / wait / abort.
 *
 * Z.ai error body shapes observed:
 *   {"error":{"code":"1214","message":"音色不存在"}}            → INVALID_REQUEST (NON-RETRYABLE)
 *   {"error":"Too many requests, please try again later"}       → RETRY_SHORT (no business code)
 *   {"error":{"code":"1302","message":"Rate limit reached..."}} → RETRY_AFTER (with possible reset)
 *   {"error":{"code":"1311","message":"Subscription..."}}       → MODEL_NOT_INCLUDED (NON-RETRYABLE)
 */

export type ZaiErrorState =
  | 'RETRY_SHORT'                    // retry with exponential backoff + jitter
  | 'RETRY_AFTER'                    // retry after a specific timestamp
  | 'BLOCKED_UNTIL_RESET'            // usage/spend window exhausted — wait for reset
  | 'INSUFFICIENT_BALANCE'           // account balance exhausted — ACTION REQUIRED
  | 'MODEL_NOT_INCLUDED'             // subscription doesn't include this model — CONFIG ERROR
  | 'AUTH_FAILURE'                   // 401/403 — CONFIG ERROR
  | 'INVALID_REQUEST'                // 400 with business code — fix the request, don't retry
  | 'TEMPORARY_SERVICE_FAILURE'       // 500/502/503/504 — retry with backoff
  | 'UNKNOWN'                        // unclassifiable — retry once conservatively

export interface ClassifiedZaiError {
  state: ZaiErrorState
  httpStatus: number
  businessCode?: string              // Z.ai internal code (e.g. "1214", "1302")
  message: string
  requestId?: string
  model?: string
  endpoint?: string
  attempt?: number
  timestamp: string
  /** When the rate limit / usage window resets (if provided by the API) */
  resetAt?: Date
  /** Should the caller retry this request? */
  retryable: boolean
  /** How long to wait before retrying (ms), if applicable */
  retryAfterMs?: number
}

const KNOWN_NON_RETRYABLE_CODES = new Set([
  '1214', // unsupported parameter value (e.g. voice doesn't exist)
  '1213', // invalid request
  '1311', // subscription does not include requested model
  '1113', // insufficient balance / resource package
])

const KNOWN_RETRYABLE_CODES = new Set([
  '1302', // rate limit reached
  '1305', // service temporarily overloaded
  '1308', // usage limit reached (has reset time)
  '1310', // weekly/monthly limit exhausted (has reset time)
  '1316', '1317', '1318', '1319', '1320', '1321', // usage/spend window exhausted
])

/**
 * Parse a raw Z.ai error into a ClassifiedZaiError.
 *
 * Handles multiple body shapes:
 *   - {"error":{"code":"1214","message":"..."}}         (structured business code)
 *   - {"error":"Too many requests, please try again later"}  (bare string)
 *   - {"error":{"message":"..."}}                        (no code)
 *   - Plain string error from the SDK wrapper
 */
export function classifyZaiError(
  rawError: any,
  context: { endpoint?: string; model?: string; attempt?: number } = {},
): ClassifiedZaiError {
  const timestamp = new Date().toISOString()
  const message = (rawError?.message || String(rawError || 'Unknown error')).slice(0, 500)

  // Extract HTTP status from common error shapes
  let httpStatus = 0
  if (typeof rawError?.status === 'number') httpStatus = rawError.status
  else if (typeof rawError?.statusCode === 'number') httpStatus = rawError.statusCode
  else if (message.match(/status (\d{3})/)) httpStatus = parseInt(message.match(/status (\d{3})/)![1], 10)
  else if (message.includes('429')) httpStatus = 429
  else if (message.includes('401') || message.includes('403')) httpStatus = 401

  // Try to extract the Z.ai business code + structured message from the error body
  let businessCode: string | undefined
  let apiMessage = message
  let resetAt: Date | undefined

  // Shape 1: error body is a string containing JSON
  const jsonMatch = message.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      const errObj = parsed.error || parsed
      if (errObj?.code) {
        businessCode = String(errObj.code)
        apiMessage = errObj.message || errObj.error || apiMessage
      } else if (typeof errObj === 'string') {
        apiMessage = errObj
      }
      // Look for reset timestamps in various fields
      const resetFields = ['reset_at', 'resetAt', 'reset_time', 'resetTime', 'expires_at', 'expiresAt']
      for (const f of resetFields) {
        if (errObj?.[f]) {
          const d = new Date(errObj[f])
          if (!isNaN(d.getTime())) { resetAt = d; break }
        }
      }
    } catch {
      // Not JSON — treat as plain message
    }
  }

  // Shape 2: error object has .response.data with structured error
  if (rawError?.response?.data?.error) {
    const errObj = rawError.response.data.error
    if (errObj?.code) businessCode = String(errObj.code)
    if (errObj?.message) apiMessage = errObj.message
  }

  // Classify based on business code first, then HTTP status
  let state: ZaiErrorState
  let retryable: boolean
  let retryAfterMs: number | undefined

  if (businessCode && KNOWN_NON_RETRYABLE_CODES.has(businessCode)) {
    state = businessCode === '1113' ? 'INSUFFICIENT_BALANCE' : 'INVALID_REQUEST'
    if (businessCode === '1311') state = 'MODEL_NOT_INCLUDED'
    retryable = false
  } else if (businessCode && KNOWN_RETRYABLE_CODES.has(businessCode)) {
    if (businessCode === '1302' || businessCode === '1305') {
      state = 'RETRY_SHORT'
      retryable = true
      retryAfterMs = 5000 + Math.random() * 5000 // 5-10s with jitter
    } else {
      // 1308, 1310, 1316-1321 — usage window exhausted
      state = 'BLOCKED_UNTIL_RESET'
      retryable = false // don't hammer — wait for reset
      if (resetAt) {
        retryAfterMs = Math.max(1000, resetAt.getTime() - Date.now())
      } else {
        // No reset time provided — assume 1 hour
        retryAfterMs = 3600 * 1000
        resetAt = new Date(Date.now() + retryAfterMs)
      }
    }
  } else if (httpStatus === 429) {
    // Generic 429 with no business code — Z.ai's most common rate limit
    state = 'RETRY_SHORT'
    retryable = true
    retryAfterMs = 3000 + Math.random() * 7000 // 3-10s with jitter
  } else if (httpStatus === 401 || httpStatus === 403) {
    state = 'AUTH_FAILURE'
    retryable = false
  } else if (httpStatus === 400) {
    state = 'INVALID_REQUEST'
    retryable = false
  } else if (httpStatus >= 500) {
    state = 'TEMPORARY_SERVICE_FAILURE'
    retryable = true
    retryAfterMs = 2000 + Math.random() * 3000
  } else if (httpStatus === 408 || message.includes('ETIMEDOUT') || message.includes('ECONNRESET') || message.includes('socket hang up')) {
    state = 'TEMPORARY_SERVICE_FAILURE'
    retryable = true
    retryAfterMs = 2000 + Math.random() * 3000
  } else {
    state = 'UNKNOWN'
    retryable = true // retry once conservatively
    retryAfterMs = 5000
  }

  return {
    state,
    httpStatus,
    businessCode,
    message: apiMessage,
    requestId: rawError?.request_id || rawError?.requestId,
    model: context.model,
    endpoint: context.endpoint,
    attempt: context.attempt,
    timestamp,
    resetAt,
    retryable,
    retryAfterMs,
  }
}

/**
 * Log a classified error to stdout in the format required by the spec.
 * Never prints API keys.
 */
export function logClassifiedError(err: ClassifiedZaiError): void {
  console.error(
    `[ZAI-ERROR] state=${err.state} http=${err.httpStatus} code=${err.businessCode || 'none'} ` +
    `endpoint=${err.endpoint || 'unknown'} model=${err.model || 'none'} ` +
    `attempt=${err.attempt ?? 0} retryable=${err.retryable} ` +
    `retryAfterMs=${err.retryAfterMs ?? 'none'} ` +
    `resetAt=${err.resetAt?.toISOString() || 'none'} ` +
    `requestId=${err.requestId || 'none'} ` +
    `message="${err.message.slice(0, 150)}"`
  )
}
