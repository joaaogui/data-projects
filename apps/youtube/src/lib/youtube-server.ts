import type { ChannelInfo, FetchProgress, PlaylistInfo, PlaylistItem, VideoData, VideoDetails } from "@/types/youtube";
import dayjs from "dayjs";
import { parseISO8601Duration, scoreVideoBatch, type VideoMetrics } from "./scoring";

export type { ChannelInfo } from "@/types/youtube";

export type FetchProgressCallback = (progress: FetchProgress) => void;

const API_URL = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;
const VIDEO_PREFIX = "https://www.youtube.com/watch?v=";

const BATCH_SIZE = 50;

function getApiKey(): string {
  if (!API_KEY) {
    throw new Error("YouTube API key not configured");
  }
  return API_KEY;
}

function redactKey(url: string): string {
  return url.replace(/key=[^&]+/, "key=REDACTED");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.error?.message ?? JSON.stringify(body).slice(0, 500);
    } catch {
      detail = await response.text().catch(() => "(unreadable body)");
    }
    throw new Error(
      `YouTube API ${response.status}: ${detail} [${redactKey(url)}]`
    );
  }
  return response.json();
}

async function getPlaylistItems(
  playlistId: string,
  onProgress?: FetchProgressCallback
): Promise<PlaylistItem[]> {
  const apiKey = getApiKey();
  const allVideos: PlaylistItem[] = [];
  let pageToken = "";

  do {
    const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
    const url = `${API_URL}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}${pageParam}`;
    const data = await fetchJson<{ items: PlaylistItem[]; nextPageToken?: string }>(url);
    allVideos.push(...data.items);
    pageToken = data.nextPageToken || "";
    onProgress?.({ phase: "playlist", fetched: allVideos.length });
  } while (pageToken);

  return allVideos;
}

async function getBatchVideoDetails(
  videoIds: string[],
  onProgress?: FetchProgressCallback
): Promise<Map<string, VideoDetails>> {
  const apiKey = getApiKey();
  const detailsMap = new Map<string, VideoDetails>();
  const total = videoIds.length;

  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    const batch = videoIds.slice(i, i + BATCH_SIZE);
    const ids = batch.join(",");

    const url = `${API_URL}/videos?part=statistics,contentDetails&id=${ids}&key=${apiKey}`;
    const data = await fetchJson<{ items: Array<{ id: string; statistics: VideoDetails["statistics"]; contentDetails: VideoDetails["contentDetails"] }> }>(url);

    for (const item of data.items) {
      detailsMap.set(item.id, {
        statistics: item.statistics,
        contentDetails: item.contentDetails,
      });
    }

    onProgress?.({ phase: "details", fetched: Math.min(i + BATCH_SIZE, total), total });
  }

  return detailsMap;
}

function getDaysToToday(videoDate: string): number {
  return dayjs().diff(videoDate, "day");
}

async function getUploadsPlaylistId(channelId: string): Promise<string> {
  const apiKey = getApiKey();
  const url = `${API_URL}/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
  const data = await fetchJson<{ items: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }> }>(url);
  const uploadsPlaylistId = data.items[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error("Could not find uploads playlist");
  }

  return uploadsPlaylistId;
}

export async function searchChannel(query: string): Promise<ChannelInfo> {
  const apiKey = getApiKey();
  const url = `${API_URL}/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`;
  const data = await fetchJson<{ items: Array<{ id: { channelId: string }; snippet: { channelTitle: string; thumbnails: ChannelInfo["thumbnails"] } }> }>(url);
  const channel = data.items[0];

  if (!channel) {
    throw new Error("Channel not found");
  }

  return {
    channelId: channel.id.channelId,
    channelTitle: channel.snippet.channelTitle,
    thumbnails: channel.snippet.thumbnails,
  };
}

export async function getChannelById(channelId: string): Promise<ChannelInfo> {
  const apiKey = getApiKey();
  const url = `${API_URL}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
  const data = await fetchJson<{ items: Array<{ id: string; snippet: { title: string; customUrl?: string; description?: string; country?: string; thumbnails: ChannelInfo["thumbnails"] }; statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string } }> }>(url);
  const channel = data.items[0];

  if (!channel) {
    throw new Error("Channel not found");
  }

  return {
    channelId: channel.id,
    channelTitle: channel.snippet.title,
    thumbnails: channel.snippet.thumbnails,
    subscriberCount: Number(channel.statistics?.subscriberCount ?? 0) || undefined,
    totalViewCount: Number(channel.statistics?.viewCount ?? 0) || undefined,
    videoCount: Number(channel.statistics?.videoCount ?? 0) || undefined,
    customUrl: channel.snippet.customUrl,
    description: channel.snippet.description,
    country: channel.snippet.country,
  };
}

export interface ChannelWithStats extends ChannelInfo {
  videoCount?: number;
}

