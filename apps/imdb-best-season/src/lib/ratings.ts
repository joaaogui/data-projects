import type {
  EpisodeRating,
  RankedSeason,
  SeasonEpisodeHighlight,
} from "@/types/omdb";

export const MAX_SEASONS = 40;
export const SEASON_FETCH_BATCH = 5;

export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

export interface ComputedSeasonStats {
  rating: number;
  meanRating: number;
  imdbMedian: number | null;
  tmdbMedian: number | null;
  minRating: number | null;
  maxRating: number | null;
  deltaFromShowMedian: number;
  highRatedCount: number;
  bestEpisode: SeasonEpisodeHighlight | null;
  worstEpisode: SeasonEpisodeHighlight | null;
  premiereToFinaleDelta: number | null;
}

export function computeSeasonStats(
  season: Pick<RankedSeason, "rating" | "episodes">,
  showMedianRating = 0
): ComputedSeasonStats {
  const ratedEpisodes = season.episodes.filter(
    (ep): ep is EpisodeRating & { rating: number } => ep.rating !== null
  );
  const ratings = ratedEpisodes.map((ep) => ep.rating);
  const imdbRatings = season.episodes
    .map((ep) => ep.imdbRating)
    .filter((r): r is number => r !== null);
  const tmdbRatings = season.episodes
    .map((ep) => ep.tmdbRating)
    .filter((r): r is number => r !== null);

  const rating =
    season.rating || (ratings.length > 0 ? calculateMedian(ratings) : 0);
  const meanRating = ratings.length > 0 ? calculateMean(ratings) : rating;
  const imdbMedian =
    imdbRatings.length > 0 ? calculateMedian(imdbRatings) : null;
  const tmdbMedian =
    tmdbRatings.length > 0 ? calculateMedian(tmdbRatings) : null;
  const minRating = ratings.length > 0 ? Math.min(...ratings) : null;
  const maxRating = ratings.length > 0 ? Math.max(...ratings) : null;
  const highRatedCount = ratedEpisodes.filter((ep) => ep.rating >= 8.0).length;

  let bestEpisode: SeasonEpisodeHighlight | null = null;
  let worstEpisode: SeasonEpisodeHighlight | null = null;

  for (const ep of ratedEpisodes) {
    if (!bestEpisode || ep.rating > bestEpisode.rating) {
      bestEpisode = { episode: ep.episode, title: ep.title, rating: ep.rating };
    }
    if (!worstEpisode || ep.rating < worstEpisode.rating) {
      worstEpisode = {
        episode: ep.episode,
        title: ep.title,
        rating: ep.rating,
      };
    }
  }

  const orderedRated = [...ratedEpisodes].sort((a, b) => a.episode - b.episode);
  const premiereToFinaleDelta =
    orderedRated.length >= 2
      ? orderedRated[orderedRated.length - 1].rating - orderedRated[0].rating
      : null;

  return {
    rating,
    meanRating,
    imdbMedian,
    tmdbMedian,
    minRating,
    maxRating,
    deltaFromShowMedian: rating - showMedianRating,
    highRatedCount,
    bestEpisode,
    worstEpisode,
    premiereToFinaleDelta,
  };
}

export function formatSignedDecimal(value: number, digits = 2): string {
  const fixed = Math.abs(value).toFixed(digits);
  if (value > 0.0005) return `+${fixed}`;
  if (value < -0.0005) return `-${fixed}`;
  return fixed;
}

export async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(mapper))));
  }
  return results;
}

/** Season numbers to fetch, capped at {@link MAX_SEASONS}. */
export function seasonNumbersUpTo(totalSeasons: number): number[] {
  const seasonsToFetch = Math.min(Math.max(totalSeasons, 0), MAX_SEASONS);
  return seasonsToFetch > 0
    ? Array.from({ length: seasonsToFetch }, (_, index) => index + 1)
    : [];
}
