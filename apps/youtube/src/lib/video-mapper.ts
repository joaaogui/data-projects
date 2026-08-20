import dayjs from "dayjs";
import { scoreVideoBatch, calculateVideoScore } from "./scoring";
import type { VideoData } from "@/types/youtube";
import type { videos } from "@/db/schema";

type VideoRow = Pick<
  typeof videos.$inferSelect,
  | "id"
  | "title"
  | "publishedAt"
  | "duration"
  | "views"
  | "likes"
  | "comments"
  | "favorites"
  | "url"
  | "thumbnail"
  | "topics"
  | "fetchedAt"
> & {
  description?: string | null;
};

interface PartialVideoData {
  videoId: string;
  title: string;
  publishedAt: string;
  days: number;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  favorites: number;
  url: string;
  thumbnail: string;
  description?: string;
  topics?: string[];
}

function dbRowToPartial(
  row: VideoRow,
  includeDescription = true
): PartialVideoData {
  const publishedAt = row.publishedAt instanceof Date
    ? row.publishedAt.toISOString()
    : row.publishedAt;

  return {
    videoId: row.id,
    title: row.title,
    publishedAt,
    days: Math.max(1, dayjs(row.fetchedAt).diff(publishedAt, "day")),
    duration: row.duration,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    favorites: row.favorites,
    url: row.url,
    thumbnail: row.thumbnail,
    ...(includeDescription && { description: row.description ?? "" }),
    topics: row.topics ?? undefined,
  };
}

export function dbRowToVideoData(row: VideoRow): VideoData {
  const partial = dbRowToPartial(row);
  const result = calculateVideoScore({
    views: partial.views,
    likes: partial.likes,
    comments: partial.comments,
    days: partial.days,
    duration: partial.duration,
  });

  return {
    ...partial,
    score: result.score,
    scoreComponents: result.components,
    rates: result.rates,
  };
}

export function dbRowsToVideoData(
  rows: VideoRow[],
  includeDescription = true
): VideoData[] {
  if (rows.length === 0) return [];

  const partials = rows.map((row) =>
    dbRowToPartial(row, includeDescription)
  );

  const metrics = partials.map((p) => ({
    views: p.views,
    likes: p.likes,
    comments: p.comments,
    days: p.days,
    duration: p.duration,
  }));

  const results = scoreVideoBatch(metrics);

  return partials.map((partial, i) => ({
    ...partial,
    score: results[i].score,
    scoreComponents: results[i].components,
    rates: results[i].rates,
  }));
}
