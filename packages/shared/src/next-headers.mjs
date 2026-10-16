export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

export function withSecurityHeaders(config = {}) {
  const existingHeaders =
    typeof config.headers === "function" ? config.headers : undefined;
  return {
    ...config,
    async headers() {
      const extra = existingHeaders ? await existingHeaders() : [];
      return [{ source: "/:path*", headers: SECURITY_HEADERS }, ...extra];
    },
  };
}
