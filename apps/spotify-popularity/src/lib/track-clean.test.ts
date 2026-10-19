import { describe, expect, it } from "vitest";

import { cleanTrackName } from "./track-clean";

describe("cleanTrackName", () => {
  it("returns a plain track name unchanged", () => {
    expect(cleanTrackName("Bohemian Rhapsody")).toBe("Bohemian Rhapsody");
  });

  it("trims surrounding whitespace from a plain track name", () => {
    expect(cleanTrackName("  Bohemian Rhapsody  ")).toBe("Bohemian Rhapsody");
  });

  it("keeps a hyphenated qualifier that is not a remaster suffix", () => {
    expect(cleanTrackName("Song - Live")).toBe("Song - Live");
  });

  it("removes a parenthesized suffix", () => {
    expect(cleanTrackName("Song (Live)")).toBe("Song");
  });

  it("removes a parenthesized suffix without preceding whitespace", () => {
    expect(cleanTrackName("Song(Live)")).toBe("Song");
  });

  it("removes a bracketed suffix", () => {
    expect(cleanTrackName("Song [Live]")).toBe("Song");
  });

  it("removes a bracketed suffix without preceding whitespace", () => {
    expect(cleanTrackName("Song[Live]")).toBe("Song");
  });

  it("removes whitespace preceding a parenthesized suffix", () => {
    expect(cleanTrackName("Song \t  (Live)")).toBe("Song");
  });

  it("removes whitespace preceding a bracketed suffix", () => {
    expect(cleanTrackName("Song   [Live]")).toBe("Song");
  });

  it("removes a non-breaking space preceding a parenthesized suffix", () => {
    expect(cleanTrackName("Song\u00a0(Live)")).toBe("Song");
  });

  it("removes a parenthesized group in the middle of a name", () => {
    expect(cleanTrackName("Song (Live) Remix")).toBe("Song Remix");
  });

  it("removes multiple parenthesized and bracketed groups", () => {
    expect(cleanTrackName("Song (One) Two (Three) [Four] Five")).toBe(
      "Song Two Five"
    );
  });

  it("removes consecutive parenthesized and bracketed groups", () => {
    expect(cleanTrackName("Song (Live) [Remastered] (2023)")).toBe("Song");
  });

  it("removes an empty parenthesized group", () => {
    expect(cleanTrackName("Song ()")).toBe("Song");
  });

  it("keeps an unmatched opening parenthesis", () => {
    expect(cleanTrackName("Song (Live")).toBe("Song (Live");
  });

  it("keeps an unmatched opening bracket", () => {
    expect(cleanTrackName("Song [Live")).toBe("Song [Live");
  });

  it("keeps an unmatched opening parenthesis at the start", () => {
    expect(cleanTrackName("(Song")).toBe("(Song");
  });

  it("keeps a mismatched closing bracket for an opening parenthesis", () => {
    expect(cleanTrackName("Song (Live]")).toBe("Song (Live]");
  });

  it("keeps an extra closing parenthesis after the first close", () => {
    expect(cleanTrackName("Song (Live))")).toBe("Song)");
  });

  it("keeps an extra closing bracket after the first close", () => {
    expect(cleanTrackName("Song [Live]]")).toBe("Song]");
  });

  it("terminates nested parentheses at the first closing parenthesis", () => {
    expect(cleanTrackName("Song (a (b) c)")).toBe("Song c)");
  });

  it("terminates nested brackets at the first closing bracket", () => {
    expect(cleanTrackName("Song [a [b] c]")).toBe("Song c]");
  });

  it("keeps a lone closing parenthesis", () => {
    expect(cleanTrackName("Song ) Title")).toBe("Song ) Title");
  });

  it("keeps a lone closing bracket", () => {
    expect(cleanTrackName("Song ] Title")).toBe("Song ] Title");
  });

  it("does not remove parenthesized content containing a newline", () => {
    expect(cleanTrackName("Song (Live\nVersion) Remix")).toBe(
      "Song (Live\nVersion) Remix"
    );
  });

  it("does not remove bracketed content containing a newline", () => {
    expect(cleanTrackName("Song [Live\nVersion] Remix")).toBe(
      "Song [Live\nVersion] Remix"
    );
  });

  it("does not remove parenthesized content containing a carriage return", () => {
    expect(cleanTrackName("Song (Live\rVersion) Remix")).toBe(
      "Song (Live\rVersion) Remix"
    );
  });

  it("does not remove parenthesized content containing a unicode line separator", () => {
    expect(cleanTrackName("Song (Live\u2028Version) Remix")).toBe(
      "Song (Live\u2028Version) Remix"
    );
  });

  it("removes a '- Remaster' suffix", () => {
    expect(cleanTrackName("Song - Remaster")).toBe("Song");
  });

  it("removes a lowercase '- remaster' suffix", () => {
    expect(cleanTrackName("Song - remaster")).toBe("Song");
  });

  it("removes an uppercase '- REMASTER' suffix", () => {
    expect(cleanTrackName("Song - REMASTER")).toBe("Song");
  });

  it("removes a '- Remastered 2023' suffix", () => {
    expect(cleanTrackName("Song - Remastered 2023")).toBe("Song");
  });

  it("removes a remaster suffix with extra whitespace around the dash", () => {
    expect(cleanTrackName("Song   -   Remastered 2023")).toBe("Song");
  });

  it("removes a remaster suffix without whitespace around the dash", () => {
    expect(cleanTrackName("Song-Remaster")).toBe("Song");
  });

  it("removes '- remaster (Remastered 2023)' as a combined suffix", () => {
    expect(cleanTrackName("Song - remaster (Remastered 2023)")).toBe("Song");
  });

  it("removes a remaster suffix through to the absolute end", () => {
    expect(cleanTrackName("Song - Remaster Deluxe Edition")).toBe("Song");
  });

  it("does not strip 'Remaster' in the middle without a preceding dash", () => {
    expect(cleanTrackName("Song Remaster of Fate")).toBe(
      "Song Remaster of Fate"
    );
  });

  it("does not strip 'Remaster' that appears before a dash", () => {
    expect(cleanTrackName("Remaster Song - Live")).toBe("Remaster Song - Live");
  });

  it("does not strip 'Remaster' after a different dash qualifier", () => {
    expect(cleanTrackName("Song - Live Remaster Sessions")).toBe(
      "Song - Live Remaster Sessions"
    );
  });

  it("does not strip a remaster suffix that does not reach the absolute end", () => {
    expect(cleanTrackName("Song - Remaster\nLive")).toBe(
      "Song - Remaster\nLive"
    );
  });

  it("does not strip a dash qualifier that is not remaster", () => {
    expect(cleanTrackName("Song - Mastered 2023")).toBe("Song - Mastered 2023");
  });

  it("returns an empty string for an empty input", () => {
    expect(cleanTrackName("")).toBe("");
  });

  it("returns an empty string for a whitespace-only input", () => {
    expect(cleanTrackName("   ")).toBe("");
  });

  it("returns an empty string for mixed whitespace only", () => {
    expect(cleanTrackName(" \t\n ")).toBe("");
  });

  it("returns an empty string when only a parenthesized group remains", () => {
    expect(cleanTrackName("(Live)")).toBe("");
  });

  it("returns an empty string when only a bracketed group remains", () => {
    expect(cleanTrackName("[Live]")).toBe("");
  });

  it("returns an empty string when only bracketed groups remain", () => {
    expect(cleanTrackName("(Live) [Remastered]")).toBe("");
  });

  it("returns an empty string when only a remaster suffix remains", () => {
    expect(cleanTrackName(" - Remaster")).toBe("");
  });
});
