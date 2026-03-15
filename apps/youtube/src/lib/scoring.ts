import { SCORING_CONFIG } from "@/lib/constants";
import { median } from "./utils";

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
    momentumScore: number;
    efficiencyScore: number;
    communityScore: number;
  };
  rates: {
    likeRate: number;
    commentRate: number;
    engagementRate: number;
    viewsPerDay: number;
    viewsPerHour: number;
    viewsPerContentMin: number;
    engagementPerMinute: number;
  };
}

const CONFIG = SCORING_CONFIG;

type DurationBucket = "short" | "medium" | "long";

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function sigmoidNormalize(value: number, midpoint: number, steepness: number = 1): number {
  const raw = 1 / (1 + Math.exp(-steepness * (value - midpoint) / midpoint));
  const floor = 1 / (1 + Math.exp(steepness));
  return Math.max(0, ((raw - floor) / (1 - floor)) * 100);
}

function percentileRank(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 50;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return (lo / sorted.length) * 100;
}

function smoothedRate(events: number, trials: number, priorRate: number, priorStrength: number = CONFIG.BAYESIAN_PRIOR_STRENGTH): number {
  return (events + priorRate * priorStrength) / (trials + priorStrength);
}

function powerMean(components: number[], weights: number[], p: number = CONFIG.POWER_MEAN_P): number {
  const totalW = weights.reduce((a, b) => a + b, 0);
  if (totalW === 0) return 0;

  if (Math.abs(p) < 0.001) {
    return Math.exp(
      weights.reduce((s, w, i) => s + (w / totalW) * Math.log(Math.max(components[i], 0.01)), 0)
    );
  }

  return Math.pow(
    weights.reduce((s, w, i) => s + (w / totalW) * Math.pow(Math.max(components[i], 0.01), p), 0),
    1 / p,
  );
}

