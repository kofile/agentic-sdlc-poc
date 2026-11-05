---
id: TASK-0029
title: 'Freeze G: tag the prompts and graph before held-out runs'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - graph
  - freeze
milestone: m-3
dependencies:
  - TASK-0026
  - TASK-0028
documentation:
  - notes/02-benchmark-spec.md
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Over-fitting G to the tickets is a named risk. After the dev-set end-to-end pass (Day 7), tag the graph and prompts (e.g. g-frozen) and do not change them for held-out runs; any change after the tag is a new contender version and must be reported.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tag created after a full dev-set end-to-end pass
- [ ] #2 bench records the G tag with every run
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
