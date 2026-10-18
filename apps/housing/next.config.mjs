import { withSecurityHeaders } from "@data-projects/shared/next-headers";

// Data files are read at runtime with turbopackIgnore'd paths, so each function lists what it reads.
// Keys are matched with `contains`, so "/" would match every route: "!/api/**" is the page.
const PREFERENCES_FILES = ["./src/data/user-preferences.json"];
const DATASET_FILES = [
  "./src/data/seed-snapshot.json",
  "./src/data/photos-cache.json",
  ...PREFERENCES_FILES,
];

/** @type {import('next').NextConfig} */
const nextConfig = withSecurityHeaders({
  reactCompiler: true,
  transpilePackages: ["@data-projects/ui", "@data-projects/shared", "@data-projects/housing-contract"],
  outputFileTracingIncludes: {
    "!/api/**": DATASET_FILES,
    "/api/photos": DATASET_FILES,
    "/api/properties": DATASET_FILES,
    "/api/properties/details": DATASET_FILES,
    "/api/preferences": PREFERENCES_FILES,
    "/api/qa": DATASET_FILES,
  },
  outputFileTracingExcludes: {
    "/_not-found": ["./src/data/**"],
    "/_global-error": ["./src/data/**"],
    "/icon.svg": ["./src/data/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.quintoandar.com.br",
      },
      {
        protocol: "https",
        hostname: "quintoandar.com.br",
      },
      {
        protocol: "https",
        hostname: "resizedimgs.zapimoveis.com.br",
      },
    ],
  },
});

export default nextConfig;
