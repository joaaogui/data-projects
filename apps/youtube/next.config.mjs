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
