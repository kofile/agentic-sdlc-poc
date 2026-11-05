---
id: TASK-0032
title: Freeze thresholds and verdict rules; tag spec-frozen (D5)
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - operator
  - spec
  - checkpoint
  - gate
milestone: m-4
dependencies:
  - TASK-0031
  - TASK-0030
documentation:
  - notes/02-benchmark-spec.md
priority: high
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
End of Day 5, before any held-out run: using pilot data, the operator approves the hypotheses H1-H6, thresholds and win/tie/loss rules in the benchmark spec, then tag spec-frozen in git. No held-out run starts before this tag exists. Never edit the verdict rules after the tag; changes require a visible amendment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Operator approval recorded in the log
- [ ] #2 Git tag spec-frozen exists on the commit with the final spec
- [ ] #3 bench refuses to start a held-out run unless the tag exists
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
