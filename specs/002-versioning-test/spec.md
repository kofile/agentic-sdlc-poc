# Spec 002 — Temporal workflow-versioning test with runs in flight

**Board task:** TASK-0027 · **Branch:** `task-0027-versioning-test` · **Runbook:** `docs/design/first-batch-runbook.md` (Lane 1)

## Problem

D7 chose Temporal with an open caveat: nobody has shown that the graph's workflow definition
can change while runs are in flight without breaking them. This is a core claim of the
durable-execution approach and a likely question from the n8n owner. Without evidence, D7
rests partly on reading.

## Requirements

- **R1** (card AC #1). An automated test starts a run of the real `pipeline` workflow
  (`graph/src/workflow/workflows.ts`) on worker v1, lets it reach the design approval gate
  (where it durably waits on a signal), stops worker v1, starts worker v2 running a
  **changed** workflow definition, sends the approval, and asserts the original run
  completes with the expected result (PR opened, correct gate outcomes).
- **R2** The change in v2 is a realistic one — a new activity call or step inserted
  before the point where the in-flight run resumes — guarded with Temporal's `patched()`
  API, so new runs take the new path and the in-flight run keeps the old one. The test
  also asserts a run started on v2 does take the new path.
- **R3** Negative control: the same change *without* the `patched()` guard is shown to break
  the in-flight run, via replay of the v1 history against the unguarded v2 code
  (`Worker.runReplayHistory` raising a non-determinism error). This proves the test can
  fail, so its pass means something.
- **R4** (card AC #2). `notes/spike-04-versioning.md` records the method, the exact
  commands, the results (with counts and timings), what was not tested (e.g. Worker
  Versioning / build-id routing, Temporal Cloud), and a plain-language paragraph for the
  demo audience. Results are re-run by the orchestrator before merge.
- **R5** A new script `npm run test:versioning` runs the test; existing `npm test` and
  `npm run test:workflow` stay green.
- **R6** `notes/00-discovery-log.md` D7 row gets no rewrite; a short dated note under
  section 7 points from D7's follow-up to `notes/spike-04-versioning.md`.

## Constraints

- **Footprint:** new `graph/tests/versioning/` (test + v2 workflow fixtures), `graph/package.json`
  (one script line), `notes/spike-04-versioning.md`, a note line in `notes/00-discovery-log.md`.
  **No edits under `graph/src/`** — v2 lives as test fixtures that import shared types from
  `src/`.
- Activities are mocked, reusing `graph/tests/workflow/helpers.ts` (import, do not edit).
- Uses `@temporalio/testing` already in devDependencies; no new dependencies.
- Benchmark integrity (CLAUDE.md): do not read `bench/hidden-tests/`,
  `bench/tickets/expected.draft.yaml` or `bench/*/reference.diff`.

## Done when

R1–R6 hold, the orchestrator has re-run `npm run test:versioning`, and the card's ACs are ticked.
