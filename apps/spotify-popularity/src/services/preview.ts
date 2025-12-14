export interface PreviewResponse {
  preview: string | null
  error?: string
}

export async function fetchTrackPreview(
  trackName: string,
  artistName: string
): Promise<PreviewResponse> {
  const params = new URLSearchParams({
    track: trackName,
    artist: artistName,
  })

  const response = await fetch(`/api/preview?${params}`)

  if (!response.ok) {
    throw new Error("Failed to fetch preview")
  }

  return response.json()
}



