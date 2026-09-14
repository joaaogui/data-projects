/** @type {import("next").NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
