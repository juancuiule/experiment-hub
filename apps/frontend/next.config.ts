import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Dev server is reached over LAN/Tailscale (raspberrypi hostname, LAN IP,
  // tailnet IP/FQDN) — Next blocks cross-origin dev resources (HMR websocket)
  // unless the host is listed here. Dev-only; has no effect on prod builds.
  allowedDevOrigins: [
    "raspberrypi",
    "raspberrypi.local",
    "raspberrypi.tailf8ca0e.ts.net",
    "192.168.1.2",
    "100.103.190.70",
  ],
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
