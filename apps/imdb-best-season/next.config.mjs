import { withSecurityHeaders } from "@data-projects/shared/next-headers";

/** @type {import('next').NextConfig} */
const nextConfig = withSecurityHeaders({
  reactCompiler: true,
  transpilePackages: ["@data-projects/ui", "@data-projects/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "ia.media-imdb.com",
        pathname: "/images/**",
      },
    ],
  },
});

export default nextConfig;
