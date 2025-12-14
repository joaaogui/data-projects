import { corsHeaders, mergeHeaders, optionsResponse } from "@data-projects/shared"

const DEEZER_API_BASE = "https://api.deezer.com"

interface DeezerTrack {
  id: number
  title: string
  preview: string
  artist: {
    name: string
  }
}

interface DeezerSearchResponse {
  data: DeezerTrack[]
  total: number
}

export async function OPTIONS() {
  return optionsResponse(corsHeaders)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const track = searchParams.get("track")
    const artist = searchParams.get("artist")

    if (!track || !artist) {
      return Response.json(
        { error: "Missing track or artist parameter" },
        { status: 400, headers: corsHeaders }
      )
    }

                                           
    const cleanTrack = track
      .replace(/\s*\(.*?\)/g, "") // Remove parentheses content
      .replace(/\s*\[.*?\]/g, "") // Remove brackets content
      .replace(/\s*-\s*remaster.*$/gi, "") // Remove remaster suffix
      .trim()

                                                 
    const cleanArtist = artist.split(/[,&]/)[0].trim()

    const query = `${cleanTrack} ${cleanArtist}`
    const url = `${DEEZER_API_BASE}/search?q=${encodeURIComponent(query)}&limit=3`

    const response = await fetch(url)

    if (!response.ok) {
      console.error(`[Deezer] API error: ${response.status}`)
      return Response.json(
        { error: "Deezer API error", preview: null },
        { status: 200, headers: corsHeaders }
      )
    }

    const data: DeezerSearchResponse = await response.json()

    if (!data.data || data.data.length === 0) {
      return Response.json(
        { preview: null },
        { status: 200, headers: corsHeaders }
      )
    }

    // Find best match - first result with a preview
    const withPreview = data.data.find((t) => t.preview)

    return Response.json(
      { preview: withPreview?.preview || null },
      {
        headers: mergeHeaders(corsHeaders, {
          "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400",
        }),
      }
    )
  } catch (error) {
    console.error("[Deezer] Error:", error)
    return Response.json(
      { error: "Failed to fetch preview", preview: null },
      { status: 200, headers: corsHeaders }
    )
  }
}



