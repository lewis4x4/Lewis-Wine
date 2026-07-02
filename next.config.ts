import path from "node:path";
import type { NextConfig } from "next";

// Service worker: built by `serwist build serwist.config.mjs` (see the build
// script) because webpack-plugin PWA integrations are silently skipped by
// Turbopack builds. Registration happens via <SerwistProvider> in layout.tsx.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.vivino.com",
      },
      {
        protocol: "https",
        hostname: "*.vivino.com",
      },
    ],
  },
};

export default nextConfig;
