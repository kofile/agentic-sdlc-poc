# Plan 011 — plan gate policy

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned against the runbook's amendment A2 (approach settled there), K5/K6 in
the discovery log, `graph/README.md` and `graph/docs/stage-contracts.md`.

## Phase 1 — policy files, docs, tests (sonnet, one dispatch)

One small phase: the files are few and the work is tightly coupled (the test reads the file
it changes).

1. Add `plan` to the three team files (R1).
2. README and stage-contracts edits (R2).
3. Unit test over the committed team files (R4).
4. Workflow test `tests/workflow/plan-gate-human.test.ts` (R3), following the pattern of
   `tests/workflow/reject-loop.test.ts` and `duplicate-stale-approval.test.ts` (signal
   `decide`, query `state`), with the policy loaded from `teams/default.json`.
5. Read-only check of `bench/harness/src/adapters/g/` for plan-gate approval handling; report.

Gates (orchestrator re-runs, own `npm ci`): `npm run build`, `npm test`,
`npm run test:workflow`, `npm run test:versioning`, `npm run test:integration` (temporal-dev
on 127.0.0.1:7233; no stray `worker.ts`).
