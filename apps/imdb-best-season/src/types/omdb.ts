export interface OMDBTitle {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: { Source: string; Value: string }[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  totalSeasons?: string;
  Response: string;
  Error?: string;
}

export interface OMDBSearchItem {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

export interface OMDBSearchResponse {
  Search?: OMDBSearchItem[];
  totalResults?: string;
  Response: string;
  Error?: string;
}

export interface OMDBEpisode {
  Title: string;
  Released: string;
  Episode: string;
  imdbRating: string;
  imdbID: string;
}

export interface OMDBSeason {
  Title: string;
  Season: string;
  totalSeasons: string;
  Episodes: OMDBEpisode[];
  Response: string;
  Error?: string;
}

export interface Rating {
  source: string;
  value: string;
}

export interface Show {
  imageUrl: string | null;
  name: string | null;
  description: string | null;
  imdbID: string | null;
  totalSeasons: number | null;
  ratings: Rating[];
}

export interface RankedSeason {
  seasonNumber: number;
  rating: number;
  episodes: EpisodeRating[];
}

export interface EpisodeRating {
  episode: number;
  rating: number | null;
  imdbRating: number | null;
  tmdbRating: number | null;
  title: string;
  imdbID?: string;
}

export interface TMDBFindResult {
  id: number;
  name: string;
  vote_average: number;
}

export interface TMDBFindResponse {
  tv_results: TMDBFindResult[];
}

export interface TMDBShowData {
  id: number;
  voteAverage: number;
}

export interface TMDBEpisode {
  episode_number: number;
  name: string;
  vote_average: number;
  vote_count: number;
}

export interface TMDBSeasonResponse {
  episodes: TMDBEpisode[];
}

export interface SearchResult {
  show: Show;
  rankedSeasons: RankedSeason[];
}


