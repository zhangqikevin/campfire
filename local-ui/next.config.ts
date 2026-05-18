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
  // Next.js's build-time TS / ESLint passes resolve types and lint rules
  // relative to each file. For our cross-dir imports from ../src/* — which
  // would need local-ui/node_modules in their resolution path — that fails.
  // The webpack bundle already compiles correctly (we extend resolve.modules
  // below); skip the redundant build-time checks here and rely on the
  // top-level `pnpm typecheck` / `pnpm lint` jobs for actual verification.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { webpack }) => {
    // Files in ../src/components/* import @openuidev/* etc. Node's module
    // resolution walks UP from the importing file looking for node_modules,
    // and never finds local-ui/node_modules (which is a *sibling* path).
    // Explicitly add local-ui/node_modules as a resolution root so cross-dir
    // imports work without restructuring into a real pnpm workspace.
    const localUiModules = path.resolve(__dirname, "node_modules");
    config.resolve = config.resolve ?? {};
    const existing: string[] = config.resolve.modules ?? ["node_modules"];
    config.resolve.modules = [localUiModules, ...existing];
    // Redirect SaaS-side server-action modules to local-mode stubs. The real
    // module has `"use server"` + drizzle/next-auth/bcrypt — local-ui has
    // none of those deps, no DB, no auth. Use NormalModuleReplacementPlugin
    // so Next.js's flight-action scan also sees the stub (a plain resolve
    // alias only redirects the runtime import, not the action manifest).
    const stub = path.resolve(__dirname, "stubs/agent-bindings-actions.ts");
    config.plugins = config.plugins ?? [];
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^@\/lib\/agent-bindings\/actions$/,
        stub,
      ),
    );
    return config;
  },
};

export default nextConfig;
