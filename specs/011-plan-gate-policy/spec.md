# Spec 011 — plan gate policy (TASK-0051)

**Board:** TASK-0051 · **Runbook:** `docs/design/follow-ups-runbook.md` (Lane 2, amendment A2;
the approach is settled there) · Merges before TASK-0046.

## Problem

`workflows.ts` calls `gate('plan', 1)`, which reads `policy.gates['plan']`, but
`graph/teams/{auto,default,strict}.json` define only `design` and `merge`. So the plan gate is
always auto for every team, while the README and `docs/stage-contracts.md` describe it as
policy-driven. `merge` has no stage in the PoC (`open-pr` is the last stage).

## Requirements

- **R1 (AC #1)** Every `graph/teams/*.json` names `plan` explicitly: `auto.json` → `"auto"`,
  `default.json` → `"human"`, `strict.json` → `"human"`. No other value in those files changes.
- **R2 (AC #3)** `merge` stays in the team files, documented as reserved for a merge stage
  outside the PoC: no workflow code reads it today. Documented in `graph/README.md` (replace
  the "What I could not finish" bullet about `merge` with an accurate statement, and list
  `plan` among the policy-driven gates wherever the README describes gates) and in
  `graph/docs/stage-contracts.md` (a short "Gate policy keys" note: `design` and `plan` are
  read by the workflow; `merge` is reserved).
- **R3 (AC #2)** A workflow test proves that, under the **default** team policy as committed in
  `graph/teams/default.json` (load the file and parse it with `GatePolicySchema`, so the
  test breaks if the file regresses), the run:
  1. waits at the `plan` gate after design is approved (query `state` shows
     `waiting: { gate: 'plan', round: 1 }`),
  2. does not reach `execute` or open a PR while waiting,
  3. continues to `opened-pr` once a `decide` signal `{ gate: 'plan', round: 1, approved: true }`
     arrives.

  A second case: a rejecting `decide` at the plan gate ends the run as `rejected` at `plan`.
  Use a short `humanTimeoutSec` override in the test only if the file's value would make the
  test slow; the gate mode must still come from the file.
- **R4** A unit test asserts each committed team file parses with `GatePolicySchema` and has
  the R1 `plan` value.

## Constraints

- Footprint (runbook): `graph/teams/`, `graph/tests/workflow/`, `graph/tests/unit/`,
  `graph/README.md`, `graph/docs/stage-contracts.md`, this spec dir. No workflow or core code
  change. (`GateNameSchema` in `src/core/gates.ts` lacks `plan` but is unused; out of scope,
  noted for the refactor triage.)
- Existing workflow tests use inline policies and must stay green; integration uses `auto`.
- The bench harness's G adapter (`bench/harness/src/adapters/g/`) scripts approvals for
  waiting gates; the implementer checks, read-only, that it handles a waiting `plan` gate for
  `default`/`strict` and reports. A gap there is a follow-up, not part of this task.
- No new dependencies, no network, no git writes by implementers. Do not read
  `bench/hidden-tests/`, `bench/tickets/` or any `reference.diff`.
