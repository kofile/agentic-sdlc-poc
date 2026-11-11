# Stage contracts

Each stage's input/output schema (zod, `src/core/schemas.ts`) and whether it has a gate.
Stage names and the ladder (triage -> route -> design -> plan -> execute -> open-pr) follow
`sdlc-pipeline-plugin/skills/pipeline-conventions/SKILL.md`.

## triage

- **Input:** `Ticket` (`id`, `title`, `description`, `component?`, `labels[]`).
- **Output:** `TriageOutputSchema` — `{ grade: 'A'|'B'|'C'|'D', reason: string, story_points?: number, issues: string[] }`.
- **Gate:** code gate, `triageGate()` in `src/core/gates.ts` — A/B pass, C/D stop with
  `reason`. Never delegated to the LLM; this is the one C5 constraint ("the LLM is never
  trusted for deterministic decisions") made concrete.
- **On fail:** workflow returns `{ status: 'stopped-at-triage', grade, reason }` and transitions
  the ticket to `Waiting for Info`.

## Pre-loaded context (route, design, plan)

Spec 010. The activities assemble context through the `ContextSource` port
(`src/ports/context.ts`, file adapter `src/adapters/file-context.ts`, config
`config/context.json`) and the pure functions in `src/core/context.ts`; file contents stay in
the activity and never enter Temporal history. Absences are recorded as `telemetry_gaps`
(`context:catalog-absent`, `context:spec-wiki-absent:<repo>`, `context:checkout-absent:<repo>`,
plus cap and canary gaps) and are also passed to the model as `gaps`. Each assembled context
adds an artifact ref `context:<12 hex of sha256>` to the stage record.

## route

- **Input:** `{ ticket, catalog, gaps }` (`catalog` is the repository catalog markdown, or null).
- **Output:** `RouteOutputSchema` — `{ repos: [{name, role, confidence}], order: string[] }`.
- **Gate:** code gate, `routeGate()` — fails on zero repos, or if `order` references a repo not
  in `repos`.
- **On fail:** workflow returns `{ status: 'stopped-at-route', reason }`.

## design

- **Input:** `{ ticket, feedback, round, context: { repos: [{ name, spec_wiki, tree, files }] }, gaps }`
  for the repos route chose (route `order`); the activity takes those names as a trailing `repos` argument.
- **Output:** `DesignOutputSchema` — `{ summary, approach, interfaces[], risks[], round }`.
  Upserted to Docs as `"{ticket.id} — Architecture Design"` (em dash, not hyphen — one page
  per ticket per artifact, re-runs bump the version).
- **Gate:** `design`, policy-driven (`teams/*.json`), human or auto. Reject carries feedback
  back into the next round (`for (;;)` loop in `workflows.ts`, bounded by
  `policy.maxRejectRounds`). Durable timeout per `policy.humanTimeoutSec` and
  `policy.onTimeout` (`auto-reject` loops as a reject with no feedback-use;
  `escalate` ends the run as `escalated-timeout` and comments the ticket).

## plan

- **Input:** `{ ticket, design, context: { repos: [...] }, gaps }`, same repos as design.
- **Output:** `PlanOutputSchema` — `{ tasks: [{id, title, files[], new_files[], steps[]}], base_sha? }`, at
  least one task with at least one step. Upserted to Docs as
  `"{ticket.id} — Implementation Plan"`.
- **Path gate:** code gate, `planPathGate()` in `src/core/gates.ts`, run by the plan activity
  after a valid output (result `pathGate: { pass, reason }`). Every `files` path must exist in its
  repo's tree or be in that task's `new_files`; `new_files` must not already exist; with several
  repos every path is prefixed `<repo>/`; a missing checkout fails closed. The workflow records
  it as `Plan paths exist?` and on fail transitions the ticket to `Waiting for Info` and returns
  `{ status: 'stopped-at-plan-paths', reason, log }`. Behind `patched('context-preload-v1')`.
- **Gate:** `plan`, policy-driven, one round (no reject-loop back into design in this
  skeleton — a reject at `plan` ends the run as `rejected` or `escalated-timeout`, it does not
  re-run `design`).

## execute

- **Input:** `Ticket`, `PlanOutput`, `budgetSeconds`.
- **Output:** `{ branch, commit, jobId, state }` (not zod-schema'd — this is the one agentic
  stage, driven by `ExecuteHost`, not a typed-function LLM call).
- **Gate:** none (code-only orchestration: start the job, poll to a terminal state, collect the
  result). Heartbeats throughout so a killed worker is detected within the activity's
  `heartbeatTimeout`, not its `startToCloseTimeout`.

## open-pr

- **Input:** `Ticket`, the `execute` result.
- **Output:** `{ number, url }` from the Vcs port.
- **Gate:** none. Comments the PR link on the ticket and transitions it to `Ready for PR`.

## Invalid output (all model stages)

Applies to triage, route, design and plan, the four typed-function LLM calls.

- **Trigger:** the Reasoning adapter ends a call without schema-valid output and throws
  `ReasoningOutputInvalid` (`kind`: `schema_invalid` after the retry bound, `refusal`, or
  `max_tokens`). Transport errors are not this case: they stay retryable under the activity's
  retry policy.
- **Activity side:** `callModelStage` records the stage (`status: failed`,
  `output.schema_valid: false`, `failure_label` = the kind, tokens from the error's usage), then
  throws `ApplicationFailure.nonRetryable(msg, 'ReasoningOutputInvalid', { stage, kind })` so
  Temporal does not retry it.
- **Workflow side:** `modelStage` in `workflows.ts` catches that failure, records a gate outcome
  `Output valid?` = `fail` for the stage, transitions the ticket to `Waiting for Info`, and
  returns `{ status: 'stopped-invalid-output', at: <stage>, reason, log }`. No later stage runs.
- **Never** falls back to another model or to unvalidated output.

## Stub-backed stages are not real model runs

`StubReasoning` reports `model_served: stub` (`NO_MODEL_SERVED` in `ports/reasoning.ts`) on
success and on `ReasoningOutputInvalid` usage; `model_requested` still records what the activity
asked for. `recordStage` (via `costAndGaps` in `core/telemetry.ts`) never prices such a stage:
`cost_usd.tokens` is `0` and `telemetry_gaps` carries `no_real_model` and `cost_not_measured`,
with no `price_fallback:stub`. Real adapters are priced on `model_served` as before.
