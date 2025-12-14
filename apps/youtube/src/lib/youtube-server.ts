import dayjs from "dayjs";
import type { VideoData, PlaylistItem, VideoDetails } from "@/types/youtube";
import { calculateVideoScore, parseISO8601Duration, isShortVideo } from "./scoring";

const API_URL = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;
const VIDEO_PREFIX = "https://www.youtube.com/watch?v=";

const BATCH_SIZE = 50;

export interface ChannelInfo {
  channelId: string;
  channelTitle: string;
  thumbnails: {
    default: {
      url: string;
    };
  };
}

function getApiKey(): string {
  if (!API_KEY) {
    throw new Error("YouTube API key not configured");
  }
  return API_KEY;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

async function getPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
  const apiKey = getApiKey();
  const allVideos: PlaylistItem[] = [];
  let pageToken = "";

  do {
    const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
    const url = `${API_URL}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}${pageParam}`;
    const data = await fetchJson<{ items: PlaylistItem[]; nextPageToken?: string }>(url);
    allVideos.push(...data.items);
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return allVideos;
}

async function getBatchVideoDetails(videoIds: string[]): Promise<Map<string, VideoDetails>> {
  const apiKey = getApiKey();
  const detailsMap = new Map<string, VideoDetails>();

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
  const url = `${API_URL}/channels?part=snippet&id=${channelId}&key=${apiKey}`;
  const data = await fetchJson<{ items: Array<{ id: string; snippet: { title: string; thumbnails: ChannelInfo["thumbnails"] } }> }>(url);
  const channel = data.items[0];
  
  if (!channel) {
    throw new Error("Channel not found");
  }
  
  return {
    channelId: channel.id,
    channelTitle: channel.snippet.title,
    thumbnails: channel.snippet.thumbnails,
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

export async function fetchChannelVideos(channelId: string): Promise<VideoData[]> {
  const uploadsPlaylistId = await getUploadsPlaylistId(channelId);
  const playlistItems = await getPlaylistItems(uploadsPlaylistId);
  const videoIds = playlistItems.map(item => item.contentDetails.videoId);
  const detailsMap = await getBatchVideoDetails(videoIds);
  
  const videos: VideoData[] = [];
  
  for (const item of playlistItems) {
    const videoId = item.contentDetails.videoId;
    const details = detailsMap.get(videoId);
    
    if (details) {
      const { statistics: stats, contentDetails } = details;
      const views = Number(stats.viewCount || 0);
      const likes = Number(stats.likeCount || 0);
      const comments = Number(stats.commentCount || 0);
      const favorites = Number(stats.favoriteCount || 0);
      const days = getDaysToToday(item.contentDetails.videoPublishedAt);
      const duration = parseISO8601Duration(contentDetails.duration);
      
      const scoring = calculateVideoScore({ views, likes, comments, days, duration });
      
      videos.push({
        videoId,
        title: item.snippet.title,
        days,
        duration,
        isShort: isShortVideo(duration),
        views,
        likes,
        comments,
        favorites,
        score: scoring.score,
        scoreComponents: scoring.components,
        rates: scoring.rates,
        url: VIDEO_PREFIX + videoId,
        thumbnail: item.snippet.thumbnails.default.url,
        description: item.snippet.description,
      });
    }
  }

  return videos;
}
