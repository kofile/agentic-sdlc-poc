# Plan 005 — real Reasoning adapter

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md`, `notes/00-discovery-log.md` (D1, D4,
D12 from runbook ruling C3), `graph/docs/stage-contracts.md` and the runbook's per-PR gates.

## Settled choices (the implementer does not reopen these)

| Choice | Ruling | Why |
|---|---|---|
| Transport | `@anthropic-ai/sdk` **1.1.0** exact (released 2026-10-21) | C3/D12. Oldest 1.x release more than two weeks old. |
| zod peer | The SDK declares an optional `zod` peer `^3.25.0 \|\| ^4.0.0`. If installing it with zod 3.24.1 raises a peer conflict, bump `zod` to **3.25.76** exactly (a v3-API release). Never use `--legacy-peer-deps` or `--force`. | Keeps the lockfile honest. |
| JSON output | `client.messages.create` with `output_config: { format: { type: 'json_schema', schema } }`. **No forced `tool_choice`**: Sonnet 5.5 rejects `any`/`tool` with a 400. No `zodOutputFormat` helper. | The SDK's zod helper targets newer zod; our zod schemas remain the validator. |
| JSON schemas | Hand-written per stage in `src/adapters/anthropic-schemas.ts`, each with `additionalProperties: false` and `required` listing every non-optional key. A unit test checks each JSON schema's `properties`/`required` keys against the zod schema's `shape`, so the two cannot drift silently. | zod 3 has no JSON-schema export. |
| Model | `claude-sonnet-5-5` (D1), one constant `MODEL_REQUESTED` in `activities.ts` | Fixes today's `claude-sonnet-5`. |
| Thinking / effort | Omit `thinking` (Sonnet 5.5 runs adaptive by default). Set `output_config.effort: 'high'` explicitly, which is the model's default, so the setting is frozen in code. | Explicit beats default for a frozen contender. |
| `max_tokens` | 16000, non-streaming | Stage outputs are small JSON. |
| Sampling params | none (`temperature`/`top_p`/`top_k` 400 on current models) | |
| Fallbacks | none | The benchmark pins the model; a refusal is a recorded fail-closed outcome. |
| Prompt | system = contents of `graph/prompts/<stage>.md`; user = the existing JSON payload string (`req.prompt`). Prompt version = sha256(file)[0:12]. | |

## Changes by file

- `src/ports/reasoning.ts`: `ReasoningUsage` gains `cache_read_tokens: number`,
  `cache_write_tokens: number` and `source: 'reported' | 'estimated'`. `ReasoningCallResult`
  gains `prompt_version?: string`. Add `class ReasoningOutputInvalid extends Error` with
  `stage`, `kind: 'schema_invalid' | 'refusal' | 'max_tokens'`, `attempts`, and the usage
  accumulated so far. Keep the existing doc comment's promise.
- `src/adapters/anthropic-reasoning.ts` (new): `AnthropicReasoning implements Reasoning`.
  The constructor takes `{ client: Pick<Anthropic['messages'], 'create'>, promptsDir }`.
  `fromEnv()` reads `ANTHROPIC_API_KEY_FILE`, constructs `new Anthropic({ apiKey })`, and
  throws a one-line error naming the env var if the file is missing. Loop: call → check
  `stop_reason` (`refusal` / `max_tokens` → throw `ReasoningOutputInvalid` with that kind,
  no retry) → take the first `text` block → `JSON.parse` → `schema.safeParse`. A failure
  retries up to `maxRetries`, then throws `ReasoningOutputInvalid('schema_invalid')`. Usage
  is summed across attempts: `input_tokens`, `output_tokens`, `cache_read_input_tokens ?? 0`,
  `cache_creation_input_tokens ?? 0`. `model_served` = `response.model` of the final
  attempt; if attempts disagree, keep the last one and note it in the error/result. SDK
  errors (`Anthropic.APIError` and connection errors) are rethrown unchanged, so they stay
  retryable.
- `src/adapters/anthropic-schemas.ts` (new): the four JSON schemas plus `STAGE_JSON_SCHEMAS`.
- `src/adapters/stub-reasoning.ts`: throw `ReasoningOutputInvalid('schema_invalid')` after
  the bound; usage gets `cache_read_tokens: 0, cache_write_tokens: 0, source: 'estimated'`.
- `src/core/telemetry.ts`: `PriceEntry` gains `cache_read_per_1k` and `cache_write_per_1k`
  and drops the `UNVERIFIED` field, which prices.json no longer carries (TASK-0019).
  `estimateCostUsd(prices, model, { input, output, cache_read, cache_write })` returns
  `{ usd, priceKey }`, where `priceKey` is the model or `'default'` (`{ usd: 0, priceKey: null }`
  when neither exists). Update the callers in `tests/unit/telemetry.test.ts` and
  `tests/unit/prices.test.ts`. The existing expected value 0.09258 must still hold for
  input/output-only usage.
- `src/ports/config.ts`: `loadPriceTable(): Promise<PriceTable>` (import the type).
- `src/workflow/activities.ts`: `MODEL_REQUESTED = 'claude-sonnet-5-5'`. `recordStage` takes
  the full token set and `tokensSource`, and computes cost on **`modelServed`**. It adds
  `price_fallback:<model>` to `telemetry_gaps` when `priceKey === 'default'`, puts
  `prompt:<stage>@<version>` in `artifact_refs` when a prompt version exists, and takes
  optional `failureLabel`. Add a shared `callModelStage` helper so the four stage functions
  stop duplicating the record/return block. On `ReasoningOutputInvalid`: record the stage
  (`status: 'failed'`, `schemaValid: false`, `failure_label: err.kind`, tokens from
  `err.usage`), then throw
  `ApplicationFailure.nonRetryable(message, 'ReasoningOutputInvalid', { stage, kind })` from
  `@temporalio/common` (already a transitive dependency of `@temporalio/activity`; if it is
  not resolvable directly, add it at 1.25.0 exact). `StageCallResult.usage` carries
  cache_read/cache_write too.
- `src/workflow/workflows.ts`: a small `modelStage(stage, fn)` helper wraps each
  `model.triage/route/design/plan` call. It catches an `ActivityFailure` whose `cause` is an
  `ApplicationFailure` of type `ReasoningOutputInvalid`, records the gate outcome
  (`recordGateOutcome(runId, ticketId, stage, 'Output valid?', 'fail', reason)`), transitions
  the ticket to `Waiting for Info`, and returns
  `{ status: 'stopped-invalid-output', at: stage, reason, log }`. It rethrows anything else.
  Add that variant to `PipelineResult`. **Versioning:** the change only alters histories
  that previously failed the workflow, which are closed, so it needs no `patched()`. Record
  this in tasks.md; `npm run test:versioning` must stay green.
- `src/workflow/container.ts`: `reasoning` = `GRAPH_REASONING === 'anthropic' ?
  AnthropicReasoning.fromEnv(...) : new StubReasoning()`. Any other value throws at startup.
- `prompts/{triage,route,design,plan}.md` (new): concise system prompts stating the stage's
  job, the input payload's fields, and that the reply is JSON matching the schema. Describe
  the triage grades A–D as in `stage-contracts.md`. No ticket-specific content.
- `tests/fixtures/anthropic/` (new): synthetic Messages API responses (`id`, `type`, `role`,
  `model`, `content: [{type:'text', text}]`, `stop_reason`, `usage`), a `README.md` saying
  they are synthetic and contain no headers or keys.
- `tests/unit/anthropic-reasoning.test.ts` (new): the R8 cases via a fake `create`.
- `tests/unit/anthropic-schemas.test.ts` (new): the drift guard.
- `tests/unit/stub-reasoning.test.ts`, `tests/unit/telemetry.test.ts`, `tests/unit/prices.test.ts`:
  updated for the new types and error.
- `tests/workflow/`: `helpers.ts` gains a per-stage "invalid output" knob that makes the
  mock activity throw `ApplicationFailure.nonRetryable(..., 'ReasoningOutputInvalid')`. New
  `invalid-output.test.ts` covers triage and design: status `stopped-invalid-output`, no
  later stage called, ticket transitioned to `Waiting for Info`, and a failed gate outcome
  recorded.
- `docs/stage-contracts.md`: an "Invalid output (all model stages)" section.
- `notes/00-discovery-log.md` §7: row D12. `notes/HANDOFF.md`: next steps.

## Verification (orchestrator re-runs)

`npm ci`, `npm run build`, `npm test`, `npm run test:workflow`, `npm run test:versioning`,
and `npm run test:integration` (after killing stray `worker.ts` processes). Also: a canary
grep on the diff, a grep confirming no key-like strings in fixtures, and
`GRAPH_REASONING=anthropic` with no key file failing with the one-line error.
