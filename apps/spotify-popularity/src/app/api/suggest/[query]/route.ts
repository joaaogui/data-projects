import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit"
import { validateArtistName, getSafeErrorMessage } from "@/lib/validation"
import { searchArtists } from "@/lib/spotify"
import {
  corsHeaders,
  createCache,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared"

export async function OPTIONS() {
  return optionsResponse(corsHeaders)
}

type ArtistSuggestion = {
  id: string
  name: string
  imageUrl: string | null
  genres: string[]
}

const cache = createCache<ArtistSuggestion[]>({
  ttlMs: 60 * 60 * 1000,
  maxSize: 1000,
})

function cacheKey(query: string) {
  return `artist-suggest:${query.toLowerCase().trim()}`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ query: string }> }
) {
  try {
    const clientIp = getClientIp(request)
    const rateLimitResult = checkRateLimit(
      `suggest:${clientIp}`,
      RATE_LIMITS.suggest
    )

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      )
    }

    const { query } = await params
    const decodedQuery = decodeURIComponent(query)

    const validation = validateArtistName(decodedQuery)
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      )
    }

    const q = validation.sanitized!
    if (q.length < 2) {
      return Response.json([], { headers: corsHeaders })
    }

    const key = cacheKey(q)
    const cached = cache.get(key)
    if (cached) {
      return Response.json(cached, {
        headers: mergeHeaders(
          corsHeaders,
          withRateLimitHeaders(rateLimitResult),
          { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
        ),
      })
    }

    const artists = await searchArtists(q, 8)
    const suggestions: ArtistSuggestion[] = artists.map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.images?.[0]?.url || null,
      genres: a.genres || [],
    }))

    cache.set(key, suggestions)

    return Response.json(suggestions, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
      ),
    })
  } catch (error) {
    console.error("Suggest error:", error)
    return Response.json(
      { error: getSafeErrorMessage(error, "Failed to fetch suggestions") },
      { status: 500, headers: corsHeaders }
    )
  }
}


