import { describe, expect, it } from "vitest";

import { PLAYER_TAG } from "./brawl-stars";

describe("brawl-stars constants", () => {
  it("pins the demo account tag", () => {
    expect(PLAYER_TAG).toBe("Y0GLCU0GL");
  });
});
