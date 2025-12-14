export interface ScoreComponents {
  engagementScore: number;
  reachScore: number;
  consistencyScore: number;
  communityScore: number;
  efficiencyScore: number;
}

export interface EngagementRates {
  likeRate: number;
  commentRate: number;
  engagementRate: number;
  viewsPerDay: number;
  viewsPerMinute: number;
  engagementPerMinute: number;
}

export interface VideoData {
  videoId: string;
  title: string;
  days: number;
  duration: number;
  isShort: boolean;
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
    thumbnails: {
      default: {
        url: string;
      };
    };
  };
  contentDetails: {
    videoId: string;
    videoPublishedAt: string;
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
