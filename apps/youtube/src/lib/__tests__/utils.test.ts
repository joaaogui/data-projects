import { describe, it, expect, vi } from "vitest";
import { median, runWorkerPool, WorkerPoolError } from "@/lib/utils";

describe("median", () => {
  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns the single element for array of length 1", () => {
    expect(median([42])).toBe(42);
  });

  it("returns the middle element for odd-length array", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("returns the average of two middle elements for even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("handles already sorted input", () => {
    expect(median([10, 20, 30, 40, 50])).toBe(30);
  });

  it("handles unsorted input", () => {
    expect(median([50, 10, 40, 20, 30])).toBe(30);
  });

  it("handles duplicate values", () => {
    expect(median([5, 5, 5])).toBe(5);
  });

  it("does not mutate the original array", () => {
    const arr = [3, 1, 2];
    median(arr);
    expect(arr).toEqual([3, 1, 2]);
  });
});

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