export async function searchChannels(
  query: string,
  maxResults = 8,
  includeStats = false
): Promise<ChannelWithStats[]> {
  const apiKey = getApiKey();
  const safeMax = Math.max(1, Math.min(maxResults, 10));
  const url = `${API_URL}/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=${safeMax}&key=${apiKey}`;
  const data = await fetchJson<{ items: Array<{ id?: { channelId?: string }; snippet?: { channelTitle?: string; thumbnails?: ChannelInfo["thumbnails"] } }> }>(url);
  const items = data.items || [];

  const channels: ChannelWithStats[] = items.map((item) => ({
    channelId: item.id?.channelId,
    channelTitle: item.snippet?.channelTitle,
    thumbnails: item.snippet?.thumbnails,
  })).filter((ch): ch is ChannelWithStats => Boolean(ch.channelId && ch.channelTitle));

  if (includeStats && channels.length > 0) {
    const channelIds = channels.map(ch => ch.channelId).join(",");
    const statsUrl = `${API_URL}/channels?part=statistics&id=${channelIds}&key=${apiKey}`;
    const statsData = await fetchJson<{ items: Array<{ id: string; statistics?: { videoCount?: string } }> }>(statsUrl);
    const statsMap = new Map<string, number>();

    for (const item of statsData.items || []) {
      statsMap.set(item.id, Number(item.statistics?.videoCount || 0));
    }

    for (const channel of channels) {
      channel.videoCount = statsMap.get(channel.channelId);
    }
  }

  return channels;
}

export async function fetchChannelPlaylists(channelId: string): Promise<PlaylistInfo[]> {
  const apiKey = getApiKey();
  const allPlaylists: PlaylistInfo[] = [];
  let pageToken = "";

  do {
    const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
    const url = `${API_URL}/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=50&key=${apiKey}${pageParam}`;
    const data = await fetchJson<{
      items: Array<{
        id: string;
        snippet: { title: string; description: string; thumbnails?: { default?: { url?: string } } };
        contentDetails: { itemCount: number };
      }>;
      nextPageToken?: string;
    }>(url);

    for (const item of data.items) {
      allPlaylists.push({
        playlistId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        itemCount: item.contentDetails.itemCount,
        thumbnail: item.snippet.thumbnails?.default?.url ?? "",
        videoIds: [],
      });
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return allPlaylists;
}

export async function fetchPlaylistVideoIds(playlistId: string): Promise<string[]> {
  const items = await getPlaylistItems(playlistId);
  return items.map((item) => item.contentDetails.videoId);
}

export async function fetchChannelVideos(
  channelId: string,
  onProgress?: FetchProgressCallback
): Promise<VideoData[]> {
  const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
  const playlistItems = await getPlaylistItems(uploadsPlaylistId, onProgress);
  const videoIds = playlistItems.map(item => item.contentDetails.videoId);
  const detailsMap = await getBatchVideoDetails(videoIds, onProgress);

  interface PendingVideo {
    videoId: string;
    title: string;
    publishedAt: string;
    days: number;
    duration: number;
    views: number;
    likes: number;
    comments: number;
    favorites: number;
    thumbnailUrl: string;
    description: string;
  }

  const pending: PendingVideo[] = [];

  for (const item of playlistItems) {
    const videoId = item.contentDetails.videoId;
    const details = detailsMap.get(videoId);
    if (!details) continue;

    const { statistics: stats, contentDetails } = details;
    const publishedAt = item.contentDetails.videoPublishedAt ?? item.snippet.publishedAt;
    if (!publishedAt) continue;
    const days = getDaysToToday(publishedAt);
    if (Number.isNaN(days)) continue;

    pending.push({
      videoId,
      title: item.snippet.title,
      publishedAt,
      days,
      duration: parseISO8601Duration(contentDetails.duration),
      views: Number(stats.viewCount || 0),
      likes: Number(stats.likeCount || 0),
      comments: Number(stats.commentCount || 0),
      favorites: Number(stats.favoriteCount || 0),
      thumbnailUrl: item.snippet.thumbnails.default.url,
      description: item.snippet.description,
    });
  }

  const allMetrics: VideoMetrics[] = pending.map(p => ({
    views: p.views, likes: p.likes, comments: p.comments, days: p.days, duration: p.duration,
  }));
  const scoringResults = scoreVideoBatch(allMetrics);

  return pending.map((p, i) => ({
    videoId: p.videoId,
    title: p.title,
    publishedAt: p.publishedAt,
    days: p.days,
    duration: p.duration,
    views: p.views,
    likes: p.likes,
    comments: p.comments,
    favorites: p.favorites,
    score: scoringResults[i].score,
    scoreComponents: scoringResults[i].components,
    rates: scoringResults[i].rates,
    url: VIDEO_PREFIX + p.videoId,
    thumbnail: p.thumbnailUrl,
    description: p.description,
  }));
}
