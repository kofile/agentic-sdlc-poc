---
id: TASK-0051
title: 'Plan gate is never human: team policies lack a plan key'
status: Done
assignee: []
created_date: '2026-11-11 20:35'
updated_date: '2026-11-11 20:50'
labels:
  - graph
  - bug
  - benchmark-integrity
milestone: m-3
dependencies: []
priority: high
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-11-11 by the AG-UI research session, confirmed by the orchestrator. workflows.ts:179 calls gate('plan', 1), which looks up policy.gates['plan'] (workflows.ts:109, gates.ts:40), but graph/teams/{auto,default,strict}.json define only 'design' and 'merge'. So the plan gate is always auto for every team, while the README and stage contracts describe it as policy-driven (K5, K6). 'merge' may have been meant as the plan gate, or is for a later merge stage; decide which. Affects how strict/default runs behave in the benchmark, so fix before the D5 freeze.

Spec: specs/011-plan-gate-policy
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each team file states the plan gate explicitly (default and strict human, auto auto), or the README/contracts are corrected if plan is intentionally always auto
- [x] #2 A workflow test proves a human plan gate waits for a decide signal under the default policy
- [x] #3 The meaning of the 'merge' key is documented or removed
- [x] #4 Spec phase: Policy files, docs and tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-11 orchestrator re-run on own npm ci: build exit 0, unit 93, workflow 16, versioning 1, integration ALL PASS, 0 workers. Harness G adapter approves any waiting gate generically (bench/harness/src/adapters/g/gates.ts:48-62), so plan under default/strict is handled; read, not run.

2026-11-11 merged via PR #14 (608056e). spec 011 T001-T005 all ticked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
plan gate stated in every team file (auto: auto; default, strict: human); merge documented as reserved for a merge stage outside the PoC; workflow test loads the committed default.json and proves the plan gate waits for decide (approve -> opened-pr, reject -> rejected). Harness G adapter approves waiting gates generically (read, not run). PR #14, merge 608056e.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests are written (when applicable).
- [x] #2 All Tests pass (when available)
- [x] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [x] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
