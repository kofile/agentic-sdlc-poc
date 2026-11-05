---
id: TASK-0009
title: Grade tickets independently (operator and Cesar) and reconcile
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - operator
  - cesar
  - bench
  - grading
milestone: m-1
dependencies:
  - TASK-0005
documentation:
  - bench/tickets/grading-sheet.md
  - notes/02-benchmark-spec.md
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expected outcomes (ticket grade A-D, expected repo, design/plan expectations) must be graded independently by two humans; Claude drafts but is never a grader of record (D3: second grader is Cesar). Use bench/tickets/grading-sheet.md (blank). Do NOT show either grader bench/tickets/expected.draft.yaml first, or they anchor. Reconcile disagreements before any run; the gate-level split (A/B versus C/D) is the primary accuracy measure.

Note for the write-up: outputs are anonymized but n8n PR comments are recognizable, so the later 20 percent rubric spot-check is only partly blind; record as a limitation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Two independent completed grading sheets exist
- [ ] #2 Disagreements reconciled and the final expected.yaml committed
- [ ] #3 Inter-grader agreement figure recorded
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
