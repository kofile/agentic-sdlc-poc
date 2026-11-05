# Tasks 003 — bench CLI skeleton

## Phase 1: Package, schema and store

- [x] T001 Scaffold `bench/harness/` (package.json with exact versions, tsconfig, lockfile via `npm install`)
- [x] T002 `src/record.ts`: zod stage-run record matching spec section 7, stage enum and range parser, contender enum incl. `stub`
- [x] T003 `src/run-id.ts` and `src/store.ts` (node:sqlite; four tables; idempotent schema; validated insert)
- [x] T004 `tests/record.test.ts` and `tests/store.test.ts` green

## Phase 2: Adapter contract, stub and run command

- [x] T005 `src/adapters/types.ts`, `registry.ts`, `stub.ts` (writes `artifacts/<run_id>/stub.txt`)
- [x] T006 `src/core/run.ts` (normalise → validate → store; invalid record fails the run)
- [x] T007 `src/cli.ts` `run` subcommand with argument validation and one-line errors

## Phase 3: Report, export and end-to-end

- [ ] T007a Spec R3a: core stops defaulting `telemetry_gaps` (missing → validation failure) and appends `defaulted:<field>` for every measurement field it defaults; tests for both
- [ ] T008 `src/report.ts` (md/json, SQLite only, stub excluded unless `--include-stub`) and `src/export.ts` (JSONL)
- [ ] T009 `tests/report.test.ts` and `tests/cli.e2e.test.ts` green
- [ ] T010 `npm run build && npm test` green; short `bench/harness/README.md` (usage, env vars, what is out of scope)
