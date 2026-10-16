import { describe, it, expect, vi } from "vitest";
import { runWorkerPool, WorkerPoolError } from "@/lib/utils";

describe("runWorkerPool", () => {
  it("processes all items", async () => {
    const processed: number[] = [];
    await runWorkerPool(
      [1, 2, 3, 4],
      async (item) => {
        processed.push(item);
      },
      { concurrency: 2, gapMs: 0 },
    );
    expect(processed.toSorted((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it("handles empty items array", async () => {
    const fn = vi.fn();
    await runWorkerPool([], fn, { concurrency: 2, gapMs: 0 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    await runWorkerPool(
      [1, 2, 3, 4, 5, 6],
      async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 20));
        concurrent--;
      },
      { concurrency: 2, gapMs: 0 },
    );

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("throws WorkerPoolError when items fail", async () => {
    await expect(
      runWorkerPool(
        [1, 2, 3],
        async (item) => {
          if (item === 2) throw new Error("fail on 2");
        },
        { concurrency: 3, gapMs: 0 },
      ),
    ).rejects.toThrow(WorkerPoolError);
  });

  it("aggregates all errors in WorkerPoolError", async () => {
    try {
      await runWorkerPool(
        [1, 2, 3],
        async (item) => {
          if (item >= 2) throw new Error(`fail on ${item}`);
        },
        { concurrency: 3, gapMs: 0 },
      );
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WorkerPoolError);
      const poolErr = err as WorkerPoolError;
      expect(poolErr.errors).toHaveLength(2);
      expect(poolErr.message).toContain("2/3");
    }
  });

  it("continues processing remaining items after a failure", async () => {
    const processed: number[] = [];
    try {
      await runWorkerPool(
        [1, 2, 3, 4],
        async (item) => {
          processed.push(item);
          if (item === 1) throw new Error("fail");
        },
        { concurrency: 1, gapMs: 0 },
      );
    } catch {
      // expected
    }
    expect(processed).toEqual([1, 2, 3, 4]);
  });
});
