import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createTaggedLogger } from "@/lib/logger";
import { eq } from "drizzle-orm";

const log = createTaggedLogger("sync-stream");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { jobId } = await params;
  log.info({ jobId }, "SSE stream started");

  const encoder = new TextEncoder();
  let lastLogCount = 0;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        if (closed) return;

        try {
          const [job] = await db
            .select({
              status: syncJobs.status,
              progress: syncJobs.progress,
              logs: syncJobs.logs,
              error: syncJobs.error,
            })
            .from(syncJobs)
            .where(eq(syncJobs.id, jobId))
            .limit(1);

          if (!job) {
            send({ type: "error", message: "Job not found" });
            controller.close();
            closed = true;
            return;
          }

          const allLogs = (job.logs ?? []) as Array<{ ts: number; level: string; msg: string }>;
          const newLogs = allLogs.slice(lastLogCount);
          lastLogCount = allLogs.length;

          if (newLogs.length > 0) {
            send({ type: "logs", logs: newLogs });
          }

          send({
            type: "status",
            status: job.status,
            progress: job.progress,
            error: job.error,
          });

          if (job.status === "completed" || job.status === "failed") {
            send({ type: "done", status: job.status });
            controller.close();
            closed = true;
            return;
          }

          setTimeout(poll, 2000);
        } catch (err) {
          log.error({ err, jobId }, "SSE poll error");
          if (!closed) {
            send({ type: "error", message: "Internal error" });
            controller.close();
            closed = true;
          }
        }
      };

      await poll();
    },
    cancel() {
      closed = true;
      log.info({ jobId }, "SSE stream closed by client");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
