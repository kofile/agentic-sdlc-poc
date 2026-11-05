---
id: TASK-0002
title: Create sandbox Confluence space for the benchmark
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - operator
  - sandbox
  - confluence
milestone: m-0
dependencies: []
documentation:
  - notes/02-benchmark-spec.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
One new Confluence space ('SDLC Benchmark') for design, plan and report pages written by the contenders. Pages cannot be deleted through the API, so cleanup means moving them into a 'safe to delete' folder.

Rule that matters: a page is identified by its exact title, titles contain only the ticket key and use an em dash, so contenders must be kept in separate parent pages to avoid collisions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Space exists
- [ ] #2 Top-level pages P, N and G exist (one parent per contender)
- [ ] #3 A 'safe to delete' folder exists
- [ ] #4 Space key recorded in the discovery log
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
