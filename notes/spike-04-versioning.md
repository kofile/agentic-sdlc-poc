# Spike 04 — Workflow versioning with a run in flight (Temporal `patched()`)

Date: 2026-11-05. Status: EVIDENCE for the D7 follow-up ("test workflow versioning with in-flight runs"). Board task TASK-0027, spec `specs/002-versioning-test/`.
Code: `graph/tests/versioning/in-flight.test.ts`, `graph/tests/versioning/fixtures/workflows-v2-patched.ts`, `graph/tests/versioning/fixtures/workflows-v2-unpatched.ts`. No edits under `graph/src/`.
Verification: the orchestrator re-ran `npm run test:versioning` (1/1 pass), `npm test`, `npm run test:workflow` and `npm run build`. Per-run timings are agent-reported (UNVERIFIED by the orchestrator).

## 1. Question

D7 chose Temporal with an open caveat: can the `pipeline` workflow definition change while a run is parked mid-flight, without breaking that run? A run can sit at the design approval gate for days, so a deploy during the wait is the normal case, not an edge case.

## 2. Method

- Mechanism under test: Temporal TypeScript patching (`patched()` from `@temporalio/workflow`). Worker Versioning (build-id routing) is out of scope.
- Environment: `TestWorkflowEnvironment.createLocal()`, a real ephemeral Temporal dev server, **not** time-skipping, so the worker swap is real. Time-skipping was not tried.
- Gate policy: design gate `human` (`humanTimeoutSec` 300); plan and merge gates `auto`. Activities are mocked (reusing `tests/workflow/helpers.ts`, plus a `precheck` mock).
- Flow:
  1. Worker v1 (the real `src/workflow/workflows.ts`) starts on a fresh task queue. Run A starts and is polled (via the `state` query) until it waits at the design gate.
  2. Worker v1 is shut down completely. Worker v2-patched (changed definition) starts on the same task queue.
  3. The `decide` signal (design approved) is sent to run A. Assert: run A returns `opened-pr`, PR #1, `designRounds` 1, expected gate outcomes (triage pass, route pass), and `precheck` was **not** called for run A.
  4. Run B starts on v2-patched. Assert: `precheck` is called (with `['run-b']`) and a PR opens.
  5. Negative control: run A's recorded history is replayed with `Worker.runReplayHistory` against v2-patched (expect no error) and against v2-unpatched (expect a determinism error).
- The change in v2: one new activity call, `precheck`, which v1 never calls: `if (patched('add-precheck')) { await std.precheck(...) }`. v2-unpatched is the same code without the `if`.

## 3. Deviation from the plan: where the new step sits

`plan.md` said to insert the step before the plan stage. It was inserted after the route gate and **before the design loop** instead. Reason: `patched()` only protects history that has already been replayed. Run A is parked at the design gate, so everything before that point is in its history. A step placed after the resume point (for example before the plan stage) would run live once the signal arrived, `patched()` would return true for run A, and run A would call `precheck`. That would contradict the requirement that the in-flight run keeps the old path. The spec's own wording ("before the point where the in-flight run resumes") is met by this placement. Accepted by the orchestrator at phase 1 and recorded in `plan.md`.

This is also a practical rule for anyone changing the graph: the guard only helps for steps placed ahead of where existing runs are parked. A change *after* the park point needs no guard for those runs, but it is also not visible as a "new path vs old path" split.

## 4. Commands

From `graph/` (Node 22):

```
npm ci
npm run build              # tsc; passes
npm test                   # 21 pass
npm run test:workflow      # 10 pass
npm run test:versioning    # 1 pass (suite ~2.4 s, ~10 s cold wall; agent-reported timings)
```

`test:versioning` is `vitest run tests/versioning`. Note: `graph/tsconfig.json` includes only `src`, so the fixtures are type-checked by vitest/the workflow bundler, not by `npm run build`.

## 5. Results

| Check | Result |
|---|---|
| Run A (started on v1, parked at design gate, worker swapped to v2-patched, approval sent) | completed `opened-pr`, PR #1, `designRounds` 1, gate outcomes as expected, `precheck` not called |
| Run B (started on v2-patched) | `precheck` called once (`['run-b']`), PR opened |
| Replay of run A's history against v2-patched | no error |
| Replay of run A's history against v2-unpatched | `DeterminismViolationError` (from `@temporalio/workflow`); message contains `[TMPRL1100] Nondeterminism error: Activity type of scheduled event 'design' does not match activity type of activity command 'precheck'` |
| Existing suites | `npm test` 21 pass, `npm run test:workflow` 10 pass, `npm run build` ok |

## 6. Why the negative control matters

A passing "in-flight run survives" test proves little on its own: it would also pass if the change were harmless or if replay were never exercised. The control shows the same change, minus the guard, **does** break run A when its history is replayed, with a specific error naming the new activity. So the test can fail, and its pass for the patched version means the guard is what saved the run. The test asserts `/precheck/` in the message so the failure is the one we expect and not some unrelated error.

## 7. Limits (what this does not show)

- Single patch only. No `deprecatePatch` / patch removal cycle, so the cleanup path for old patches is untested.
- Worker Versioning (build-id routing) not tested; Temporal Cloud not tested; local dev server only.
- Activities are mocked. Real activities (model calls, container execution) change nothing about replay, but were not exercised here.
- One change shape only (a new activity inserted before the park point). Reordering, removing a step, changing a timer or signal name, or changing activity arguments were not tried.
- Runs were parked only at the design gate. A run parked elsewhere, or with many gate rounds in history, was not tried.
- One run each; no repeats, no concurrency. Timings are from a single execution and are agent-reported (UNVERIFIED).
- Fixture workflow is a hand-maintained copy of `pipeline`; if `src/workflow/workflows.ts` changes, the fixtures can drift from it and the control would then be testing a stale copy.
- The test relies on the `state` query to detect the park; it polls at 100 ms for up to 20 s.

## 8. In plain language (for the demo audience)

A request can sit waiting for a person to approve it for days. During that wait we may need to update the system. The question was whether the waiting request survives the update. We tested it: we started a request, let it pause at the approval step, swapped the running software for a newer version that has an extra step, then approved. The paused request finished correctly and did not run the new step; a brand-new request did run it. We also checked that the test can fail: when the new step is added without the safety marker, the system refuses to continue the old request and says exactly why. So updating while work is waiting is possible, as long as changes follow one rule. This was a small test on a laptop with stand-in steps; we have not tried it on the hosted service or with many kinds of changes.
