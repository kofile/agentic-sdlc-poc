---
id: TASK-0044
title: bench run ids collide for the same ticket and rep within one minute
status: To Do
assignee: []
created_date: '2026-11-05 21:58'
labels:
  - harness
  - bug
dependencies: []
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-11-05 during TASK-0018 verification: two 'bench run' invocations with the same contender, ticket and rep inside the same minute fail with 'UNIQUE constraint failed: runs.run_id', because makeRunId (bench/harness/src/run-id.ts, TASK-0013) has minute resolution. Repeat runs (k=3..5) and retries will hit this.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Two runs of the same contender/ticket/rep started in the same minute get distinct run ids
- [ ] #2 Run id stays human-readable and sortable
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
