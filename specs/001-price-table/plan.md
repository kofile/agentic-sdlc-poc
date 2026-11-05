# Plan 001 — Verify the per-model price table

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md` (exact versions, honesty, UNVERIFIED
marking), `notes/02-benchmark-spec.md` section 5 (cost metric) and D1/D4.

## Approach

1. Fetch the vendor pricing page(s) and read off, per model: base input, output, cache
   write (5m) and cache hit/read, in USD per million tokens.
2. Rewrite `graph/config/prices.json`. Shape per entry (extra keys are ignored by the
   current `PriceEntry` consumer, so this is backward compatible):

   ```json
   "claude-sonnet-5-5": {
     "input_per_1k": 0.0, "output_per_1k": 0.0,
     "cache_read_per_1k": 0.0, "cache_write_per_1k": 0.0,
     "per_million": { "input": 0, "output": 0, "cache_read": 0, "cache_write": 0 },
     "source": "https://…", "retrieved": "2026-11-05"
   }
   ```

   Top-level `_comment` becomes a one-line provenance note (no "UNVERIFIED").
3. Add `graph/tests/unit/prices.test.ts` (vitest, same style as
   `graph/tests/unit/telemetry.test.ts`): read the JSON via `fs` + `path` relative to the
   test file; shape assertions; one hand-computed cost recomputation through
   `estimateCostUsd` from `src/core/telemetry.ts`.
4. Run the graph gates.

## Risks

- A model may not be listed publicly (R2: omit and report, never guess).
- Long-context or batch pricing tiers exist; record only the standard tier and say so in
  `_comment`.
