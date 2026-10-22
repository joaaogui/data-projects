import type {
  OMDBTitle,
  OMDBSeason,
  Show,
  RankedSeason,
  EpisodeRating,
  SearchResult,
  TMDBEpisode,
  TMDBFindResponse,
  TMDBSeasonResponse,
  TMDBShowData,
} from "@/types/omdb";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateTitle, getSafeErrorMessage } from "@/lib/validation";
import {
  getFromCache,
  setInCache,
  getTitleCacheKey,
  getSeasonCacheKey,
  getTmdbIdCacheKey,
  getTmdbSeasonCacheKey,
} from "@/lib/cache";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";
import {
  SEASON_FETCH_BATCH,
  calculateMedian,
  computeSeasonStats,
  mapInBatches,
  seasonNumbersUpTo,
} from "@/lib/ratings";
import { fetchFromOMDB } from "@/lib/omdb";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

async function getTmdbShowData(imdbId: string): Promise<TMDBShowData | null> {
  const cacheKey = getTmdbIdCacheKey(imdbId);
  const cached = getFromCache<TMDBShowData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = `${TMDB_BASE_URL}/find/${imdbId}?external_source=imdb_id&api_key=${process.env.TMDB_API_KEY}`;
    const response = await fetch(url);
    const data: TMDBFindResponse = await response.json();
    const result = data.tv_results?.[0];
    if (!result) {
      return null;
    }
    const showData: TMDBShowData = {
      id: result.id,
      voteAverage: result.vote_average,
    };
    setInCache(cacheKey, showData);
    return showData;
  } catch (error) {
    console.error(`[TMDB Error]`, error);
    return null;
  }
}

async function getTmdbSeason(tmdbId: number, season: number): Promise<TMDBSeasonResponse | null> {
  const cacheKey = getTmdbSeasonCacheKey(tmdbId, season);
  const cached = getFromCache<TMDBSeasonResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}?api_key=${process.env.TMDB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data: TMDBSeasonResponse = await response.json();
    setInCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`[TMDB Season Error]`, error);
    return null;
  }
}

async function getTitle(title: string): Promise<OMDBTitle> {
  const cacheKey = getTitleCacheKey(title);
  const cached = getFromCache<OMDBTitle>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetchFromOMDB(`t=${encodeURIComponent(title)}&tomatoes=true`);
  const data = await response.json();

  if (data.Error) {
    throw new Error(data.Error);
  }

  setInCache(cacheKey, data);
  return data;
}

async function getSeason(imdbID: string, season: number): Promise<OMDBSeason> {
  const cacheKey = getSeasonCacheKey(imdbID, season);
  const cached = getFromCache<OMDBSeason>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetchFromOMDB(`i=${imdbID}&Season=${season}`);
  const data = await response.json();

  if (data.Error) {
    throw new Error(data.Error);
  }

  setInCache(cacheKey, data);
  return data;
}

