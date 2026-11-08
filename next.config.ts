import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  devIndicators: false,
  // Expose *whether* optional integrations are configured (never the secrets themselves),
  // so the UI can hide controls that would otherwise do nothing.
  env: {
    NEXT_PUBLIC_IMAGE_SEARCH_ENABLED: process.env.UNSPLASH_ACCESS_KEY ? "1" : "",
    NEXT_PUBLIC_PUSH_ENABLED:
      process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? "1" : "",
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
