---
id: TASK-0035
title: Seeded-review runs (only if validate/review are ready)
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - runs
  - review-stage
  - optional
milestone: m-5
dependencies:
  - TASK-0032
  - TASK-0011
documentation:
  - notes/02-benchmark-spec.md
priority: low
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run each contender's review stage over the seeded-bug PR fixtures and score precision and recall. Cut-line item 2: skip, and narrow scope to triage-through-PR, if G's validate and review stages are not ready.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Go/no-go recorded; if go, each contender reviewed every fixture and scored against the answer key
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
