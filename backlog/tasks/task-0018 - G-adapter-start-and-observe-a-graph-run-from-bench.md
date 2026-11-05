---
id: TASK-0018
title: 'G adapter: start and observe a graph run from bench'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - adapter
  - contender-g
  - graph
milestone: m-2
dependencies:
  - TASK-0013
documentation:
  - graph/README.md
  - notes/02-benchmark-spec.md
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Thin adapter that starts a Temporal run of graph/ (workflow triage..open-pr), answers or auto-approves gates according to the team policy file, and normalises telemetry into the uniform record. No contender-specific logic in the bench core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bench run --contender G executes the walking skeleton and emits stage-run records
- [ ] #2 Gate approvals are driven by the team policy (auto, default, strict) and recorded as interventions
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
