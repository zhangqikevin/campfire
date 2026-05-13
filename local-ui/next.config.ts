import type { NextConfig } from "next";

// This is the "local mode" Next.js app: statically exported, bundled into
// campfire-plugin, and served by the plugin at /plugins/campfire/ on the
// user's OpenClaw gateway. No server runtime — no auth, no DB, no API
// routes. Everything is browser-side; the token comes in via URL fragment.
//
// The SaaS-mode app lives at ../src and is a completely separate Next.js
// project (with auth, Postgres, multi-tenancy).

// basePath is configurable so the same export works whether the gateway is
// reached directly (default `/plugins/campfire`) or behind a reverse proxy
// with a path prefix (e.g. `CAMPFIRE_BASE_PATH=/oc/pokeball/plugins/campfire`
// for a gateway hosted at `https://example.com/oc/pokeball/`).
// install.sh derives this from CAMPFIRE_EXTERNAL_URL; building manually
// requires setting CAMPFIRE_BASE_PATH yourself.
const basePath = process.env["CAMPFIRE_BASE_PATH"] ?? "/plugins/campfire";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath,
  reactStrictMode: true,
  images: { unoptimized: true },
  // Trailing slash so directory-style URLs resolve cleanly when served as
  // static files by the plugin (e.g. /workspace/ vs /workspace).
  trailingSlash: true,
};

export default nextConfig;
