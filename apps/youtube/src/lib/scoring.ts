export interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
  days: number;
  duration: number;
}

export interface ScoringResult {
  score: number;
  components: {
    engagementScore: number;
    reachScore: number;
    consistencyScore: number;
    communityScore: number;
    efficiencyScore: number;
  };
  rates: {
    likeRate: number;
    commentRate: number;
    engagementRate: number;
    viewsPerDay: number;
    viewsPerMinute: number;
    engagementPerMinute: number;
  };
}

const CONFIG = {
  COMMENT_WEIGHT: 5,
  LIKE_WEIGHT: 1,
  
  WEIGHTS: {
    reach: 0.40,
    engagement: 0.20,
    consistency: 0.15,
    community: 0.10,
    efficiency: 0.15,
  },
  
  BENCHMARKS: {
    likeRatePct: 4,
    commentRatePct: 0.5,
    goodViews: 100000,
    excellentViews: 1000000,
    goodViewsPerMinute: 10000,
  },
};

function sigmoidNormalize(value: number, midpoint: number, steepness: number = 1): number {
  return 100 / (1 + Math.exp(-steepness * (value - midpoint) / midpoint));
}

function calculateEngagementRate(metrics: VideoMetrics): number {
  if (metrics.views === 0) return 0;
  
  const weightedEngagement = 
    metrics.likes * CONFIG.LIKE_WEIGHT + 
    metrics.comments * CONFIG.COMMENT_WEIGHT;
  
  return (weightedEngagement / metrics.views) * 1000;
}

function calculateLikeRate(metrics: VideoMetrics): number {
  if (metrics.views === 0) return 0;
  return (metrics.likes / metrics.views) * 1000;
}

function calculateCommentRate(metrics: VideoMetrics): number {
  if (metrics.views === 0) return 0;
  return (metrics.comments / metrics.views) * 1000;
}

function calculateViewsPerDay(metrics: VideoMetrics): number {
  if (metrics.days === 0) return metrics.views;
  return metrics.views / metrics.days;
}

function calculateViewsPerMinute(metrics: VideoMetrics): number {
  const minutes = metrics.duration / 60;
  if (minutes === 0) return 0;
  return metrics.views / minutes;
}

function calculateEngagementPerMinute(metrics: VideoMetrics): number {
  const minutes = metrics.duration / 60;
  if (minutes === 0) return 0;
  const totalEngagement = metrics.likes + metrics.comments;
  return totalEngagement / minutes;
}

function calculateEngagementScore(metrics: VideoMetrics): number {
  const engagementRate = calculateEngagementRate(metrics);
  return sigmoidNormalize(engagementRate, 40, 0.6);
}

function calculateReachScore(metrics: VideoMetrics): number {
  if (metrics.views === 0) return 0;
  
  const logViews = Math.log10(metrics.views + 1);
  
  const score = (logViews - 2) * 20;
  
  return Math.max(0, Math.min(100, score));
}

function calculateConsistencyScore(metrics: VideoMetrics): number {
  const engagementRate = calculateEngagementRate(metrics);
  
  let ageFactor: number;
  if (metrics.days <= 7) {
    ageFactor = 1;
  } else if (metrics.days <= 90) {
    ageFactor = 1 + (metrics.days - 7) / 83 * 0.2;
  } else {
    ageFactor = 1.2 + Math.min((metrics.days - 90) / 275, 0.3);
  }
  
  const consistencyIndex = engagementRate * ageFactor;
  
  return sigmoidNormalize(consistencyIndex, 50, 0.5);
}

function calculateCommunityScore(metrics: VideoMetrics): number {
  if (metrics.likes === 0 && metrics.comments === 0) return 0;
  
  const totalEngagement = metrics.likes + metrics.comments;
  const commentRatio = metrics.comments / totalEngagement;
  
  const commentRate = calculateCommentRate(metrics);
  
  const communityIndex = commentRatio * 100 * 0.6 + commentRate * 8 * 0.4;
  
  return sigmoidNormalize(communityIndex, 15, 0.6);
}

function calculateEfficiencyScore(metrics: VideoMetrics): number {
  if (metrics.duration === 0) return 50;
  
  const viewsPerMinute = calculateViewsPerMinute(metrics);
  const logVPM = Math.log10(viewsPerMinute + 1);
  
  const score = (logVPM - 2) * 25;
  
  return Math.max(0, Math.min(100, score));
}

export function calculateVideoScore(metrics: VideoMetrics): ScoringResult {
  const engagementScore = calculateEngagementScore(metrics);
  const reachScore = calculateReachScore(metrics);
  const consistencyScore = calculateConsistencyScore(metrics);
  const communityScore = calculateCommunityScore(metrics);
  const efficiencyScore = calculateEfficiencyScore(metrics);
  
  const score = 
    engagementScore * CONFIG.WEIGHTS.engagement +
    reachScore * CONFIG.WEIGHTS.reach +
    consistencyScore * CONFIG.WEIGHTS.consistency +
    communityScore * CONFIG.WEIGHTS.community +
    efficiencyScore * CONFIG.WEIGHTS.efficiency;
  
  return {
    score: Math.round(score * 10) / 10,
    components: {
      engagementScore: Math.round(engagementScore * 10) / 10,
      reachScore: Math.round(reachScore * 10) / 10,
      consistencyScore: Math.round(consistencyScore * 10) / 10,
      communityScore: Math.round(communityScore * 10) / 10,
      efficiencyScore: Math.round(efficiencyScore * 10) / 10,
    },
    rates: {
      likeRate: Math.round(calculateLikeRate(metrics) * 10) / 10,
      commentRate: Math.round(calculateCommentRate(metrics) * 100) / 100,
      engagementRate: Math.round(calculateEngagementRate(metrics) * 10) / 10,
      viewsPerDay: Math.round(calculateViewsPerDay(metrics)),
      viewsPerMinute: Math.round(calculateViewsPerMinute(metrics)),
      engagementPerMinute: Math.round(calculateEngagementPerMinute(metrics)),
    },
  };
}

export function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function isShortVideo(durationSeconds: number): boolean {
  return durationSeconds <= 60;
}

export function getScoreLabel(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 70) {
    return {
      label: "Excellent",
      color: "text-emerald-500",
      description: "Exceptional performance - high engagement and reach",
    };
  }
  if (score >= 55) {
    return {
      label: "Very Good",
      color: "text-green-500",
      description: "Above average - good audience engagement",
    };
  }
  if (score >= 40) {
    return {
      label: "Good",
      color: "text-yellow-500",
      description: "Adequate performance - within expectations",
    };
  }
  if (score >= 25) {
    return {
      label: "Fair",
      color: "text-orange-500",
      description: "Below average - engagement could improve",
    };
  }
  return {
    label: "Low",
    color: "text-red-500",
    description: "Needs attention - low engagement",
  };
}
