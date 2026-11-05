# Tasks 006 — G adapter

## Phase 1: Contract extension and pure pieces

- [x] T001 `adapters/types.ts`: `InterventionEvent`, `AdapterEvent`; `core/run.ts` writes intervention events; test
- [x] T002 `adapters/g/ticket.ts`, `stages.ts`, `paths.ts` + unit tests
- [x] T003 `adapters/g/telemetry.ts` (read + map, design-round merge, gate fold, stop handling, invalid-output mapping) + fixture JSONL tests
- [x] T004 `npm run build && npm test` green

## Phase 2: Worker, gates, adapter and registration

- [x] T004a `record.ts`: `gate.expected`/`gate.correct` optional (R6a); report treats absent `correct` as not scored; tests
- [x] T005 Add `@temporalio/client` 1.25.0 exact; lockfile
- [x] T006 `adapters/g/worker.ts` (detached, per-run queue, group kill, up-wait, preconditions)
- [x] T007 `adapters/g/gates.ts` + fake-handle unit tests
- [x] T008 `adapters/g/index.ts` (`run`, cancel after last requested stage, `version`); registered as `G`
- [x] T009 Opt-in `tests/g.e2e.test.ts` + `test:g` script; README; D13 row
- [x] T010 `npm run build && npm test` green (e2e skipped by default)

## Verification record (orchestrator, 2026-11-05, stub reasoning, temporal-dev)

- `BENCH_G_TEAM=default bench run --contender G --ticket T01 --rep 1 --stages triage..open_pr`:
  completed, 6 stage records; 1 `scripted_approval` intervention (design#1); every
  record `interventions: 0`, `assisted: false`; 0 `worker.ts` processes afterwards.
- `--stages triage..route`: 2 records; workflow status `CANCELED` per `temporal workflow describe`.
- `--stages design..plan` and `triage..review`: fail with the one-line R1 errors.
- Found and fixed: gate-outcome lines leaked `no_model_call` into triage/route gaps (fix-up dispatch).
- `npm run build` ok; `npm test` 69 passed + 1 skipped; `npm run test:g` 1 passed.
- Not G's bug, noted: two `bench run`s of the same ticket/rep within one minute collide on
  `runs.run_id` (TASK-0013's minute-resolution run id).
