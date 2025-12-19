import type { VideoData } from "@/types/youtube";

type Operator = "eq" | "gt" | "gte" | "lt" | "lte" | "contains";

interface FilterCondition {
  eq?: number | boolean | string;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  contains?: string;
}

interface Filters {
  [field: string]: FilterCondition;
}

interface SortConfig {
  field: string;
  order: "asc" | "desc";
}

export interface VideoQuery {
  filters?: Filters;
  sort?: SortConfig;
  limit?: number;
  explanation?: string;
}

export interface QueryResult {
  videos: VideoData[];
  explanation?: string;
}

function getNestedValue(obj: VideoData, path: string): unknown {
  const parts = path.split(".");
  let value: unknown = obj;

  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[part];
  }

  return value;
}

function matchesCondition(
  value: unknown,
  condition: FilterCondition
): boolean {
  for (const [operator, target] of Object.entries(condition)) {
    if (target === undefined) continue;

    switch (operator as Operator) {
      case "eq":
        if (value !== target) return false;
        break;
      case "gt":
        if (typeof value !== "number" || value <= (target as number))
          return false;
        break;
      case "gte":
        if (typeof value !== "number" || value < (target as number))
          return false;
        break;
      case "lt":
        if (typeof value !== "number" || value >= (target as number))
          return false;
        break;
      case "lte":
        if (typeof value !== "number" || value > (target as number))
          return false;
        break;
      case "contains":
        if (
          typeof value !== "string" ||
          !value.toLowerCase().includes((target as string).toLowerCase())
        )
          return false;
        break;
    }
  }

  return true;
}

function matchesFilters(video: VideoData, filters: Filters): boolean {
  for (const [field, condition] of Object.entries(filters)) {
    const value = getNestedValue(video, field);
    if (!matchesCondition(value, condition)) {
      return false;
    }
  }
  return true;
}

function compareValues(a: unknown, b: unknown, order: "asc" | "desc"): number {
  if (typeof a === "number" && typeof b === "number") {
    return order === "asc" ? a - b : b - a;
  }
  if (typeof a === "string" && typeof b === "string") {
    return order === "asc" ? a.localeCompare(b) : b.localeCompare(a);
  }
  return 0;
}

export function executeQuery(
  videos: VideoData[],
  query: VideoQuery
): QueryResult {
  let result = [...videos];

  console.log(`[Video Filter] Starting with ${videos.length} videos`);
  console.log(`[Video Filter] Query:`, JSON.stringify(query, null, 2));

  if (query.filters) {
    const filterFields = Object.keys(query.filters);
    console.log(`[Video Filter] Sample values from first 3 videos:`);
    videos.slice(0, 3).forEach((v, i) => {
      const values: Record<string, unknown> = {};
      filterFields.forEach(f => { values[f] = getNestedValue(v, f); });
      console.log(`  Video ${i + 1}: ${JSON.stringify(values)}`);
    });
    
    result = result.filter((video) => matchesFilters(video, query.filters!));
    console.log(`[Video Filter] After filters: ${result.length} videos`);
  }

  if (query.sort) {
    const { field, order } = query.sort;
    result.sort((a, b) => {
      const valueA = getNestedValue(a, field);
      const valueB = getNestedValue(b, field);
      return compareValues(valueA, valueB, order);
    });
  }

  if (query.limit && query.limit > 0) {
    result = result.slice(0, query.limit);
  }

  return {
    videos: result,
    explanation: query.explanation,
  };
}

export type AIProvider = "groq" | "gemini";

export async function fetchAIQuery(
  question: string,
  provider: AIProvider = "groq"
): Promise<VideoQuery> {
  const response = await fetch("/api/ai/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, provider }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to process question");
  }

  return response.json();
}

