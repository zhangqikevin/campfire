import type { NextConfig } from "next";

// This is the "local mode" Next.js app: statically exported, bundled into
// campfire-plugin, and served by the plugin at /plugins/campfire/ on the
// user's OpenClaw gateway. No server runtime — no auth, no DB, no API
// routes. Everything is browser-side; the token comes in via URL fragment.
//
// The SaaS-mode app lives at ../src and is a completely separate Next.js
// project (with auth, Postgres, multi-tenancy).
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/plugins/campfire",
  assetPrefix: "/plugins/campfire",
  reactStrictMode: true,
  images: { unoptimized: true },
  // Trailing slash so directory-style URLs resolve cleanly when served as
  // static files by the plugin (e.g. /workspace/ vs /workspace).
  trailingSlash: true,
};

export default nextConfig;
