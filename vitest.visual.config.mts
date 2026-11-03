import { defineConfig } from "vitest/config";

// The visual check (tests/visual). Needs a production build first:
//   npm run build && npm run test:visual
export default defineConfig({
  test: {
    include: ["tests/visual/**/*.test.ts"],
    globalSetup: ["tests/visual/server.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
