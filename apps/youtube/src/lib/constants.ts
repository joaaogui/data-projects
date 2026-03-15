export const AI_CONTEXT_MAX_CHARS = 200_000;
export const AI_QUESTION_MAX_LENGTH = 500;
export const AI_MAX_OUTPUT_TOKENS = 1500;

export const SYNC_POLL_INTERVAL_MS = 2000;
export const JOB_LOG_POLL_INTERVAL_MS = 3000;

export const CHANNEL_FRESHNESS_MS = 6 * 60 * 60 * 1000; // 6 hours
export const SUGGESTION_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const STALE_JOB_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// Transcript fetching
export const TRANSCRIPT_LANGUAGE_PRIORITY = ["pt", "en", "es", "fr", "de", "it", "ja", "ko", "zh", "ru"];
export const TRANSCRIPT_MAX_RETRIES = 4;
export const TRANSCRIPT_BASE_DELAY_MS = 1_500;
export const TRANSCRIPT_COOLDOWN_JITTER_MS = 800;
export const YT_DLP_TIMEOUT_MS = 30_000;

// Scoring
export const SCORING_CONFIG = {
  COMMENT_WEIGHT: 5,
  LIKE_WEIGHT: 1,

  WEIGHTS: {
    reach: 0.3,
    engagement: 0.25,
    momentum: 0.2,
    efficiency: 0.15,
    community: 0.1,
  },

  BAYESIAN_PRIOR_STRENGTH: 100,
  MIN_BUCKET_SIZE: 5,
  POWER_MEAN_P: 0.5,
};

// Transcript sync
export const TRANSCRIPT_SYNC_BATCH_SIZE = 50;
export const TRANSCRIPT_SYNC_CONCURRENCY = 8;
export const TRANSCRIPT_SYNC_GAP_MS = 100;
export const TRANSCRIPT_SYNC_STAGGER_MS = 600;
export const TRANSCRIPT_SYNC_LOG_EVERY_N = 10;
export const TRANSCRIPT_SYNC_DB_CHUNK_SIZE = 25;

// Sync batching
export const VIDEO_UPSERT_BATCH_SIZE = 50;
export const SAGA_DB_BATCH_SIZE = 50;

// Sync rate limiting
export const SYNC_RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 } as const;

// URLs
export const YOUTUBE_VIDEO_PREFIX = "https://www.youtube.com/watch?v=";

// Max limits
export const MAX_SAGAS_PER_CHANNEL = 200;
