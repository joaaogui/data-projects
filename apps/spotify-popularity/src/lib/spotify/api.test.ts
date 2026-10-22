import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  getSpotifyToken: vi.fn().mockResolvedValue("test-token"),
  invalidateToken: vi.fn(),
}));

import {
  getArtistTopTracks,
  searchArtist,
  searchArtists,
} from "./api";
import {
  computeCatalogStats,
  enrichCatalogTracks,
  formatDurationMs,
  formatRuntimeMs,
  getPopularityTierId,
  normalizeAlbumType,
  normalizeArtist,
  parseReleaseYear,
} from "./stats";
import type { SpotifyRawArtist, SpotifyRawTrack } from "./types";

function mockSearch(items: SpotifyRawArtist[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        artists: { items },
      }),
    }),
  );
}

describe("searchArtist", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an exact case-insensitive match with normalized metadata", async () => {
    mockSearch([
      {
        id: "1",
        name: "Radiohead",
        popularity: 84,
        followers: { total: 9_850_000 },
        genres: ["alternative rock", "art rock"],
        images: [{ url: "https://img.example/rh.jpg", height: 640, width: 640 }],
        external_urls: { spotify: "https://open.spotify.com/artist/1" },
      },
      { id: "2", name: "Radio Head Cover Band" },
    ]);

    const artist = await searchArtist("radiohead");
    expect(artist?.id).toBe("1");
    expect(artist?.name).toBe("Radiohead");
    expect(artist?.popularity).toBe(84);
    expect(artist?.followers).toBe(9_850_000);
    expect(artist?.genres).toEqual(["alternative rock", "art rock"]);
    expect(artist?.imageUrl).toBe("https://img.example/rh.jpg");
    expect(artist?.spotifyUrl).toBe("https://open.spotify.com/artist/1");
  });

  it("returns null when only fuzzy matches exist", async () => {
    mockSearch([
      { id: "1", name: "The Beatles" },
      { id: "2", name: "Beatles Tribute" },
    ]);

    await expect(searchArtist("Beatle")).resolves.toBeNull();
  });

  it("returns null for empty results", async () => {
    mockSearch([]);
    await expect(searchArtist("zzzz-no-such-artist")).resolves.toBeNull();
  });

  it("trims whitespace before matching", async () => {
    mockSearch([{ id: "9", name: "Daft Punk" }]);
    const artist = await searchArtist("  Daft Punk  ");
    expect(artist?.id).toBe("9");
    expect(artist?.followers).toBe(0);
    expect(artist?.imageUrl).toBeNull();
  });
});

describe("searchArtists", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("clamps limit between 1 and 10 in the search URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ artists: { items: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchArtists("ab", 99);
    expect(fetchMock.mock.calls[0][0]).toContain("limit=10");

    fetchMock.mockClear();
    await searchArtists("ab", 0);
    expect(fetchMock.mock.calls[0][0]).toContain("limit=1");
  });
});

