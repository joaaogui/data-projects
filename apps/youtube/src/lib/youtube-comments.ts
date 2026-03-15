import { env } from "./env";

const API_URL = "https://www.googleapis.com/youtube/v3";

interface YouTubeComment {
  id: string;
  authorName: string;
  text: string;
  likeCount: number;
  publishedAt: string;
}

export async function fetchTopComments(
  videoId: string,
  maxResults = 20
): Promise<YouTubeComment[]> {
  const apiKey = env.YOUTUBE_API_KEY;

  const url = `${API_URL}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&textFormat=plainText&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 403) return [];
      return [];
    }

    const data = await res.json();
    if (!data.items) return [];

    return data.items.map((item: Record<string, unknown>) => {
      const snippet = (item.snippet as Record<string, unknown>)?.topLevelComment as Record<string, unknown>;
      const commentSnippet = snippet?.snippet as Record<string, unknown>;
      return {
        id: item.id as string,
        authorName: (commentSnippet?.authorDisplayName as string) ?? "Unknown",
        text: (commentSnippet?.textDisplay as string) ?? "",
        likeCount: Number(commentSnippet?.likeCount ?? 0),
        publishedAt: (commentSnippet?.publishedAt as string) ?? new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}
