import { describe, expect, it } from "vitest";
import { parseVideoId, timelinePath, VIDEO_ID_PATTERN } from "@/lib/video-link";

describe("timelinePath", () => {
  it("opens the channel's timeline tab on the video", () => {
    expect(timelinePath("UC123", "dQw4w9WgXcQ")).toBe(
      "/channel/UC123?tab=timeline&v=dQw4w9WgXcQ"
    );
  });

  it("encodes the channel segment", () => {
    expect(timelinePath("a/b", "dQw4w9WgXcQ")).toContain("/channel/a%2Fb?");
  });
});

describe("parseVideoId", () => {
  it("accepts an 11-character id", () => {
    expect(parseVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoId("a-_Z0123456")).toBe("a-_Z0123456");
  });

  it.each([null, undefined, "", "short", "dQw4w9WgXcQx", "dQw4w9WgX!Q"])(
    "rejects %j",
    (value) => {
      expect(parseVideoId(value)).toBeNull();
    }
  );
});

describe("VIDEO_ID_PATTERN", () => {
  const re = new RegExp(`^${VIDEO_ID_PATTERN}$`);

  it("matches ids and not the app's own top-level routes", () => {
    expect(re.test("dQw4w9WgXcQ")).toBe(true);
    for (const route of ["admin", "signin", "compare", "report", "channel"]) {
      expect(re.test(route)).toBe(false);
    }
  });
});
