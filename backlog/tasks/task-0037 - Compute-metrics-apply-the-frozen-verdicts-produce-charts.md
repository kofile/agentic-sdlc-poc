---
id: TASK-0037
title: 'Compute metrics, apply the frozen verdicts, produce charts'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - analysis
  - verdicts
  - charts
milestone: m-5
dependencies:
  - TASK-0036
documentation:
  - notes/02-benchmark-spec.md
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run bench report on the final data. Apply the frozen win/tie/loss rules exactly; do not re-tune. Report every loss and tie, and the 'where G should not be expected to win' list, with the same prominence as wins. Anything not independently verified is marked UNVERIFIED.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Verdict per hypothesis H1-H6 generated from the frozen rules
- [ ] #2 Charts regenerate from SQLite with one command
- [ ] #3 A losses-and-ties summary exists and was not edited by hand
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
