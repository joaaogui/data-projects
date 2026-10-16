import { withSecurityHeaders } from "@data-projects/shared/next-headers";

/** @type {import('next').NextConfig} */
const nextConfig = withSecurityHeaders({
  reactCompiler: true,
  transpilePackages: ["@data-projects/ui", "@data-projects/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/image/**",
      },
    ],
  },
});

export default nextConfig;
