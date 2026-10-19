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

/**
 * Cryptographically secure random integer in [0, maxExclusive), backed by
 * `globalThis.crypto.getRandomValues` (available in browsers and Node >= 19).
 * Use instead of the insecure pseudorandom generator wherever a random value is needed.
 * Uses rejection sampling so every value in the range is equally likely
 * (no modulo bias).
 */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 4_294_967_296) {
    throw new RangeError("maxExclusive must be an integer in [1, 2^32]");
  }
  if (maxExclusive === 1) return 0;
  const limit = 4_294_967_296 - (4_294_967_296 % maxExclusive);
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    globalThis.crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % maxExclusive;
}

/**
 * Returns a uniformly shuffled copy of `items` (Fisher-Yates) using
 * {@link secureRandomInt}. The input array is not mutated.
 */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
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
      await sleep(secureRandomInt(staggerMs));
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
