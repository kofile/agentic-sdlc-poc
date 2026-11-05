# Tasks 006 — G adapter

## Phase 1: Contract extension and pure pieces

- [ ] T001 `adapters/types.ts`: `InterventionEvent`, `AdapterEvent`; `core/run.ts` writes intervention events; test
- [ ] T002 `adapters/g/ticket.ts`, `stages.ts`, `paths.ts` + unit tests
- [ ] T003 `adapters/g/telemetry.ts` (read + map, design-round merge, gate fold, stop handling, invalid-output mapping) + fixture JSONL tests
- [ ] T004 `npm run build && npm test` green

## Phase 2: Worker, gates, adapter and registration

- [ ] T005 Add `@temporalio/client` 1.25.0 exact; lockfile
- [ ] T006 `adapters/g/worker.ts` (detached, per-run queue, group kill, up-wait, preconditions)
- [ ] T007 `adapters/g/gates.ts` + fake-handle unit tests
- [ ] T008 `adapters/g/index.ts` (`run`, cancel after last requested stage, `version`); registered as `G`
- [ ] T009 Opt-in `tests/g.e2e.test.ts` + `test:g` script; README; D13 row
- [ ] T010 `npm run build && npm test` green (e2e skipped by default)
