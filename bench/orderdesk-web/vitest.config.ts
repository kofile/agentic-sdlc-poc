import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.tsx", "tests/**/*.test.ts"],
    // Generous timeouts so a loaded machine doesn't turn slowness into a
    // false failure. Unlike bench/orderdesk, this suite is NOT pinned to a
    // single sequential fork: jsdom's per-file environment teardown (and
    // Testing Library's auto-cleanup) turned out to interact badly with
    // forced single-fork execution during investigation — it reused DOM
    // state across files and produced exactly the kind of flakiness this
    // config is meant to prevent. Default (isolated, per-file) pooling is
    // both correct and already fast enough (well under 60s).
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
