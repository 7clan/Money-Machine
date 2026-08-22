import { GET as YoutubeCallbackGET, POST as YoutubeCallbackPOST } from '@/app/api/youtube/callback/route'

/**
 * Alias route for backward compatibility.
 *
 * The original YouTube OAuth callback lived at /api/auth/youtube/callback.
 * Some Google Cloud Console OAuth clients still have that exact redirect URI
 * registered. We re-export the same handlers here so whichever path Google
 * redirects to is handled by the same logic.
 */
export const GET = YoutubeCallbackGET
export const POST = YoutubeCallbackPOST
