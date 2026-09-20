import { beforeEach, describe, expect, it, vi } from "vitest";

const { limitMock, insertMock } = vi.hoisted(() => ({
  limitMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("@/db", () => {
  const selectChain: Record<string, unknown> = {};
  selectChain.from = vi.fn(() => selectChain);
  selectChain.where = vi.fn(() => selectChain);
  selectChain.orderBy = vi.fn(() => selectChain);
  selectChain.limit = limitMock;

  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: insertMock,
    },
  };
});
vi.mock("@/db/schema", () => ({
  importJobs: { status: "status", startedAt: "startedAt" },
  scrobbles: { playedAt: "playedAt" },
}));
vi.mock("drizzle-orm", () => ({
  desc: vi.fn((value) => value),
  eq: vi.fn((left, right) => ({ left, right })),
  sql: vi.fn(),
}));
vi.mock("../lastfm-server", () => ({ getRecentTracks: vi.fn(), RECENT_TRACKS_MAX_LIMIT: 200 }));
vi.mock("../logger", () => ({
  createTaggedLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}));
vi.mock("../env", () => ({ env: { LASTFM_USERNAME: "user" } }));

import { createJob, toJobView } from "../import";

beforeEach(() => {
  limitMock.mockReset();
  insertMock.mockReset();
});

describe("toJobView", () => {
  it("maps a DB row to the API view shape", () => {
    const startedAt = new Date("2024-01-15T12:00:00.000Z");
    const finishedAt = new Date("2024-01-15T12:30:00.000Z");

    const view = toJobView({
      id: "job-1",
      status: "done",
      mode: "full",
      pagesDone: 10,
      totalPages: 10,
      scrobblesImported: 500,
      error: null,
      startedAt,
      finishedAt,
      logs: [{ at: "2024-01-15T12:00:00.000Z", message: "Done" }],
      toTimestamp: 1_700_000_000,
      fromTimestamp: null,
      nextPage: 11,
      updatedAt: finishedAt,
    });

    expect(view).toEqual({
      id: "job-1",
      status: "done",
      mode: "full",
      pagesDone: 10,
      totalPages: 10,
      scrobblesImported: 500,
      error: null,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      logs: [{ at: "2024-01-15T12:00:00.000Z", message: "Done" }],
    });
  });
});

describe("createJob single-job lock", () => {
  it("rejects a second job while one is running", async () => {
    limitMock.mockResolvedValueOnce([
      {
        id: "running-job",
        status: "running",
      },
    ]);

    await expect(createJob("full")).rejects.toMatchObject({
      name: "AppError",
      code: "IMPORT_IN_PROGRESS",
      status: 409,
    });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
