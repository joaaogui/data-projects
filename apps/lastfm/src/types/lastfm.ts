export type ImportMode = "full" | "incremental";

export type ImportStatus = "running" | "done" | "error";

export interface ImportLogEntry {
  at: string;
  message: string;
}

export interface ImportJobView {
  id: string;
  status: ImportStatus;
  mode: ImportMode;
  pagesDone: number;
  totalPages: number | null;
  scrobblesImported: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  logs: ImportLogEntry[];
}

/** A single play, as stored. */
export interface Scrobble {
  artistName: string;
  trackName: string;
  albumName: string | null;
  playedAt: string;
}
