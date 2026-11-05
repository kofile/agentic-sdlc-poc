---
id: TASK-0031
title: 'Dev-set pilot: k=1 across all adapters, then lock the harness'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - bench
  - pilot
  - checkpoint
milestone: m-4
dependencies:
  - TASK-0016
  - TASK-0017
  - TASK-0018
  - TASK-0014
  - TASK-0015
  - TASK-0019
  - TASK-0009
documentation:
  - notes/02-benchmark-spec.md
  - bench/tickets/SET.md
priority: high
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run the 4 dev tickets (T01, T05, T07, T12) once through every adapter to find harness bugs, check token telemetry gaps, and measure realistic spend. Lock the harness afterwards. Held-out tickets are NOT touched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All adapters complete or fail cleanly on all 4 dev tickets with uniform records
- [ ] #2 Harness bugs found are fixed and the harness is tagged
- [ ] #3 Spend per run compared to the spec's per-run caps and recorded
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
