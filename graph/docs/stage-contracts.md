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

## route

- **Input:** `Ticket`.
- **Output:** `RouteOutputSchema` — `{ repos: [{name, role, confidence}], order: string[] }`.
- **Gate:** code gate, `routeGate()` — fails on zero repos, or if `order` references a repo not
  in `repos`.
- **On fail:** workflow returns `{ status: 'stopped-at-route', reason }`.

## design

- **Input:** `Ticket`, `feedback: string | null` (from a prior reject), `round: number`.
- **Output:** `DesignOutputSchema` — `{ summary, approach, interfaces[], risks[], round }`.
  Upserted to Docs as `"{ticket.id} — Architecture Design"` (em dash, not hyphen — one page
  per ticket per artifact, re-runs bump the version).
- **Gate:** `design`, policy-driven (`teams/*.json`), human or auto. Reject carries feedback
  back into the next round (`for (;;)` loop in `workflows.ts`, bounded by
  `policy.maxRejectRounds`). Durable timeout per `policy.humanTimeoutSec` and
  `policy.onTimeout` (`auto-reject` loops as a reject with no feedback-use;
  `escalate` ends the run as `escalated-timeout` and comments the ticket).

## plan

- **Input:** `Ticket`, `DesignOutput`.
- **Output:** `PlanOutputSchema` — `{ tasks: [{id, title, files[], steps[]}], base_sha? }`, at
  least one task with at least one step. Upserted to Docs as
  `"{ticket.id} — Implementation Plan"`.
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
