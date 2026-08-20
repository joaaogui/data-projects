import {
  createJob,
  getLatestJob,
  getLibrarySummary,
  resumeJob,
  runChunk,
  toJobView,
} from "@/lib/import";
import { withErrorHandling } from "@/lib/route-handler";
import type { ImportMode } from "@/types/lastfm";

/** Must exceed CHUNK_BUDGET_MS in lib/import.ts so a chunk can save its cursor. */
export const maxDuration = 60;

export const GET = withErrorHandling("import-status", async () => {
  const [job, summary] = await Promise.all([getLatestJob(), getLibrarySummary()]);
  return Response.json({
    job: job ? toJobView(job) : null,
    summary,
  });
});

interface ImportRequestBody {
  mode?: ImportMode;
  resume?: boolean;
}

/**
 * Advances the import by one chunk and returns the cursor. The client re-posts
 * until `job.status` leaves "running", which keeps a multi-minute backfill
 * inside a series of short requests.
 */
export const POST = withErrorHandling("import-run", async (request) => {
  const body = (await request.json().catch(() => ({}))) as ImportRequestBody;
  const mode: ImportMode = body.mode === "full" ? "full" : "incremental";

  const latest = await getLatestJob();

  let jobId: string;
  if (latest?.status === "running") {
    jobId = latest.id;
  } else if (body.resume && latest?.status === "error") {
    jobId = (await resumeJob(latest.id)).id;
  } else {
    jobId = (await createJob(mode)).id;
  }

  const { job, done } = await runChunk(jobId);
  const summary = done ? await getLibrarySummary() : null;

  return Response.json({ job: toJobView(job), done, summary });
});
