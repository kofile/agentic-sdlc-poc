---
id: TASK-0028
title: 'Fault-injection tests: kill worker, duplicate and late approval, design reject'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - graph
  - h5
  - fault-injection
milestone: m-3
dependencies:
  - TASK-0026
documentation:
  - notes/02-benchmark-spec.md
  - notes/spike-02-engine.md
priority: medium
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
H5 is a capability comparison with equal fault types across contenders. Implement the scripted faults for G: kill the worker mid-run and resume, duplicate approval signal (keyed by gate+round), late approval, and a scripted design-reject loop. Cut-line item 3: beyond one scripted kill, H5 becomes a demo, not a number.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each fault scenario has an automated test that passes against G
- [ ] #2 The same fault list is documented for P and N so the comparison is like for like
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
