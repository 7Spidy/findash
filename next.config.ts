import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve /data/*.json as static assets in development
  // In production (Vercel), they're served from the repo directly
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=60" },
        ],
      },
    ];
  },
};

export default nextConfig;
