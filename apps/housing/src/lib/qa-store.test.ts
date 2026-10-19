import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ getDb: () => null }));

import { sanitizePropertySnapshot } from "./qa-store";

describe("sanitizePropertySnapshot furnitureTier", () => {
  it("keeps the two current tiers", () => {
    expect(sanitizePropertySnapshot({ furnitureTier: "UNFURNISHED" }).furnitureTier).toBe("UNFURNISHED");
    expect(sanitizePropertySnapshot({ furnitureTier: "FULLY_FURNISHED" }).furnitureTier).toBe("FULLY_FURNISHED");
  });

  it("normalizes a legacy SEMI_FURNISHED snapshot to UNFURNISHED", () => {
    expect(sanitizePropertySnapshot({ furnitureTier: "SEMI_FURNISHED" }).furnitureTier).toBe("UNFURNISHED");
    expect(
      sanitizePropertySnapshot({}, { furnitureTier: "SEMI_FURNISHED" as never }).furnitureTier,
    ).toBe("UNFURNISHED");
  });

  it("drops unknown tiers", () => {
    expect(sanitizePropertySnapshot({ furnitureTier: "BOGUS" }).furnitureTier).toBeUndefined();
  });
});
