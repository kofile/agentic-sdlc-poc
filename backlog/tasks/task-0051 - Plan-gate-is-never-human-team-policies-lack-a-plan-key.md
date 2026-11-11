---
id: TASK-0051
title: 'Plan gate is never human: team policies lack a plan key'
status: To Do
assignee: []
created_date: '2026-11-11 20:35'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each team file states the plan gate explicitly (default and strict human, auto auto), or the README/contracts are corrected if plan is intentionally always auto
- [ ] #2 A workflow test proves a human plan gate waits for a decide signal under the default policy
- [ ] #3 The meaning of the 'merge' key is documented or removed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
