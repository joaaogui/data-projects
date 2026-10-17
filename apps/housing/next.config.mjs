import { withSecurityHeaders } from "@data-projects/shared/next-headers";

/** @type {import('next').NextConfig} */
const nextConfig = withSecurityHeaders({
  reactCompiler: true,
  serverExternalPackages: ["pino", "pino-pretty"],
  transpilePackages: ["@data-projects/ui", "@data-projects/shared"],
  outputFileTracingIncludes: {
    "/**": ["./src/data/**"],
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
