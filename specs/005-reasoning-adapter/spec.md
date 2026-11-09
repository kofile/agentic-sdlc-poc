# Spec 005 — real Reasoning adapter (TASK-0022)

Implements: TASK-0022; decisions D1 (G pinned to Sonnet 5.5), D4 (G uses a dedicated API
key), runbook ruling C3 (Anthropic API via the TypeScript SDK, recorded here as **D12**) and
C4 (no live model call in this task: fixtures only). Contract: `graph/docs/stage-contracts.md`.

## Problem

`graph/` runs triage, route, design and plan through `StubReasoning`. The benchmark needs a
real model behind the `Reasoning` port (`graph/src/ports/reasoning.ts`) that keeps the port's
promise — typed, zod-validated output; the model never decides control flow — and records
what actually served each call and what it cost. Today cost is computed on
`modelRequested` (`graph/src/workflow/activities.ts:29`), ignores cache prices
(`estimateCostUsd` in `graph/src/core/telemetry.ts`), and `MODEL_REQUESTED` is
`claude-sonnet-5`, not the D1 pin. A stage whose output never validates makes the activity
throw and Temporal retry it, then the workflow fails as an error rather than stopping at a
gate.

## Requirements

- **R1 (AC #1)** A new `AnthropicReasoning` adapter implements `Reasoning` with the Anthropic
  TypeScript SDK (`@anthropic-ai/sdk`). Each call sends the stage's versioned prompt file
  plus the JSON payload, asks for JSON output via structured outputs
  (`output_config.format`, type `json_schema`), parses the first text block, and validates
  it with the request's zod schema. A parse or validation failure is retried up to
  `maxRetries` (default 2 extra attempts); every attempt counts in `llm_calls` and in usage.
  The adapter never returns unvalidated output.
- **R2 (AC #1)** Requested model for every model stage is `claude-sonnet-5-5` (D1). No
  server-side `fallbacks`: a fallback would serve a different model than the benchmark pins;
  a refusal instead fails closed (R4) and is recorded. Thinking/effort are set explicitly so
  the configuration is frozen with the code (see plan). No `temperature`/`top_p`/`top_k`.
- **R3 (AC #1)** Prompts live as files under `graph/prompts/<stage>.md` (triage, route,
  design, plan). The adapter records the prompt version (first 12 hex chars of the file's
  sha256) per call, so TASK-0029 can freeze G by tag.
- **R4 (AC #2)** Fail closed. When output never validates after the retry bound, or the
  response ends with `stop_reason` `refusal` or `max_tokens`, the adapter throws a typed
  `ReasoningOutputInvalid` error. The activity records the stage with `status: 'failed'`,
  `output.schema_valid: false`, `failure_label: 'schema_invalid'` (or `'refusal'` /
  `'max_tokens'`), and surfaces it to the workflow as a **non-retryable** failure. The
  workflow records a failed gate outcome for the stage, transitions the ticket to
  `Waiting for Info`, and returns `{ status: 'stopped-invalid-output', at: <stage>, reason }`.
  It never advances to the next stage and never retries an invalid-output activity.
  API/transport errors (429, 5xx, network) are NOT invalid output: they stay retryable
  through the existing activity retry policy.
- **R5 (AC #3)** Served model and token usage per step. `ReasoningUsage` gains
  `cache_read_tokens`, `cache_write_tokens` and `source: 'reported' | 'estimated'`.
  `model_served` comes from the response's `model` field, never from config. Usage is summed
  over every attempt of a call. The stage-run record carries input, output, cache_read and
  cache_write tokens, `tokens.source` from the adapter (`reported` for the real adapter,
  `estimated` for the stub), `model_requested` and `model_served`.
- **R6 (AC #3)** Cost is computed on **`model_served`**, including cache-read and
  cache-write prices from `graph/config/prices.json`. When the served model has no price
  entry and the `default` entry is used, the record's `telemetry_gaps` gains
  `price_fallback:<model>` (no silent defaults — same principle as harness spec R3a).
- **R7** Adapter selection is configuration: `GRAPH_REASONING=anthropic` wires
  `AnthropicReasoning` in `graph/src/workflow/container.ts`; unset or `stub` keeps
  `StubReasoning`, so unit, workflow and integration tests need no key. The API key is read
  from the file named by `ANTHROPIC_API_KEY_FILE` (CLAUDE.md: secrets by file mount), only
  when the adapter is constructed; it is never logged, written, or placed in an error
  message. Missing file with `GRAPH_REASONING=anthropic` → the worker fails at startup with
  a one-line error naming the env var, not the value.
- **R8 (AC #4)** Tests run against fixtures — no network. The adapter takes an injectable
  client (the `messages.create` call), so unit tests drive it with canned responses under
  `graph/tests/fixtures/anthropic/`. Fixtures are **synthetic** (hand-written in the API's
  response shape, labelled as such in a README), because no live call is allowed before C4;
  they contain no request headers and no key. Cases: valid output per stage; served model
  differing from requested (recorded as served); invalid JSON then valid (retry, summed
  usage); invalid on every attempt (typed failure); `refusal`; `max_tokens`; cache usage
  fields present; a transport error is rethrown as retryable, not as invalid output.
- **R9 (AC #4)** `StubReasoning` throws the same `ReasoningOutputInvalid` after its retry
  bound, and reports `source: 'estimated'`. Workflow tests cover the fail-closed path for at
  least triage and design: the run ends `stopped-invalid-output`, no later stage runs, the
  ticket is transitioned. `npm run build`, `npm test`, `npm run test:workflow`,
  `npm run test:versioning` and `npm run test:integration` pass.
- **R10** `graph/docs/stage-contracts.md` documents the invalid-output outcome;
  `notes/00-discovery-log.md` section 7 gets **D12** (Reasoning transport: Anthropic API via
  the TypeScript SDK, with the three-way grade and this spec as evidence);
  `notes/HANDOFF.md` next steps reflect that the real adapter exists and the live smoke call
  (C4) is pending.

## Constraints

- Footprint (runbook): `graph/src/adapters/`, `graph/src/ports/reasoning.ts`,
  `graph/src/ports/config.ts`, `graph/src/core/`, `graph/src/workflow/`, `graph/tests/unit/`,
  `graph/tests/workflow/`, `graph/tests/fixtures/`, new `graph/prompts/`,
  `graph/package.json` + lockfile, `graph/docs/stage-contracts.md`,
  `notes/00-discovery-log.md` (D12 row only), `notes/HANDOFF.md`.
- Exact dependency versions, lockfile committed, Node 22.
- No live model call. No key, token or Keychain value in any file, log, fixture or test.
- Benchmark integrity, verbatim from CLAUDE.md: "When working on `graph/` or any contender
  code, do not read `bench/hidden-tests/`, `bench/tickets/expected.draft.yaml` or
  `bench/*/reference.diff`."

## Out of scope

The live smoke call (C4), prompt quality tuning, the execute stage's agent, streaming, and
the bench-side G adapter (TASK-0018).
