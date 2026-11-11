# Tasks 010 — pre-loaded context

## Phase 1: Context port, adapter and assembly

- [x] T001 `ContextSource` port and `FileContextSource` adapter with `config/context.json` and the integrity guard (R1–R3)
- [x] T002 Pure assembly in `src/core/context.ts`: keywords, paths, file selection, caps, gaps (R4–R5)
- [x] T003 Fixture checkout and unit tests; build and unit green

## Phase 2: Plan schema and path gate

- [x] T004 `new_files` in `PlanTaskSchema` and the Anthropic JSON schema mirror (R7)
- [x] T005 `planPathGate` in `src/core/gates.ts` (R8)
- [x] T006 Unit tests for schema parity and the gate; build and unit green

## Phase 3: Wiring, prompts and docs

- [ ] T007 Activities assemble context; route/design/plan payloads per R6; context gaps and ref in telemetry
- [ ] T008 Workflow plan-path gate and `stopped-at-plan-paths` behind `patched('context-preload-v1')` (R9)
- [ ] T009 Prompts and `stage-contracts.md` updated; stub and fixtures pass the gate (R10–R11)
- [ ] T010 build, unit, workflow, versioning, integration green

## Deviations

- Phase 1: the port gains `readFilesDetailed(repo, paths) -> { files, gaps }` beside the spec'd `readFiles`, because the canary gap (R3) has to reach the caller and `readFiles` returns only files. `readFiles` delegates to it.
- Phase 1: `buildRepoContext` takes already-read files (selection via `selectFiles` happens first, then the adapter reads) and returns `{ context, gaps }`; helpers `catalogGaps` and `contextRef` live in `src/core/context.ts`. The walk also skips any path inside `bench/hidden-tests` or `bench/tickets` (same guard as construction).
