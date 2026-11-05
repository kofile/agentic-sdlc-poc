---
id: TASK-0020
title: 'bench report: tables, verdicts and charts from SQLite'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - harness
  - report
  - charts
milestone: m-2
dependencies:
  - TASK-0013
  - TASK-0014
documentation:
  - notes/02-benchmark-spec.md
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec section 6: reproducible report from SQLite only. Speed, cost, success tiers, accuracy and run-to-run variance per contender; pre-registered win/tie/loss verdicts per hypothesis H1-H6 (thresholds frozen in M5); charts readable by a non-technical audience (follow the dataviz skill). Analysis may be in Python or a notebook.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bench report regenerates every table and chart from bench.sqlite with no manual step
- [ ] #2 Verdict rules are read from the frozen spec, not hard-coded numbers in the report
- [ ] #3 A 'where G does not win' view is generated, not hand-written
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
