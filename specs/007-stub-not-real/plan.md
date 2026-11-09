# Plan 007 — stub runs must not look real

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md`, specs 003/005/006 and the runbook (A2).

## Phase 1 — graph side

- `src/ports/reasoning.ts`: add `export const NO_MODEL_SERVED = 'stub';` with a one-line
  comment ("model_served value for adapters that call no model").
- `src/adapters/stub-reasoning.ts`: `fakeUsage` sets `model_served: NO_MODEL_SERVED`.
- `src/workflow/activities.ts` `recordStage`: before pricing,
  `if (args.modelServed === NO_MODEL_SERVED) { gaps.push('no_real_model', 'cost_not_measured'); }`
  and price only when `pricedModel && args.modelServed !== NO_MODEL_SERVED`.
- Tests: `tests/unit/stub-reasoning.test.ts` asserts `model_served === 'stub'` (success and
  error paths). Add an activities-level unit test only if `recordStage` can be exercised
  without Temporal; otherwise cover R2 with a small exported pure helper
  `costAndGaps(prices, modelRequested, modelServed, tokens)` used by `recordStage` and tested
  directly. Prefer the helper.
- `docs/stage-contracts.md`: one short paragraph.

## Phase 2 — harness side

- `src/adapters/g/index.ts`: at the start of `run`, the stub check from R3 throws
  `G: stub reasoning (GRAPH_REASONING=<value or unset>) needs BENCH_G_ALLOW_STUB=1; stub runs
  are not benchmark runs`. After `toStageEvents`, ensure `no_real_model` is in
  `telemetry_gaps` for any event with `model_served === 'stub'` (const `STUB_MODEL_SERVED`,
  commented as restating graph's `NO_MODEL_SERVED`).
- `src/report.ts`: compute the set of run_ids that have any stage record whose gaps include
  `no_real_model`, and skip those runs unless `includeStub`. Keep the existing contender-stub
  rule.
- Tests: unit tests for the refusal (env without opt-in → the run fails with the message; use
  the adapter with injected env if the code allows, or test a small exported
  `checkStubPolicy(env)`), the gap guarantee, and report exclusion/inclusion. Update
  `tests/g.e2e.test.ts` to set `BENCH_G_ALLOW_STUB=1` and assert R5's stub fields.
- README: env var and report rule.

## Verification (orchestrator re-runs)

graph: build, unit, workflow, versioning, integration. harness: build, test, `test:g`.
Real run without opt-in → refused. With opt-in → records show `model_served: stub`, cost 0,
the `no_real_model` gap, and `bench report` omits the run (shown with `--include-stub`).
Canary grep on the diff.
