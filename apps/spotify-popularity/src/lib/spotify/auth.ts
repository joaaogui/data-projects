import { SpotifyTokenResponse } from "./types"

let cachedToken: string | null = null
let tokenExpiry: number = 0

export function invalidateToken(): void {
  cachedToken = null
  tokenExpiry = 0
}

export async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Missing Spotify credentials. Get yours at https://developer.spotify.com/dashboard")
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Failed to get Spotify token")
  }

  const data: SpotifyTokenResponse = await response.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000

  return cachedToken
}

