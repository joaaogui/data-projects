export interface ChannelInfo {
  channelId: string;
  channelTitle: string;
  thumbnails: {
    default: {
      url: string;
    };
  };
}

export interface ChannelSuggestion {
  channelId: string;
  channelTitle: string;
  thumbnails?: { default?: { url?: string } };
  videoCount?: number;
}

export interface ScoreComponents {
  engagementScore: number;
  reachScore: number;
  momentumScore: number;
  efficiencyScore: number;
  communityScore: number;
}

export interface EngagementRates {
  likeRate: number;
  commentRate: number;
  engagementRate: number;
  viewsPerDay: number;
  viewsPerHour: number;
  viewsPerContentMin: number;
  engagementPerMinute: number;
}

export interface VideoData {
  videoId: string;
  title: string;
  publishedAt: string;
  days: number;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  favorites: number;
  score: number;
  scoreComponents: ScoreComponents;
  rates: EngagementRates;
  url: string;
  thumbnail: string;
  description: string;
}

export interface PlaylistItem {
  snippet: {
    title: string;
    description: string;
    publishedAt?: string;
    thumbnails: {
      default: {
        url: string;
      };
    };
  };
  contentDetails: {
    videoId: string;
    videoPublishedAt?: string;
  };
}

export interface VideoStatistics {
  viewCount: string;
  likeCount: string;
  commentCount: string;
  favoriteCount: string;
}

export interface VideoDetails {
  statistics: VideoStatistics;
  contentDetails: {
    duration: string;
  };
}

export interface PlaylistInfo {
  playlistId: string;
  title: string;
  description: string;
  itemCount: number;
  thumbnail: string;
  videoIds: string[];
}

export type SyncPhase =
  | "queued"
  | "init"
  | "playlist"
  | "details"
  | "saving"
  | "transcripts"
  | "done";

export interface FetchProgress {
  phase?: SyncPhase;
  fetched: number;
  total?: number;
}

export interface SyncLogEntry {
  ts: number;
  level: "info" | "warn" | "error";
  msg: string;
}

export interface AccountChannelData {
  isSubscribed: boolean;
  likedVideoIds: string[];
  playlists: { id: string; title: string; videoIds: string[] }[];
}

export type SagaSource = "playlist" | "ai-detected" | "manual";

export interface Saga {
  id: string;
  name: string;
  source: SagaSource;
  playlistId?: string;
  videoIds: string[];
  videoCount: number;
  dateRange: { first: string; last: string };
  reasoning?: string;
  videoEvidence?: Record<string, string>;
}

export interface SagaSuggestion {
  videoId: string;
  sagaId: string;
  sagaName: string;
  confidence: "high" | "medium" | "low";
}
