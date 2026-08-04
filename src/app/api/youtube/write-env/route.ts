import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/youtube/write-env
 * Fallback endpoint that also saves credentials to .env.
 * Same as save-credentials but kept for backward compatibility.
 */
export { POST } from '../save-credentials/route'