describe("enrichCatalogTracks & computeCatalogStats", () => {
  const primaryArtist = normalizeArtist({
    id: "artist-1",
    name: "Daft Punk",
    popularity: 86,
    followers: { total: 11_200_000 },
    genres: ["electro", "filter house"],
  });

  const sampleRawTracks: SpotifyRawTrack[] = [
    {
      id: "t-get-lucky-single",
      name: "Get Lucky",
      popularity: 88,
      duration_ms: 248_000,
      explicit: false,
      track_number: 1,
      disc_number: 1,
      preview_url: "https://p.scdn.co/mp3-preview/get-lucky",
      external_ids: { isrc: "USQX91300809" },
      external_urls: { spotify: "https://open.spotify.com/track/t1" },
      artists: [
        { id: "artist-1", name: "Daft Punk", external_urls: { spotify: "https://open.spotify.com/artist/1" } },
        { id: "artist-2", name: "Pharrell Williams", external_urls: { spotify: "https://open.spotify.com/artist/2" } },
        { id: "artist-3", name: "Nile Rodgers", external_urls: { spotify: "https://open.spotify.com/artist/3" } },
      ],
      album: {
        id: "alb-ram",
        name: "Random Access Memories",
        album_type: "album",
        total_tracks: 13,
        release_date: "2013-05-17",
        images: [{ url: "https://img.example/ram.jpg", height: 640, width: 640 }],
        external_urls: { spotify: "https://open.spotify.com/album/ram" },
      },
    },
    // Duplicate track with lower popularity that should be deduplicated out
    {
      id: "t-get-lucky-radio",
      name: "get lucky",
      popularity: 72,
      duration_ms: 248_000,
      explicit: false,
      track_number: 1,
      disc_number: 1,
      artists: [{ id: "artist-1", name: "Daft Punk" }],
      album: {
        id: "alb-gl-single",
        name: "Get Lucky (Radio Edit)",
        album_type: "single",
        total_tracks: 1,
        release_date: "2013-04-19",
      },
    },
    {
      id: "t-instant-crush",
      name: "Instant Crush",
      popularity: 80,
      duration_ms: 337_000,
      explicit: false,
      track_number: 5,
      disc_number: 1,
      preview_url: null,
      external_ids: { isrc: "USQX91300105" },
      external_urls: { spotify: "https://open.spotify.com/track/t2" },
      artists: [
        { id: "artist-1", name: "Daft Punk" },
        { id: "artist-4", name: "Julian Casablancas" },
      ],
      album: {
        id: "alb-ram",
        name: "Random Access Memories",
        album_type: "album",
        total_tracks: 13,
        release_date: "2013-05-17",
        images: [{ url: "https://img.example/ram.jpg", height: 640, width: 640 }],
        external_urls: { spotify: "https://open.spotify.com/album/ram" },
      },
    },
    {
      id: "t-one-more-time",
      name: "One More Time",
      popularity: 85,
      duration_ms: 320_000,
      explicit: false,
      track_number: 1,
      disc_number: 1,
      preview_url: null,
      external_ids: { isrc: "GBDUW0000053" },
      external_urls: { spotify: "https://open.spotify.com/track/t3" },
      artists: [{ id: "artist-1", name: "Daft Punk" }],
      album: {
        id: "alb-discovery",
        name: "Discovery",
        album_type: "album",
        total_tracks: 14,
        release_date: "2001-03-12",
        images: [{ url: "https://img.example/discovery.jpg", height: 640, width: 640 }],
        external_urls: { spotify: "https://open.spotify.com/album/discovery" },
      },
    },
    {
      id: "t-harder-better",
      name: "Harder, Better, Faster, Stronger",
      popularity: 55,
      duration_ms: 224_000,
      explicit: true,
      track_number: 4,
      disc_number: 1,
      preview_url: null,
      external_urls: { spotify: "https://open.spotify.com/track/t4" },
      artists: [{ id: "artist-1", name: "Daft Punk" }],
      album: {
        id: "alb-alive-single",
        name: "Alive 2007 Single",
        album_type: "single",
        total_tracks: 2,
        release_date: "2007",
      },
    },
  ];

  it("deduplicates tracks by name, sorts by popularity, and enriches metadata", () => {
    const enriched = enrichCatalogTracks(sampleRawTracks, primaryArtist);

    expect(enriched).toHaveLength(4);
    expect(enriched.map((t) => t.id)).toEqual([
      "t-get-lucky-single",
      "t-one-more-time",
      "t-instant-crush",
      "t-harder-better",
    ]);

    // Ranks 1..4
    expect(enriched.map((t) => t.rank)).toEqual([1, 2, 3, 4]);

    // Mean popularity = (88 + 85 + 80 + 55) / 4 = 77
    expect(enriched[0].deltaFromArtistAvg).toBe(11); // 88 - 77
    expect(enriched[3].deltaFromArtistAvg).toBe(-22); // 55 - 77

    // Lead track on RAM is Get Lucky, not Instant Crush
    expect(enriched[0].isAlbumLeadTrack).toBe(true);
    expect(enriched[2].isAlbumLeadTrack).toBe(false);
    // Lead track on Discovery is One More Time
    expect(enriched[1].isAlbumLeadTrack).toBe(true);

    // Featured artists & collaboration flags
    expect(enriched[0].isCollaboration).toBe(true);
    expect(enriched[0].featuredArtists.map((a) => a.name)).toEqual([
      "Pharrell Williams",
      "Nile Rodgers",
    ]);
    expect(enriched[1].isCollaboration).toBe(false);
    expect(enriched[1].featuredArtists).toEqual([]);

    // Explicit, ISRC, releaseYear
    expect(enriched[0].isrc).toBe("USQX91300809");
    expect(enriched[0].album.releaseYear).toBe(2013);
    expect(enriched[3].explicit).toBe(true);
    expect(enriched[3].album.releaseYear).toBe(2007);
    expect(enriched[3].album.albumType).toBe("single");
  });

  it("computes comprehensive catalogStats rollups", () => {
    const enriched = enrichCatalogTracks(sampleRawTracks, primaryArtist);
    const stats = computeCatalogStats(enriched);

    expect(stats.totalTracks).toBe(4);
    expect(stats.totalReleases).toBe(3);
    expect(stats.albumCount).toBe(2);
    expect(stats.singleCount).toBe(1);
    expect(stats.compilationCount).toBe(0);
    expect(stats.minYear).toBe(2001);
    expect(stats.maxYear).toBe(2013);
    expect(stats.careerSpan).toBe("2001–2013");

    expect(stats.avgPopularity).toBe(77);
    expect(stats.medianPopularity).toBe(83); // median of [55, 80, 85, 88] = 82.5 -> 83
    expect(stats.peakTrack?.name).toBe("Get Lucky");
    expect(stats.peakTrack?.popularity).toBe(88);

    expect(stats.explicitCount).toBe(1);
    expect(stats.explicitPct).toBe(25);

    expect(stats.collaborationCount).toBe(2);
    expect(stats.soloCount).toBe(2);
    expect(stats.collaborationPct).toBe(50);
    expect(stats.collabAvgPopularity).toBe(84); // (88 + 80) / 2
    expect(stats.soloAvgPopularity).toBe(70); // (85 + 55) / 2
    expect(stats.collabPopularityDelta).toBe(14);

    // Album rollups sorted by avgPopularity desc
    expect(stats.albums.map((a) => a.name)).toEqual([
      "Discovery", // 85 avg
      "Random Access Memories", // 84 avg (88 & 80)
      "Alive 2007 Single", // 55 avg
    ]);
    expect(stats.albums[1].trackCount).toBe(2);
    expect(stats.albums[1].maxPopularity).toBe(88);
    expect(stats.albums[1].topTrackName).toBe("Get Lucky");

    // Popularity tiers
    const viralTier = stats.popularityTiers.find((t) => t.id === "viral");
    const rotationTier = stats.popularityTiers.find((t) => t.id === "rotation");
    expect(viralTier?.count).toBe(3); // 88, 85, 80
    expect(viralTier?.percentage).toBe(75);
    expect(rotationTier?.count).toBe(1); // 55

    // Release year rollups
    expect(stats.releaseYears.map((y) => y.year)).toEqual([2001, 2007, 2013]);
  });

  it("handles empty track lists gracefully", () => {
    expect(enrichCatalogTracks([], primaryArtist)).toEqual([]);
    const emptyStats = computeCatalogStats([]);
    expect(emptyStats.totalTracks).toBe(0);
    expect(emptyStats.careerSpan).toBe("—");
    expect(emptyStats.peakTrack).toBeNull();
    expect(emptyStats.collabPopularityDelta).toBeNull();
    expect(emptyStats.popularityTiers).toHaveLength(5);
  });
});

