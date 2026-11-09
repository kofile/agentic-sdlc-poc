# Spec 007 — stub reasoning runs must not look like real model runs (TASK-0047)

Implements: TASK-0047; runbook amendment A2. Grounds: CLAUDE.md ("Verify the served model
from the response, never from config"; "Honesty"), spec 003 R3a (no silent defaults),
spec 005 R5/R6 (served model, cost on served model), spec 006 R6.

## Problem

`StubReasoning` (`graph/src/adapters/stub-reasoning.ts`) sets `model_served` to the requested
model, `claude-sonnet-5-5`. Since spec 005, `activities.ts` prices cost on `model_served`, so
every stub stage carries a plausible non-zero `cost_usd`. The bench G adapter (spec 006) files
these runs under contender `G`, and `bench report` excludes only contender `stub`. A
stub-backed G run in a scored `bench.sqlite` is therefore indistinguishable from a real Sonnet
run; only `tokens.source: 'estimated'` differs.

## Requirements (mapped to the card's ACs)

- **R1 (AC #1)** `ports/reasoning.ts` exports `NO_MODEL_SERVED = 'stub'`. `StubReasoning`
  reports `model_served: NO_MODEL_SERVED` on every result and on `ReasoningOutputInvalid`
  usage. `model_requested` keeps recording what the activity asked for.
- **R2 (AC #2)** In `activities.ts` `recordStage`, when `modelServed === NO_MODEL_SERVED`, no
  price lookup is made, `cost_usd.tokens` is `0`, and `telemetry_gaps` gains `no_real_model`
  and `cost_not_measured`. No `price_fallback:stub` gap appears. Real-adapter behaviour is
  unchanged.
- **R3 (AC #3)** The bench G adapter refuses a stub-backed run unless the operator opts in.
  - At run start, if `GRAPH_REASONING` is anything other than `anthropic`, the run fails with
    a one-line error naming `GRAPH_REASONING` and `BENCH_G_ALLOW_STUB`, unless
    `BENCH_G_ALLOW_STUB=1`.
  - Independently, after mapping, any stage event whose `model_served` is `stub` or whose
    gaps include `no_real_model` is guaranteed to carry the `no_real_model` gap. This
    defence covers a worker whose environment differs from the harness's.
- **R4 (AC #3)** `bench report` excludes, by default, every **run** that has at least one
  stage record carrying the `no_real_model` gap, alongside contender `stub`. `--include-stub`
  includes both. `bench export` is unchanged and remains a raw dump.
- **R5 (AC #4)** Tests:
  - graph unit: the stub's `model_served` is `stub`; the stub stage is unpriced and has both
    gaps; the real-adapter pricing path is unchanged.
  - harness unit: the G adapter refuses without opt-in; the gap is guaranteed on stub
    events; `report` excludes and includes runs correctly.
  - The opt-in e2e (`test:g`) sets `BENCH_G_ALLOW_STUB=1` and asserts the records show
    `model_served: 'stub'`, cost 0 and the `no_real_model` gap.
  - `npm run test:integration` still passes.
- **R6** Docs: `graph/docs/stage-contracts.md` notes that stub-backed stages carry
  `model_served: stub` and are unpriced. `bench/harness/README.md` documents
  `BENCH_G_ALLOW_STUB` and the report exclusion.

## Constraints

- Footprint per amendment A2 (runbook): `graph/src/ports/reasoning.ts`,
  `graph/src/adapters/stub-reasoning.ts`, `graph/src/workflow/activities.ts`,
  `graph/tests/unit/`, `graph/docs/stage-contracts.md`, `bench/harness/src/adapters/g/`,
  `bench/harness/src/report.ts`, `bench/harness/tests/`, `bench/harness/README.md`.
- No new dependencies. The harness still never imports from `graph/src/`, so it restates the
  `'stub'` literal with a comment citing `graph/src/ports/reasoning.ts`.
- Benchmark integrity, verbatim from CLAUDE.md: "When working on `graph/` or any contender
  code, do not read `bench/hidden-tests/`, `bench/tickets/expected.draft.yaml` or
  `bench/*/reference.diff`."
