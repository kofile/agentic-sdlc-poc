# Spec 004 — integration test leaks worker processes (TASK-0043)

## Problem

`graph/tests/integration/run-all.ts` leaves its Temporal worker processes running after it
exits. Observed 2026-11-05: three npm/tsx/node worker trees per run, still polling task
queue `sdlc-graph-poc`. A later run, from any checkout, can have its activities picked up by
a stale worker running another checkout's code (on `main` the test failed with ENOENT on a
deleted worktree's `graph/teams/auto.json`). Cause: `startWorker()` spawns `npx tsx …`, and
`worker.kill('SIGKILL')` signals only the `npx` wrapper, not its tsx/node descendants; on a
crash or failed assertion path some kills are never reached at all.

## Requirements (mapped to the card's ACs)

- **R1 (AC #1)** `run-all.ts` kills every worker process **tree** it starts — the wrapper and
  all descendants — on success, on assertion failure, and on a thrown error/crash, before
  the process exits. Mid-test kills (test 1's deliberate SIGKILL) also kill the whole tree,
  so the "killed" worker cannot keep polling.
- **R2 (AC #2)** Two consecutive runs of `npm run test:integration` leave zero worker
  processes behind, checked with `ps -axo pid,command | grep '[w]orker.ts'`.
- **R3 (AC #3)** Each run uses a per-run task queue name (e.g. `sdlc-graph-poc-it-<ts>-<rand>`):
  the spawned workers receive it via the existing `TEMPORAL_TASK_QUEUE` env var read by
  `graph/src/workflow/worker.ts`, and every `workflow.start` / `workflow.execute` in the
  test passes the same name. A stray worker on `sdlc-graph-poc` (or on another run's queue)
  therefore cannot steal its tasks.
- **R4** Test semantics are unchanged: same two tests, same assertions, same output
  (`ALL PASS` / `N FAILURE(S)`, exit code 0/1).

## Constraints

- Footprint: `graph/tests/integration/` only. Must not edit `graph/src/` (TASK-0022 owns it)
  or `graph/package.json`.
- No new dependencies.
- Benchmark integrity, verbatim from CLAUDE.md: "When working on `graph/` or any contender
  code, do not read `bench/hidden-tests/`, `bench/tickets/expected.draft.yaml` or
  `bench/*/reference.diff`."

## Out of scope

Cleaning up workers leaked by runs before this fix (the operator/orchestrator kills them by
hand), and any change to the worker itself.
