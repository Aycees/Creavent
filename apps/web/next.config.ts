import type { NextConfig } from "next"

const apiUrl = process.env.API_URL ?? "http://localhost:3001"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser only talks to the web app; /api/* is forwarded to the NestJS API
  // so login cookies stay on one site (docs/architecture.md §4.3).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }]
  },
}

export default nextConfig
