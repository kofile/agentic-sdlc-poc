---
id: TASK-0039
title: 'Demo script: live side-by-side run, then the charts'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - demo
  - presentation
milestone: m-6
dependencies:
  - TASK-0037
documentation:
  - notes/00-discovery-log.md
  - notes/02-benchmark-spec.md
priority: high
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audience: Joe (manager; must SEE a live run plus charts; dislikes design-pattern jargon) and Cesar (n8n owner; follows data). Script the live run of the same ticket through contenders, then the charts. Use the plain-language column of the glossary in notes/00-discovery-log.md section 8 (e.g. 'checkpointed workflow', not 'durable execution'). Include the resume-after-kill moment (the pause/resume safety hatch the operator requires) and show what a tie means.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Script with timings and a fallback recording if the live run fails
- [ ] #2 No design-pattern vocabulary appears on any slide
- [ ] #3 Dry run completed once
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
