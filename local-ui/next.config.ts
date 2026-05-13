import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  // The repo root has its own pnpm-lock.yaml (for the SaaS app in ../src).
  // Without this, Next.js picks that as the workspace root and gets confused
  // about where node_modules lives.
  outputFileTracingRoot: __dirname,
  webpack: (config) => {
    // Files in ../src/components/* import @openuidev/* etc. Node's module
    // resolution walks UP from the importing file looking for node_modules,
    // and never finds local-ui/node_modules (which is a *sibling* path).
    // Explicitly add local-ui/node_modules as a resolution root so cross-dir
    // imports work without restructuring into a real pnpm workspace.
    const localUiModules = path.resolve(__dirname, "node_modules");
    config.resolve = config.resolve ?? {};
    const existing: string[] = config.resolve.modules ?? ["node_modules"];
    config.resolve.modules = [localUiModules, ...existing];
    return config;
  },
};

export default nextConfig;
