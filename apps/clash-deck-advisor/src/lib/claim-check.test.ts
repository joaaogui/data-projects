import { describe, expect, it } from "vitest";

import { groundedClaims } from "./claim-check";

const known = ["Poison", "Golden Knight", "Knight", "The Log", "Magic Archer"];
const allowed = ["Golden Knight", "The Log"];

describe("groundedClaims", () => {
  it("accepts text that only names cards in the decided deck", () => {
    expect(
      groundedClaims({
        text: "Save The Log for the swarm and counterpush with Golden Knight.",
        allowedCards: allowed,
        knownCards: known,
      }),
    ).toEqual([]);
  });

  it("rejects a card that is not in the deck", () => {
    expect(
      groundedClaims({
        text: "Trade Poison for splash.",
        allowedCards: allowed,
        knownCards: known,
      }).join(" "),
    ).toMatch(/Poison/);
  });

  it("does not treat Knight as Golden Knight", () => {
    expect(
      groundedClaims({
        text: "Use Golden Knight on the counterpush.",
        allowedCards: allowed,
        knownCards: known,
      }),
    ).toEqual([]);
  });

  it("rejects invented replay events", () => {
    expect(
      groundedClaims({
        text: "The replay showed you clustered troops at the bridge.",
        allowedCards: allowed,
        knownCards: known,
      }).join(" "),
    ).toMatch(/replay/i);
  });
});
