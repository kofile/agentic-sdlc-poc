# Tasks 007 — stub runs must not look real

## Phase 1: Graph reports stub honestly

- [ ] T001 `NO_MODEL_SERVED` in `ports/reasoning.ts`; stub reports it on success and error paths
- [ ] T002 `costAndGaps` helper used by `recordStage`: no pricing for stub, `no_real_model` + `cost_not_measured` gaps
- [ ] T003 Unit tests; `docs/stage-contracts.md` paragraph; build, unit, workflow, versioning green

## Phase 2: Harness refuses or labels stub-backed G runs

- [ ] T004 G adapter stub policy (`BENCH_G_ALLOW_STUB`) and gap guarantee
- [ ] T005 `report` excludes runs with `no_real_model` unless `--include-stub`
- [ ] T006 Unit tests; e2e updated for opt-in and stub fields; README; build and test green
