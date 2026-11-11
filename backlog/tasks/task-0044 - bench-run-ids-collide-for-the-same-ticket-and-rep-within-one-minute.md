---
id: TASK-0044
title: bench run ids collide for the same ticket and rep within one minute
status: Done
assignee: []
created_date: '2026-11-05 21:58'
updated_date: '2026-11-11 18:27'
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
- [x] #1 Two runs of the same contender/ticket/rep started in the same minute get distinct run ids
- [x] #2 Run id stays human-readable and sortable
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=haiku pinned=claude-haiku-5-5 served=claude-haiku-5-5

2026-11-11 escape line (signed): card ACs + tests stand in for the spec set. Orchestrator re-ran harness build ok, 77 passed + 1 skipped (was 73+1). Collision retry: same-second runs get -2, -3 ... (bounded at 99); artifact dir named after the settled id.

2026-11-11 merged via PR #10 (a83603f). DoD #4: spec set replaced by the signed escape line.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Run ids now second resolution (YYYY-MM-DDTHHMMSSZ-...); same-second collisions retry with -2..-99 suffix and the artifact dir follows the settled id. Harness 77 passed + 1 skipped. PR #10, merge a83603f.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests are written (when applicable).
- [x] #2 All Tests pass (when available)
- [x] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [x] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