describe("getArtistTopTracks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fetches artist, albums, and tracks and returns enriched catalog response", async () => {
    const fetchMock = vi
      .fn()
      // 1. /search
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          artists: {
            items: [
              {
                id: "art-1",
                name: "Test Artist",
                popularity: 75,
                followers: { total: 50_000 },
                genres: ["indie pop"],
                images: [{ url: "https://img.example/a.jpg", height: 300, width: 300 }],
              },
            ],
          },
        }),
      })
      // 2. /artists/art-1/albums
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: "alb-1", name: "Debut Album" }],
          next: null,
          total: 1,
        }),
      })
      // 3. /albums?ids=alb-1
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          albums: [
            {
              id: "alb-1",
              name: "Debut Album",
              tracks: {
                items: [{ id: "trk-1", name: "Opening Song", track_number: 1 }],
              },
            },
          ],
        }),
      })
      // 4. /tracks?ids=trk-1
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          tracks: [
            {
              id: "trk-1",
              name: "Opening Song",
              popularity: 68,
              duration_ms: 195_000,
              explicit: false,
              track_number: 1,
              disc_number: 1,
              preview_url: null,
              external_ids: { isrc: "USABC2400001" },
              external_urls: { spotify: "https://open.spotify.com/track/trk-1" },
              artists: [{ id: "art-1", name: "Test Artist" }],
              album: {
                id: "alb-1",
                name: "Debut Album",
                album_type: "album",
                total_tracks: 10,
                release_date: "2024-02-01",
                images: [{ url: "https://img.example/alb.jpg", height: 300, width: 300 }],
                external_urls: { spotify: "https://open.spotify.com/album/alb-1" },
              },
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await getArtistTopTracks("Test Artist");
    expect(result.artist.name).toBe("Test Artist");
    expect(result.artist.followers).toBe(50_000);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].rank).toBe(1);
    expect(result.tracks[0].isrc).toBe("USABC2400001");
    expect(result.catalogStats.totalTracks).toBe(1);
    expect(result.catalogStats.careerSpan).toBe("2024");
  });
});

describe("formatting & normalization helpers", () => {
  it("normalizes album types and parses release years", () => {
    expect(normalizeAlbumType("ALBUM")).toBe("album");
    expect(normalizeAlbumType("single")).toBe("single");
    expect(normalizeAlbumType("EP")).toBe("single");
    expect(normalizeAlbumType("compilation")).toBe("compilation");
    expect(parseReleaseYear("2021-10-15")).toBe(2021);
    expect(parseReleaseYear("1999")).toBe(1999);
    expect(parseReleaseYear("")).toBeNull();
  });

  it("maps popularity scores to tier IDs and formats durations", () => {
    expect(getPopularityTierId(92)).toBe("viral");
    expect(getPopularityTierId(65)).toBe("hit");
    expect(getPopularityTierId(45)).toBe("rotation");
    expect(getPopularityTierId(25)).toBe("deep-cut");
    expect(getPopularityTierId(10)).toBe("vault");

    expect(formatDurationMs(215_000)).toBe("3:35");
    expect(formatDurationMs(0)).toBe("0:00");
    expect(formatRuntimeMs(3_900_000)).toBe("1h 5m");
    expect(formatRuntimeMs(1_800_000)).toBe("30m");
  });
});
