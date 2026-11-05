# Spec 001 — Verify the per-model price table

**Board task:** TASK-0019 · **Branch:** `task-0019-price-table` · **Runbook:** `docs/design/first-batch-runbook.md` (Lane 1)

## Problem

`graph/config/prices.json` holds placeholder prices, every entry marked `UNVERIFIED`. Cost
charts are computed by price lookup, so a wrong table corrupts every cost number in the
benchmark. The table also lacks the 5.5 model family: D1 pins N and G to Sonnet 5.5
(`claude-sonnet-5-5`), and the table only has `claude-sonnet-5`, so a Sonnet 5.5 lookup falls
through to `default` today.

## Requirements

- **R1** (card AC #1). Every entry in `prices.json` carries input, output, cache-read
  (cache hit) and cache-write (5-minute) prices in USD per 1K tokens, a `source` URL and a
  `retrieved` date (ISO `YYYY-MM-DD`). No `UNVERIFIED` marker or placeholder comment remains.
- **R2** Entries exist for every model the benchmark can serve: `claude-sonnet-5-5`,
  `claude-opus-5-5`, `claude-haiku-5-5` (current family; D1 and the plugin's as-shipped
  config) and the existing `claude-sonnet-5`, `claude-opus-5`, `claude-haiku-4-5` (fallbacks
  in `.claude/model-tiers.json`). Any model whose price cannot be found on the vendor page is
  left out and listed in the PR body, not guessed.
- **R3** Prices come from the vendor's own pricing page (Anthropic's pricing / models
  documentation), never from memory, a blog, or a reseller. If the page states prices per
  million tokens, convert to per-1K and keep the per-million value alongside for audit.
- **R4** `default` is kept (the existing lookup uses it) and is set equal to
  `claude-sonnet-5-5`, with a note saying so.
- **R5** (card AC #2). A new unit test, `graph/tests/unit/prices.test.ts`, loads the real
  `prices.json` and (a) asserts every entry has the R1 fields, positive numbers, a URL and a
  date, and no `UNVERIFIED` key; (b) recomputes cost with `estimateCostUsd` for a recorded
  usage sample (fixed input/output counts on `claude-sonnet-5-5`) and asserts the exact
  expected USD figure, computed by hand in the test comment.

## Constraints

- **Footprint:** `graph/config/prices.json`, new `graph/tests/unit/prices.test.ts`. No edits
  under `graph/src/`. Cache-aware cost and the requested-vs-served lookup fix belong to
  TASK-0022; this task only supplies the numbers.
- Benchmark integrity (CLAUDE.md): do not read `bench/hidden-tests/`,
  `bench/tickets/expected.draft.yaml` or `bench/*/reference.diff`.
- `npm run build && npm test && npm run test:workflow` in `graph/` stay green.

## Done when

R1–R5 hold, the orchestrator has spot-checked at least two prices against the cited page,
and the card's ACs are ticked.
