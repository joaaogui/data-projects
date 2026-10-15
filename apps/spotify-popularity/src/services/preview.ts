import { apiFetch } from "@data-projects/shared"

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

  return apiFetch<PreviewResponse>(`/api/preview?${params}`, {
    fallbackError: "Failed to fetch preview",
  })
}
