/** @type {import("next").NextConfig} */
const nextConfig = {
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
