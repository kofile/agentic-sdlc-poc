---
id: TASK-0027
title: Temporal workflow-versioning test with runs in flight
status: In Progress
assignee: []
created_date: '2026-11-05 20:51'
updated_date: '2026-11-05 21:07'
labels:
  - graph
  - temporal
  - risk
milestone: m-3
dependencies: []
documentation:
  - notes/spike-02-engine.md
priority: medium
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Open caveat on D7 (Temporal chosen): prove that a workflow definition can be changed while runs are in flight (patching or versioning) without breaking them; this is a core claim of the durable-execution approach and a likely question from the n8n owner.

Spec: specs/002-versioning-test
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test starts a run, deploys a changed workflow, and the old run completes correctly
- [ ] #2 Result and the method used recorded in notes/ as evidence
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
