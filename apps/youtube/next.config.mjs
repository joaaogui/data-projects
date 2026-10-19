import { withSecurityHeaders } from "@data-projects/shared/next-headers";

// Same pattern as VIDEO_ID_PATTERN in src/lib/video-link.ts (config can't import TS).
const VIDEO_ID = "[A-Za-z0-9_-]{11}";

/** @type {import('next').NextConfig} */
const nextConfig = withSecurityHeaders({
  reactCompiler: true,
  // YouTube URL shapes -> /watch/ID, so swapping only the host works for any link.
  // `afterFiles` (the default for an array), so real routes like /admin win over `/:id`.
  async rewrites() {
    return [
      // youtu.be/ID
      { source: `/:id(${VIDEO_ID})`, destination: "/watch/:id" },
      { source: `/shorts/:id(${VIDEO_ID})`, destination: "/watch/:id" },
      { source: `/live/:id(${VIDEO_ID})`, destination: "/watch/:id" },
      { source: `/embed/:id(${VIDEO_ID})`, destination: "/watch/:id" },
    ];
  },
  serverExternalPackages: ["pino", "pino-pretty"],
  transpilePackages: ["@data-projects/ui", "@data-projects/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
});

export default nextConfig;
