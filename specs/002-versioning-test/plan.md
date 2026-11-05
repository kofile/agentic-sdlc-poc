# Plan 002 — Temporal workflow-versioning test

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md`, D7 in `notes/00-discovery-log.md` and
`notes/spike-02-engine.md`.

## Method (settled; the implementer does not re-choose it)

Temporal TypeScript **patching** (`patched()` from `@temporalio/workflow`) is the method under
test, because it is the mechanism a PoC operator would actually use for a code change with
runs in flight. Worker Versioning (build-id routing) is out of scope and named as such in the
evidence note.

## Design

- `graph/tests/versioning/fixtures/workflows-v2-patched.ts` — re-exports everything from
  `src/workflow/workflows.ts` except `pipeline`, and defines `pipeline` as a copy of v1 with
  one inserted step before the plan stage, guarded by `if (patched('add-precheck')) { … }`.
  The inserted step calls an activity that v1 never calls (e.g. a mock `precheck`), so a
  missing guard is a real non-determinism.
- `graph/tests/versioning/fixtures/workflows-v2-unpatched.ts` — the same change without the
  guard (negative control only).
- `graph/tests/versioning/in-flight.test.ts`:
  1. `TestWorkflowEnvironment.createLocal()` (not time-skipping, so the worker swap is
     real) — or time-skipping if the swap is shown to work there; record which in the note.
  2. Worker v1 (`workflowsPath` = real `src/workflow/workflows.ts`, mocked activities from
     `tests/workflow/helpers.ts` plus a `precheck` mock) on task queue Q; start run A with a
     policy that waits for human design approval; poll the `state` query until it is
     waiting at the design gate.
  3. Shut worker v1 down; start worker v2-patched on Q; signal approval to run A; await
     result; assert completed, PR opened, `precheck` NOT called for run A.
  4. Start run B on v2-patched; assert `precheck` IS called.
  5. Fetch run A's history; `Worker.runReplayHistory` against v2-unpatched → expect a
     `DeterminismViolationError` (negative control); against v2-patched → no error.
- `graph/package.json`: `"test:versioning": "vitest run tests/versioning"`.
- `vitest` include for `tests/versioning` if the config restricts paths.

## Evidence

`notes/spike-04-versioning.md`: method, commands, raw result lines, timings, limits, plain
paragraph. Discovery-log note line points to it.
