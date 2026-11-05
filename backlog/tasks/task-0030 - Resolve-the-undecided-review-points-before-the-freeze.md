---
id: TASK-0030
title: Resolve the undecided review points before the freeze
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - operator
  - decision
  - spec
milestone: m-4
dependencies: []
documentation:
  - notes/00-discovery-log.md
  - notes/02-benchmark-spec.md
priority: medium
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Logged in the discovery log, not yet decided: more anchor tickets for H1; cross-repo and reject tickets in the dev set; whether to split the H2 clause; a live-demo script; an at-scale architecture note; a scripted design-reject test. Decide each and record it in the Decisions table with the three-way grade.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each of the six points has a recorded decision (adopt, reject or defer) in the Decisions table
- [ ] #2 If tickets are added, they are graded twice and verified with verify.sh
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
