import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpdate, mockDelete, mockSelect } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect,
  },
}));

vi.mock("@/db/schema", () => ({
  syncJobs: { status: "status", updatedAt: "updated_at" },
}));

vi.mock("@/lib/logger", () => ({
  createTaggedLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
  lt: vi.fn((a: unknown, b: unknown) => [a, b]),
  sql: vi.fn(),
}));

import { cleanupStaleJobs, getJobHealthMetrics } from "../sync-cleanup";

function chainMock(rowCount: number) {
  const where = vi.fn().mockResolvedValue({ rowCount });
  const set = vi.fn().mockReturnValue({ where });
  return { set, where };
}

describe("cleanupStaleJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cleanup result with counts", async () => {
    const updateChain = chainMock(3);
    mockUpdate.mockReturnValue({ set: updateChain.set });

    const deleteWhere = vi.fn().mockResolvedValue({ rowCount: 5 });
    mockDelete.mockReturnValue({ where: deleteWhere });

    const result = await cleanupStaleJobs();

    expect(result).toEqual({ markedFailed: 3, deletedOld: 5 });
  });

  it("calls db.update for stale jobs", async () => {
    const updateChain = chainMock(0);
    mockUpdate.mockReturnValue({ set: updateChain.set });

    const deleteWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
    mockDelete.mockReturnValue({ where: deleteWhere });

    await cleanupStaleJobs();

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error: "Job timed out (stale job cleanup)",
      }),
    );
  });

  it("calls db.delete for old completed/failed jobs", async () => {
    const updateChain = chainMock(0);
    mockUpdate.mockReturnValue({ set: updateChain.set });

    const deleteWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
    mockDelete.mockReturnValue({ where: deleteWhere });

    await cleanupStaleJobs();

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(deleteWhere).toHaveBeenCalledOnce();
  });

  it("handles null rowCount as zero", async () => {
    const updateChain = chainMock(0);
    const updateWhere = vi
      .fn()
      .mockResolvedValue({ rowCount: null });
    updateChain.set.mockReturnValue({ where: updateWhere });
    mockUpdate.mockReturnValue({ set: updateChain.set });

    const deleteWhere = vi
      .fn()
      .mockResolvedValue({ rowCount: null });
    mockDelete.mockReturnValue({ where: deleteWhere });

    const result = await cleanupStaleJobs();

    expect(result).toEqual({ markedFailed: 0, deletedOld: 0 });
  });
});

describe("getJobHealthMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroed metrics when no jobs exist", async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ groupBy });
    mockSelect.mockReturnValue({ from });

    const metrics = await getJobHealthMetrics();

    expect(metrics).toEqual({
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      total: 0,
    });
  });

  it("aggregates job counts by status", async () => {
    const rows = [
      { status: "pending", count: 2 },
      { status: "running", count: 1 },
      { status: "completed", count: 10 },
      { status: "failed", count: 3 },
    ];
    const groupBy = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ groupBy });
    mockSelect.mockReturnValue({ from });

    const metrics = await getJobHealthMetrics();

    expect(metrics).toEqual({
      pending: 2,
      running: 1,
      completed: 10,
      failed: 3,
      total: 16,
    });
  });
});
