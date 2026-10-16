import { withSecurityHeaders } from "@data-projects/shared/next-headers";

/** @type {import('next').NextConfig} */
const nextConfig = withSecurityHeaders({
  reactCompiler: true,
  serverExternalPackages: ["pino", "pino-pretty"],
  transpilePackages: ["@data-projects/ui", "@data-projects/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lastfm.freetls.fastly.net",
      },
    ],
  },
});

export default nextConfig;
