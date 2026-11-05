# Spec 003 — bench CLI skeleton, SQLite store and stage-run record

**Board task:** TASK-0013 · **Branch:** `task-0013-bench-harness` · **Runbook:** `docs/design/first-batch-runbook.md` (Lane 1) · **Implements:** `notes/02-benchmark-spec.md` section 7

## Problem

Three contenders (P, N, G) must be run on the same tickets and compared on one schema. There
is no harness yet. Every later harness task — scoring (TASK-0014), the P/N/G adapters
(TASK-0016/0017/0018), reporting (TASK-0020) — builds on this skeleton, so its record schema
and adapter contract are the load-bearing part.

## Requirements

- **R1 CLI** (`bench`, TypeScript, Node 22, in `bench/harness/`):
  `bench run --contender <id> --ticket <Tnn> --rep <n> --stages <from>..<to> --seed-order <n> [--set dev|heldout]`,
  `bench report [--format md|json]`, `bench export --out <file.jsonl>`. Unknown contender,
  malformed stage range or missing ticket → non-zero exit with a one-line error.
- **R2 Adapter contract.** One adapter per contender behind a single interface; the core
  contains **no contender-specific logic**. An adapter receives a run context (run_id,
  ticket id, stage list, rep, set, artifact dir) and yields stage events the core
  normalises into records. A registry maps contender id → adapter. This task ships only a
  `stub` adapter (deterministic, no network) used by tests and by `bench run --contender stub`.
- **R3 Record schema** (card AC #2). A zod schema that matches spec section 7's stage-run
  record field for field, including `telemetry_gaps` (mandatory) and `canary_leak`, with
  `stage` ∈ triage|route|design|plan|execute|open_pr|validate|review and `contender` ∈
  P|N|G|stub (`stub` is the only addition; it is excluded from `bench report` contender
  tables unless `--include-stub`). Every record is validated on write; an invalid record
  fails the run with the zod error, it is never stored.
- **R3a No silent zeros** (clarified 2026-11-05 after phase 2, from spec section 7: "a
  contender with missing numbers is shown with the gap named on the chart, not zeros").
  The core never defaults `telemetry_gaps`: an adapter event without it fails validation.
  Every measurement field the core fills with a default because the adapter omitted it
  (timings, `tokens.*`, `cost_usd.*`, `llm_calls`, `tool_calls`, `model_served`) has its
  name appended to `telemetry_gaps` (e.g. `defaulted:tokens.input`).
- **R4 Store.** `bench.sqlite` (path overridable by `BENCH_DB`) with tables `runs`,
  `stage_runs`, `scores`, `interventions`; schema created idempotently on open. `stage_runs`
  stores the full validated record as JSON plus indexed columns (run_id, contender, ticket_id,
  stage, status). `scores` and `interventions` are created with their columns but only
  `interventions` gets a write API now (TASK-0018 uses it); `scores` belongs to TASK-0014.
- **R5 Artifacts.** `artifacts/<run_id>/` created per run (root overridable by
  `BENCH_ARTIFACTS`); the stub writes one file there so the path is exercised.
- **R6 run_id** format `YYYY-MM-DDTHHMMZ-<contender>-<ticket>-r<rep>` (spec section 7 example).
- **R7** (card AC #1). `bench run --contender stub` runs end to end and writes one `runs` row
  and one `stage_runs` row per requested stage.
- **R8** (card AC #3). `bench report` and `bench export` read **only** from SQLite — no
  adapter, artifact or network access. Report shows, per contender × stage: run count,
  completed count, median wall_ms, total tokens, total cost, and the union of telemetry gaps.
  Charts are TASK-0020, not this task.
- **R9** (card AC #4). Unit tests cover the schema (accepts the section 7 example; rejects a
  missing `telemetry_gaps`, a bad stage, a bad contender) and the store (round-trip a run,
  idempotent schema creation, report and export from a seeded DB). An end-to-end test runs
  the CLI against the stub adapter with a temp DB.

## Out of scope (named so nobody builds it here)

Repo reset to `bench/base`, sandbox Jira ticket creation and timers against real systems
(need M1 sandboxes); hidden-test scoring (TASK-0014); P/N/G adapters; charts.

## Constraints

- **Footprint:** new `bench/harness/` only (own `package.json`, `package-lock.json`,
  `tsconfig.json`, `src/`, `tests/`). `bench.sqlite` and `artifacts/` are already gitignored
  at the repo root.
- Exact dependency versions, committed lockfile. Prefer Node built-ins: `node:sqlite`
  (`DatabaseSync`, works unflagged on the repo's Node 22.23) and `node:util` `parseArgs`.
  Match `graph/`'s versions for shared tools: zod 3.24.1, typescript 5.7.3, tsx 4.23.15,
  vitest 2.1.8, @types/node 22.20.5.
- **Benchmark integrity (from CLAUDE.md):** do not read `bench/hidden-tests/`,
  `bench/tickets/expected.draft.yaml` or `bench/*/reference.diff`. Hidden tests carry the
  canary string named in `CLAUDE.md`; if it appears anywhere, stop and flag a leak. (The
  string itself is not repeated here, so the per-PR canary grep stays at zero hits.)

## Done when

R1–R9 hold; `npm run build && npm test` in `bench/harness/` are green when re-run by the
orchestrator; the card's ACs are ticked.
