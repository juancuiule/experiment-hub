import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: ["@experiment-hub/engine"],
  async rewrites() {
    // Dev only: production traffic reaches /api via nginx, which owns the
    // routing split — the frontend container should never proxy API calls.
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:3100"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
