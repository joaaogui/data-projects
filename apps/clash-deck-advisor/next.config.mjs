import { withSecurityHeaders } from "@data-projects/shared/next-headers";

/** @type {import("next").NextConfig} */
const nextConfig = withSecurityHeaders({
  reactCompiler: true,
  transpilePackages: ["@data-projects/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api-assets.clashroyale.com",
        pathname: "/**",
      },
    ],
  },
});

export default nextConfig;