function calculateSeasonRating(
  omdbEpisodes: OMDBSeason["Episodes"],
  tmdbSeason: TMDBSeasonResponse | null
): {
  rating: number;
  episodeRatings: EpisodeRating[];
} {
  const episodeRatings: EpisodeRating[] = [];
  const allMedianRatings: number[] = [];

  const tmdbEpisodeMap = new Map<number, TMDBEpisode>();
  if (tmdbSeason?.episodes) {
    for (const ep of tmdbSeason.episodes) {
      tmdbEpisodeMap.set(ep.episode_number, ep);
    }
  }

  for (const episode of omdbEpisodes) {
    const episodeNum = Number.parseInt(episode.Episode, 10);
    const imdbRatingStr = episode.imdbRating;
    const imdbRating = imdbRatingStr !== "N/A" && !Number.isNaN(Number.parseFloat(imdbRatingStr))
      ? Number.parseFloat(imdbRatingStr)
      : null;
    const tmdbEp = tmdbEpisodeMap.get(episodeNum);
    const tmdbRating =
      tmdbEp && tmdbEp.vote_average > 0 && tmdbEp.vote_count > 0
        ? tmdbEp.vote_average
        : null;

    const ratingsToMedian: number[] = [];
    if (imdbRating !== null) ratingsToMedian.push(imdbRating);
    if (tmdbRating !== null) ratingsToMedian.push(tmdbRating);

    const medianRating = ratingsToMedian.length > 0 ? calculateMedian(ratingsToMedian) : null;

    episodeRatings.push({
      episode: episodeNum,
      rating: medianRating,
      imdbRating,
      tmdbRating,
      title: episode.Title,
      imdbID: episode.imdbID,
      released: episode.Released && episode.Released !== "N/A" ? episode.Released : undefined,
      overview: tmdbEp?.overview?.trim() ? tmdbEp.overview.trim() : undefined,
      runtime: typeof tmdbEp?.runtime === "number" && tmdbEp.runtime > 0 ? tmdbEp.runtime : null,
      tmdbVoteCount: typeof tmdbEp?.vote_count === "number" && tmdbEp.vote_count > 0 ? tmdbEp.vote_count : null,
    });

    if (medianRating !== null) {
      allMedianRatings.push(medianRating);
    }
  }

  return {
    // Season score = median of per-episode ratings (each episode already
    // blends IMDb/TMDB via median). Matches the product copy everywhere.
    rating:
      allMedianRatings.length > 0 ? calculateMedian(allMedianRatings) : 0,
    episodeRatings,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `search:${clientIp}`,
      RATE_LIMITS.search
    );

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      );
    }

    const { title } = await params;

    const validation = validateTitle(title);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const sanitizedTitle = validation.sanitized!;
    const titleData = await getTitle(sanitizedTitle);

    if (titleData.Type !== "series") {
      return Response.json(
        { error: "Please search for a TV series" },
        { status: 400, headers: corsHeaders }
      );
    }

    const seasonNumbers = seasonNumbersUpTo(
      titleData.totalSeasons ? Number.parseInt(titleData.totalSeasons, 10) : 0,
    );

    const totalSeasons = titleData.totalSeasons
      ? Number.parseInt(titleData.totalSeasons, 10)
      : 0;

    const [omdbSeasonsData, tmdbShowData] = await Promise.all([
      mapInBatches(seasonNumbers, SEASON_FETCH_BATCH, (season) =>
        getSeason(titleData.imdbID, season),
      ),
      getTmdbShowData(titleData.imdbID),
    ]);

    const ratings = (titleData.Ratings || []).map((r) => ({
      source: r.Source,
      value: r.Value,
    }));
    
    if (tmdbShowData?.voteAverage) {
      ratings.push({
        source: "TMDB",
        value: `${tmdbShowData.voteAverage.toFixed(1)}/10`,
      });
    }

    const show: Show = {
      imageUrl: titleData.Poster === "N/A" ? null : titleData.Poster,
      name: titleData.Title,
      description: titleData.Plot,
      imdbID: titleData.imdbID,
      totalSeasons: totalSeasons || null,
      ratings,
      year: titleData.Year && titleData.Year !== "N/A" ? titleData.Year : undefined,
      genre: titleData.Genre && titleData.Genre !== "N/A" ? titleData.Genre : undefined,
      runtime: titleData.Runtime && titleData.Runtime !== "N/A" ? titleData.Runtime : undefined,
      awards: titleData.Awards && titleData.Awards !== "N/A" ? titleData.Awards : undefined,
      imdbRating: titleData.imdbRating && titleData.imdbRating !== "N/A" ? titleData.imdbRating : undefined,
      imdbVotes: titleData.imdbVotes && titleData.imdbVotes !== "N/A" ? titleData.imdbVotes : undefined,
    };

    let tmdbSeasonsData: (TMDBSeasonResponse | null)[] = [];
    if (tmdbShowData && seasonNumbers.length > 0) {
      tmdbSeasonsData = await mapInBatches(
        seasonNumbers,
        SEASON_FETCH_BATCH,
        (season) => getTmdbSeason(tmdbShowData.id, season),
      );
    }

    const baseSeasons = omdbSeasonsData.map((seasonData, index) => {
      const tmdbSeason = tmdbSeasonsData[index] ?? null;
      const { rating, episodeRatings } = calculateSeasonRating(
        seasonData.Episodes,
        tmdbSeason
      );
      return {
        seasonNumber: index + 1,
        rating,
        episodes: episodeRatings,
      };
    });

    const validSeasonRatings = baseSeasons
      .map((s) => s.rating)
      .filter((r) => r > 0);
    const showMedianRating =
      validSeasonRatings.length > 0 ? calculateMedian(validSeasonRatings) : 0;

    const rankedSeasons: RankedSeason[] = baseSeasons.map((baseSeason) => {
      const stats = computeSeasonStats(baseSeason, showMedianRating);
      return {
        ...baseSeason,
        ...stats,
      };
    });

    rankedSeasons.sort((a, b) => b.rating - a.rating);

    const result: SearchResult = {
      show,
      rankedSeasons,
    };

    return Response.json(result, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" }
      ),
    });
  } catch (error) {
    console.error("Search error:", error);
    return Response.json(
      {
        error: getSafeErrorMessage(error, "Failed to search for show"),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
