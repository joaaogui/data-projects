import { median, sleep } from "@data-projects/shared";

export { median, sleep };

export class WorkerPoolError extends Error {
  constructor(
    message: string,
    public readonly errors: { item: unknown; error: unknown }[],
  ) {
    super(message);
    this.name = "WorkerPoolError";
    Object.setPrototypeOf(this, WorkerPoolError.prototype);
  }
}

export async function runWorkerPool<T>(
  items: T[],
  processFn: (item: T) => Promise<void>,
  options: { concurrency: number; gapMs: number; staggerMs?: number },
): Promise<void> {
  const queue = [...items];
  const { concurrency, gapMs, staggerMs = 0 } = options;
  const errors: { item: T; error: unknown }[] = [];

  async function worker(index: number) {
    if (staggerMs > 0 && index > 0) {
      await sleep(Math.floor(Math.random() * staggerMs));
    }
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      try {
        await processFn(item);
      } catch (err) {
        errors.push({ item, error: err });
      }
      if (gapMs > 0) await sleep(gapMs);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, (_, i) => worker(i)),
  );

  if (errors.length > 0) {
    throw new WorkerPoolError(
      `${errors.length}/${items.length} items failed in worker pool`,
      errors,
    );
  }
}
