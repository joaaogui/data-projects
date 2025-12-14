import type {
  OMDBTitle,
  OMDBSeason,
  Show,
  RankedSeason,
  EpisodeRating,
  SearchResult,
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

const OMDB_BASE_URL = "https://www.omdbapi.com";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

async function fetchFromOMDB(params: string): Promise<Response> {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OMDB API key not configured. Get your free key at https://www.omdbapi.com/apikey.aspx"
    );
  }
  return fetch(`${OMDB_BASE_URL}/?${params}&apikey=${apiKey}`);
}

async function fetchFromTMDB(endpoint: string): Promise<Response> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ tv_results: [] }), { status: 200 });
  }
  const separator = endpoint.includes("?") ? "&" : "?";
  return fetch(`${TMDB_BASE_URL}${endpoint}${separator}api_key=${apiKey}`);
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

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

  const tmdbEpisodeMap = new Map<number, number>();
  if (tmdbSeason?.episodes) {
    for (const ep of tmdbSeason.episodes) {
      if (ep.vote_average > 0 && ep.vote_count > 0) {
        tmdbEpisodeMap.set(ep.episode_number, ep.vote_average);
      }
    }
  }

  for (const episode of omdbEpisodes) {
    const episodeNum = Number.parseInt(episode.Episode, 10);
    const imdbRatingStr = episode.imdbRating;
    const imdbRating = imdbRatingStr !== "N/A" && !Number.isNaN(Number.parseFloat(imdbRatingStr))
      ? Number.parseFloat(imdbRatingStr)
      : null;
    const tmdbRating = tmdbEpisodeMap.get(episodeNum) ?? null;

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
    });

    if (medianRating !== null) {
      allMedianRatings.push(medianRating);
    }
  }

  return {
    rating: allMedianRatings.length > 0
      ? allMedianRatings.reduce((a, b) => a + b, 0) / allMedianRatings.length
      : 0,
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

    const totalSeasons = titleData.totalSeasons
      ? Number.parseInt(titleData.totalSeasons, 10)
      : 0;
    
    const omdbSeasonPromises: Promise<OMDBSeason>[] = [];
    if (totalSeasons > 0 && totalSeasons < 100) {
      for (let i = 1; i <= totalSeasons; i++) {
        omdbSeasonPromises.push(getSeason(titleData.imdbID, i));
      }
    }

    const [omdbSeasonsData, tmdbShowData] = await Promise.all([
      Promise.all(omdbSeasonPromises),
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
    };

    let tmdbSeasonsData: (TMDBSeasonResponse | null)[] = [];
    if (tmdbShowData && totalSeasons > 0) {
      const tmdbSeasonPromises: Promise<TMDBSeasonResponse | null>[] = [];
      for (let i = 1; i <= totalSeasons; i++) {
        tmdbSeasonPromises.push(getTmdbSeason(tmdbShowData.id, i));
      }
      tmdbSeasonsData = await Promise.all(tmdbSeasonPromises);
    }

    const rankedSeasons: RankedSeason[] = omdbSeasonsData.map(
      (seasonData, index) => {
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
      }
    );

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
