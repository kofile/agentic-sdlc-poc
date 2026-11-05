---
id: TASK-0024
title: 'Docs adapter: Confluence sandbox pages (one page per ticket per artifact)'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - graph
  - adapter
  - confluence
milestone: m-3
dependencies:
  - TASK-0002
  - TASK-0004
  - TASK-0022
documentation:
  - graph/docs/stage-contracts.md
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Real Docs port adapter writing design and plan pages. Two rules that create duplicate trees if broken: one page per ticket per artifact (title contains only the ticket key; re-running a stage makes a new version, never a second page) and titles use an em dash (U+2014), not a hyphen, because lookup is by exact title. Pages go under the G parent page of the sandbox space.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Re-running a stage updates the same page to a new version
- [ ] #2 A test proves a hyphen title is rejected or normalised and the em dash is used
- [ ] #3 Pages land under the G parent page
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
