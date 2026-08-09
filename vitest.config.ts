import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    // The CLI integration tests spawn real `node --import tsx` builds, which take ~1.8s on a
    // fast dev machine and multiples of that on CI runners. The 5s default is a unit-test
    // budget and leaves no headroom for slower hardware. ensureBuilt may run a full
    // `npm run build` in beforeAll on a clean clone, which needs more than the 10s hook default.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    typecheck: {
      enabled: true,
      include: ["tests/**/*.test-d.ts"],
    },
  },
});
