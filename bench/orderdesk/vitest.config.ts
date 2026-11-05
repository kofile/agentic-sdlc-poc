import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Generous timeouts, plus single-process sequential execution: this
    // suite is small (well under a second normally) and run as a benchmark
    // ground-truth fixture alongside other work on whatever machine
    // happens to run it, so trading a little parallel-worker speed for a
    // deterministic, bounded execution order is the right call — see
    // CONTRIBUTING.md and tests/testRequest.ts for the investigation this
    // came out of.
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: true,
    pool: "forks",
    fileParallelism: false,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
