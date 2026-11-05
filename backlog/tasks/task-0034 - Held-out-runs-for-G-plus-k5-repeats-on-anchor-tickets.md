---
id: TASK-0034
title: 'Held-out runs for G, plus k=5 repeats on anchor tickets'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - runs
  - contender-g
milestone: m-5
dependencies:
  - TASK-0032
  - TASK-0029
documentation:
  - notes/02-benchmark-spec.md
priority: high
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run G over the held-out tickets (k=3) and the anchor tickets for k=5 repeats so run-to-run variance is measurable (fallback: k=3 with pooled CV; cut-line item 4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Held-out runs complete with the frozen G tag recorded
- [ ] #2 Anchor tickets have 5 repetitions or a recorded fallback
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
