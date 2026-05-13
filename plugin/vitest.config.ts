import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Vite's resolver doesn't know about `node:sqlite` (it's a Node 22.5+
    // built-in, not in its list). Mark all `node:*` specifiers as external
    // so they pass straight through to Node's loader.
    server: {
      deps: {
        external: [/^node:/],
      },
    },
  },
});
