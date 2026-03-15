const YT_API = "https://www.googleapis.com/youtube/v3";

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

async function ytGet<T>(token: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YT_API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  console.log(`[yt-api] GET ${path}`, Object.fromEntries(Object.entries(params).filter(([k]) => k !== "pageToken")));
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[yt-api] FAILED ${path} ${res.status}:`, body.slice(0, 300));
    throw new Error(`YouTube API ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const itemCount = Array.isArray(data.items) ? data.items.length : 0;
  console.log(`[yt-api] OK ${path} -> ${itemCount} items`, data.nextPageToken ? "(has more)" : "(done)");
  return data;
}

/**
 * Fetch the user's liked video IDs, then intersect with the given videoIds.
 * Uses the "LL" (Liked Videos) system playlist which works with youtube.readonly.
 */
export async function fetchLikedVideoIds(token: string, videoIds: string[]): Promise<Set<string>> {
  const target = new Set(videoIds);
  const liked = new Set<string>();
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId: "LL",
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await ytGet<{
      items: { contentDetails: { videoId: string } }[];
      nextPageToken?: string;
    }>(token, "playlistItems", params);

    for (const item of data.items ?? []) {
      if (target.has(item.contentDetails.videoId)) {
        liked.add(item.contentDetails.videoId);
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return liked;
}

/** Check whether the authenticated user is subscribed to a channel. */
export async function checkSubscription(token: string, channelId: string): Promise<boolean> {
  const data = await ytGet<{ items?: unknown[] }>(
    token, "subscriptions", {
    part: "id",
    mine: "true",
    forChannelId: channelId,
  }
  );
  return (data.items?.length ?? 0) > 0;
}

interface PlaylistResult {
  id: string;
  title: string;
  videoIds: string[];
}

/** Fetch all of the user's playlists and the video IDs in each. */
export async function fetchUserPlaylists(token: string): Promise<PlaylistResult[]> {
  const playlists: PlaylistResult[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "snippet",
      mine: "true",
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await ytGet<{
      items: { id: string; snippet: { title: string } }[];
      nextPageToken?: string;
    }>(token, "playlists", params);

    for (const pl of data.items ?? []) {
      const videoIds = await fetchPlaylistVideoIds(token, pl.id);
      playlists.push({ id: pl.id, title: pl.snippet.title, videoIds });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return playlists;
}

async function fetchPlaylistVideoIds(token: string, playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await ytGet<{
      items: { contentDetails: { videoId: string } }[];
      nextPageToken?: string;
    }>(token, "playlistItems", params);

    for (const item of data.items ?? []) {
      ids.push(item.contentDetails.videoId);
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return ids;
}
