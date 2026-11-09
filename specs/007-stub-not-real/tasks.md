# Tasks 007 — stub runs must not look real

## Phase 1: Graph reports stub honestly

- [x] T001 `NO_MODEL_SERVED` in `ports/reasoning.ts`; stub reports it on success and error paths
- [x] T002 `costAndGaps` helper used by `recordStage`: no pricing for stub, `no_real_model` + `cost_not_measured` gaps
- [x] T003 Unit tests; `docs/stage-contracts.md` paragraph; build, unit, workflow, versioning green

## Phase 2: Harness refuses or labels stub-backed G runs

- [x] T004 G adapter stub policy (`BENCH_G_ALLOW_STUB`) and gap guarantee
- [x] T005 `report` excludes runs with `no_real_model` unless `--include-stub`
- [x] T006 Unit tests; e2e updated for opt-in and stub fields; README; build and test green

## Verification record (orchestrator, 2026-11-09, temporal-dev)

- graph: build ok; unit 61; workflow 12; versioning 1; integration ALL PASS.
- harness: build ok; 73 passed + 1 skipped; `test:g` 1 passed (asserts `model_served: stub`, cost 0, `no_real_model`).
- `bench run --contender G` with `GRAPH_REASONING` unset and no opt-in: refused with
  `G: stub reasoning (GRAPH_REASONING=unset) needs BENCH_G_ALLOW_STUB=1; stub runs are not benchmark runs`.
- With `BENCH_G_ALLOW_STUB=1`: triage/route records show `model_requested: claude-sonnet-5-5`,
  `model_served: stub`, cost 0, gaps `no_real_model`, `cost_not_measured`.
  `bench report` → `[]`; `bench report --include-stub` → the run appears with cost 0.
- 0 node `worker.ts` processes afterwards.