function getDurationBucket(durationSec: number): DurationBucket {
  if (durationSec < 60) return "short";
  if (durationSec <= 600) return "medium";
  return "long";
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

// ---------------------------------------------------------------------------
// Raw rate computations (no normalization — just the metric value)
// ---------------------------------------------------------------------------

function rawEngagementRate(m: VideoMetrics): number {
  if (m.views === 0) return 0;
  return ((m.likes * CONFIG.LIKE_WEIGHT + m.comments * CONFIG.COMMENT_WEIGHT) / m.views) * 1000;
}

function rawLikeRate(m: VideoMetrics): number {
  if (m.views === 0) return 0;
  return (m.likes / m.views) * 1000;
}

function rawCommentRate(m: VideoMetrics): number {
  if (m.views === 0) return 0;
  return (m.comments / m.views) * 1000;
}

function rawViewsPerDay(m: VideoMetrics): number {
  if (m.days === 0) return m.views;
  return m.views / m.days;
}

function rawViewsPerHour(m: VideoMetrics): number {
  if (m.days === 0) return m.views / 24;
  return m.views / m.days / 24;
}

function rawViewsPerContentMin(m: VideoMetrics): number {
  return m.views / Math.max(m.duration / 60, 1);
}

function rawEngagementPerMinute(m: VideoMetrics): number {
  const minutes = m.duration / 60;
  if (minutes === 0) return 0;
  return (m.likes + m.comments) / minutes;
}

function rawMomentumIndex(m: VideoMetrics): number {
  const vpd = rawViewsPerDay(m);
  if (vpd === 0) return 0;
  const confidence = Math.min(m.days / 14, 1);
  return vpd * Math.sqrt(m.days + 1) * confidence;
}

function rawEfficiencyRate(m: VideoMetrics): number {
  const minutes = Math.max(m.duration / 60, 0.5);
  return (m.likes + m.comments) / minutes;
}

function rawCommunityIndex(m: VideoMetrics, medianCommentRate: number): number {
  if (m.likes === 0 && m.comments === 0) return 0;
  const total = m.likes + m.comments;
  const minEvidence = 30;
  const commentRatio = total >= minEvidence
    ? m.comments / total
    : smoothedRate(m.comments, total, 0.1, minEvidence);
  const cRate = m.views > 0
    ? smoothedRate(m.comments, m.views / 1000, medianCommentRate, CONFIG.BAYESIAN_PRIOR_STRENGTH / 10)
    : 0;
  return commentRatio * 100 * 0.6 + cRate * 8 * 0.4;
}

// ---------------------------------------------------------------------------
// Absolute-scale fallback scorers (used by single-video scoring)
// ---------------------------------------------------------------------------

function absoluteEngagementScore(m: VideoMetrics, medianRate: number): number {
  const rate = m.views > 0
    ? smoothedRate(
      m.likes * CONFIG.LIKE_WEIGHT + m.comments * CONFIG.COMMENT_WEIGHT,
      m.views / 1000,
      medianRate,
    )
    : 0;
  return sigmoidNormalize(rate, 40, 0.6);
}

function absoluteReachScore(m: VideoMetrics): number {
  if (m.views === 0) return 0;
  const logViews = Math.log10(m.views + 1);
  return Math.max(0, Math.min(100, (logViews - 2) * 20));
}

function absoluteMomentumScore(m: VideoMetrics): number {
  const idx = rawMomentumIndex(m);
  if (idx === 0) return 0;
  const logIdx = Math.log10(idx + 1);
  return Math.max(0, Math.min(100, (logIdx - 2.5) * 20));
}

function absoluteEfficiencyScore(m: VideoMetrics): number {
  const rate = rawEfficiencyRate(m);
  return sigmoidNormalize(rate, 30, 0.5);
}

function absoluteCommunityScore(m: VideoMetrics): number {
  const idx = rawCommunityIndex(m, 0.5);
  return sigmoidNormalize(idx, 15, 0.6);
}

// ---------------------------------------------------------------------------
// Single-video scoring (absolute fallback when batch context unavailable)
// ---------------------------------------------------------------------------

export function calculateVideoScore(metrics: VideoMetrics): ScoringResult {
  const engagementScore = absoluteEngagementScore(metrics, 20);
  const reachScore = absoluteReachScore(metrics);
  const momentumScore = absoluteMomentumScore(metrics);
  const efficiencyScore = absoluteEfficiencyScore(metrics);
  const communityScore = absoluteCommunityScore(metrics);

  const w = CONFIG.WEIGHTS;
  const score = powerMean(
    [reachScore, engagementScore, momentumScore, efficiencyScore, communityScore],
    [w.reach, w.engagement, w.momentum, w.efficiency, w.community],
  );

  return {
    score: round1(score),
    components: {
      engagementScore: round1(engagementScore),
      reachScore: round1(reachScore),
      momentumScore: round1(momentumScore),
      efficiencyScore: round1(efficiencyScore),
      communityScore: round1(communityScore),
    },
    rates: buildRates(metrics),
  };
}

// ---------------------------------------------------------------------------
// Batch scoring (channel-relative with percentile normalization)
// ---------------------------------------------------------------------------

export function scoreVideoBatch(allMetrics: VideoMetrics[]): ScoringResult[] {
  if (allMetrics.length === 0) return [];
  if (allMetrics.length === 1) return [calculateVideoScore(allMetrics[0])];

  const medianEngRate = median(allMetrics.filter(m => m.views > 0).map(rawEngagementRate));
  const medianComRate = median(allMetrics.filter(m => m.views > 0).map(m => rawCommentRate(m)));

  const rawValues = allMetrics.map(m => ({
    engagementRate: m.views > 0
      ? smoothedRate(
        m.likes * CONFIG.LIKE_WEIGHT + m.comments * CONFIG.COMMENT_WEIGHT,
        m.views / 1000,
        medianEngRate,
      )
      : 0,
    views: m.views,
    momentumIndex: rawMomentumIndex(m),
    efficiencyRate: rawEfficiencyRate(m),
    communityIndex: rawCommunityIndex(m, medianComRate),
  }));

  const bucketMap = new Map<DurationBucket, number[]>();
  allMetrics.forEach((m, i) => {
    const b = getDurationBucket(m.duration);
    if (!bucketMap.has(b)) bucketMap.set(b, []);
    bucketMap.get(b)!.push(i);
  });

  const sortedByMetric = (indices: number[], extract: (i: number) => number) =>
    indices.map(extract).sort((a, b) => a - b);

  const allIndices = allMetrics.map((_, i) => i);

  const globalSorted = {
    views: sortedByMetric(allIndices, i => rawValues[i].views),
    eng: sortedByMetric(allIndices, i => rawValues[i].engagementRate),
    mom: sortedByMetric(allIndices, i => rawValues[i].momentumIndex),
    eff: sortedByMetric(allIndices, i => rawValues[i].efficiencyRate),
    com: sortedByMetric(allIndices, i => rawValues[i].communityIndex),
  };

  const bucketSortedCache = new Map<DurationBucket, typeof globalSorted>();
  for (const [bucket, indices] of bucketMap) {
    if (indices.length >= CONFIG.MIN_BUCKET_SIZE) {
      bucketSortedCache.set(bucket, {
        views: sortedByMetric(indices, i => rawValues[i].views),
        eng: sortedByMetric(indices, i => rawValues[i].engagementRate),
        mom: sortedByMetric(indices, i => rawValues[i].momentumIndex),
        eff: sortedByMetric(indices, i => rawValues[i].efficiencyRate),
        com: sortedByMetric(indices, i => rawValues[i].communityIndex),
      });
    }
  }

  const w = CONFIG.WEIGHTS;

  return allMetrics.map((m, i) => {
    const s = bucketSortedCache.get(getDurationBucket(m.duration)) ?? globalSorted;
    const rv = rawValues[i];

    const reachScore = percentileRank(rv.views, s.views);
    const engagementScore = percentileRank(rv.engagementRate, s.eng);
    const momentumScore = percentileRank(rv.momentumIndex, s.mom);
    const efficiencyScore = percentileRank(rv.efficiencyRate, s.eff);
    const communityScore = percentileRank(rv.communityIndex, s.com);

    const score = powerMean(
      [reachScore, engagementScore, momentumScore, efficiencyScore, communityScore],
      [w.reach, w.engagement, w.momentum, w.efficiency, w.community],
    );

    return {
      score: round1(score),
      components: {
        engagementScore: round1(engagementScore),
        reachScore: round1(reachScore),
        momentumScore: round1(momentumScore),
        efficiencyScore: round1(efficiencyScore),
        communityScore: round1(communityScore),
      },
      rates: buildRates(m),
    };
  });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function buildRates(m: VideoMetrics) {
  return {
    likeRate: round1(rawLikeRate(m)),
    commentRate: Math.round(rawCommentRate(m) * 100) / 100,
    engagementRate: round1(rawEngagementRate(m)),
    viewsPerDay: Math.round(rawViewsPerDay(m)),
    viewsPerHour: Math.round(rawViewsPerHour(m)),
    viewsPerContentMin: Math.round(rawViewsPerContentMin(m)),
    engagementPerMinute: Math.round(rawEngagementPerMinute(m)),
  };
}

// ---------------------------------------------------------------------------
// Duration & formatting
// ---------------------------------------------------------------------------

export function parseISO8601Duration(duration: string): number {
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(duration);
  if (!match) return 0;

  const hours = Number.parseInt(match[1] || "0", 10);
  const minutes = Number.parseInt(match[2] || "0", 10);
  const seconds = Number.parseInt(match[3] || "0", 10);

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

// ---------------------------------------------------------------------------
// Score labels (adaptive when channel context provided, fixed fallback)
// ---------------------------------------------------------------------------

interface ScoreLabel {
  label: string;
  color: string;
  description: string;
}

const FIXED_LABELS: { min: number; label: ScoreLabel }[] = [
  { min: 70, label: { label: "Excellent", color: "text-emerald-600 dark:text-emerald-400", description: "Exceptional performance across all dimensions" } },
  { min: 55, label: { label: "Very Good", color: "text-teal-600 dark:text-teal-400", description: "Above average - strong audience engagement" } },
  { min: 40, label: { label: "Good", color: "text-amber-600 dark:text-amber-400", description: "Solid performance within expectations" } },
  { min: 25, label: { label: "Fair", color: "text-orange-600 dark:text-orange-400", description: "Below average - room for improvement" } },
  { min: 0, label: { label: "Low", color: "text-red-600 dark:text-red-400", description: "Needs attention - low engagement" } },
];

const ADAPTIVE_TIERS: { qMin: number; label: ScoreLabel }[] = [
  { qMin: 0.9, label: { label: "Excellent", color: "text-emerald-600 dark:text-emerald-400", description: "Top 10% of this channel" } },
  { qMin: 0.75, label: { label: "Very Good", color: "text-teal-600 dark:text-teal-400", description: "Top 25% of this channel" } },
  { qMin: 0.5, label: { label: "Good", color: "text-amber-600 dark:text-amber-400", description: "Above median for this channel" } },
  { qMin: 0.25, label: { label: "Fair", color: "text-orange-600 dark:text-orange-400", description: "Below median for this channel" } },
  { qMin: 0, label: { label: "Low", color: "text-red-600 dark:text-red-400", description: "Bottom 25% of this channel" } },
];

export function getScoreLabel(score: number, allScores?: number[]): ScoreLabel {
  if (allScores && allScores.length >= 5) {
    const sorted = [...allScores].sort((a, b) => a - b);
    for (const tier of ADAPTIVE_TIERS) {
      if (score >= quantile(sorted, tier.qMin)) return tier.label;
    }
    return (ADAPTIVE_TIERS.at(-1) ?? ADAPTIVE_TIERS[0]).label;
  }

  for (const entry of FIXED_LABELS) {
    if (score >= entry.min) return entry.label;
  }
  return (FIXED_LABELS.at(-1) ?? FIXED_LABELS[0]).label;
}

// ---------------------------------------------------------------------------
// Recalculate score with custom UI weights (avoids duplicating powerMean)
// ---------------------------------------------------------------------------

export function recalculateWithWeights(
  components: ScoringResult["components"],
  metricWeights: { views: number; engagement: number; momentum: number; efficiency: number; community: number }
): number {
  const total = Object.values(metricWeights).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const values = [
    components.reachScore,
    components.engagementScore,
    components.momentumScore,
    components.efficiencyScore,
    components.communityScore,
  ];
  const weights = [
    metricWeights.views,
    metricWeights.engagement,
    metricWeights.momentum,
    metricWeights.efficiency,
    metricWeights.community,
  ].map(w => w / total);

  return round1(powerMean(values, weights));
}
