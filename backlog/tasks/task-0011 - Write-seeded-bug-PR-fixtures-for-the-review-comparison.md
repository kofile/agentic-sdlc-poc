---
id: TASK-0011
title: Write seeded-bug PR fixtures for the review comparison
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - bench
  - review-stage
milestone: m-1
dependencies:
  - TASK-0003
documentation:
  - notes/02-benchmark-spec.md
priority: medium
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec section 3 / H-review: a set of PRs with known, seeded defects so the review stage of each contender can be scored for precision and recall. Cut-line item 2: dropped (scope narrows to triage-through-PR) if the schedule slips.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fixture set of PRs against the sandbox repos exists with a key listing each seeded defect and its location
- [ ] #2 Reference answer key kept outside the contender-visible repos
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
