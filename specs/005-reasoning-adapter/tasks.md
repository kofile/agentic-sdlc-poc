# Tasks 005 — real Reasoning adapter

## Phase 1: Port, cost and telemetry

- [x] T001 `ports/reasoning.ts`: usage cache fields + `source`, `prompt_version`, `ReasoningOutputInvalid`
- [x] T002 `core/telemetry.ts`: `PriceEntry` with cache prices, `estimateCostUsd` over all four token kinds returning `{ usd, priceKey }`; `ports/config.ts` typed
- [x] T003 `adapters/stub-reasoning.ts`: typed error after the bound; `source: 'estimated'`, zero cache tokens
- [x] T004 Unit tests updated (telemetry, prices, stub-reasoning) and green; `npm run build` green

## Phase 2: Anthropic adapter, prompts and fixtures

- [x] T005 Add `@anthropic-ai/sdk` 1.1.0 exact (zod 3.25.76 only if the peer conflict appears); lockfile
- [x] T006 `adapters/anthropic-schemas.ts` + drift-guard test
- [x] T007 `adapters/anthropic-reasoning.ts` (injectable client, `fromEnv`, stop-reason checks, retries, summed usage, served model from response)
- [x] T008 `prompts/{triage,route,design,plan}.md`
- [x] T009 Synthetic fixtures + README; `tests/unit/anthropic-reasoning.test.ts` covering every R8 case; green

## Phase 3: Wiring, fail-closed workflow and docs

- [x] T010 `activities.ts`: `MODEL_REQUESTED = 'claude-sonnet-5-5'`, `callModelStage`, cost on served model, price-fallback gap, prompt ref, non-retryable `ReasoningOutputInvalid`
- [x] T011 `workflows.ts`: `modelStage` wrapper → `stopped-invalid-output`; `PipelineResult` variant; no `patched()` (closed histories only)
- [x] T012 `container.ts`: `GRAPH_REASONING` selection
- [x] T013 Workflow tests: helpers knob + `invalid-output.test.ts`; all workflow tests green
- [x] T014 `docs/stage-contracts.md`, D12 row in `notes/00-discovery-log.md`, `notes/HANDOFF.md`
- [x] T015 `npm run build && npm test && npm run test:workflow && npm run test:versioning` green

**Versioning note:** no `patched()` is needed. The `stopped-invalid-output` path only changes behavior for histories where a model activity failed with a non-retryable error, which previously failed the workflow (a closed history). Open histories never hit that branch, and `npm run test:versioning` stays green.
