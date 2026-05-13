import type { NextConfig } from "next";

// In GitHub Codespaces, the forwarded URL host (e.g. `<name>-3000.app.github.dev`)
// doesn't match the local `Origin` header, so Next.js Server Actions reject the
// request as cross-origin. Whitelist the forwarded host when we detect we're
// inside a Codespace. Only active when both env vars are present, so production
// builds are unaffected.
const codespaceHost =
  process.env["CODESPACE_NAME"] && process.env["GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"]
    ? `${process.env["CODESPACE_NAME"]}-3000.${process.env["GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"]}`
    : null;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  ...(codespaceHost
    ? {
        experimental: {
          serverActions: {
            allowedOrigins: ["localhost:3000", codespaceHost],
          },
        },
      }
    : {}),
};

export default nextConfig;
