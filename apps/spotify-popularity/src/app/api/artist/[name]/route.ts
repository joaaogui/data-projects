import { getArtistTopTracks } from "@/lib/spotify"
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit"
import { validateArtistName, getSafeErrorMessage } from "@/lib/validation"
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared"

export async function OPTIONS() {
  return optionsResponse(corsHeaders)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
                    
    const clientIp = getClientIp(request)
    const rateLimitResult = checkRateLimit(
      `artist:${clientIp}`,
      RATE_LIMITS.artist
    )

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      )
    }

    const { name } = await params
    const decodedName = decodeURIComponent(name)

    // Input validation
    const validation = validateArtistName(decodedName)
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      )
    }

    const data = await getArtistTopTracks(validation.sanitized!)

    return Response.json(data, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
      ),
    })
  } catch (error) {
    console.error("Error fetching artist:", error)
    return Response.json(
      { error: getSafeErrorMessage(error, "Failed to fetch artist") },
      { status: 500, headers: corsHeaders }
    )
  }
}
