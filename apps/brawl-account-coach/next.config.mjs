import { withSecurityHeaders } from "@data-projects/shared/next-headers";

/** @type {import("next").NextConfig} */
const nextConfig = withSecurityHeaders({
  reactCompiler: true,
  transpilePackages: ["@data-projects/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.brawlify.com",
        pathname: "/brawlers/**",
      },
    ],
  },
});

export default nextConfig;
