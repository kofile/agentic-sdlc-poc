---
id: TASK-0043
title: Integration test leaks Temporal worker processes
status: Done
assignee: []
created_date: '2026-11-05 21:35'
updated_date: '2026-11-09 19:30'
labels:
  - graph
  - verify
  - bug
milestone: m-3
dependencies: []
priority: high
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
graph/tests/integration/run-all.ts leaves its worker processes running after it exits (observed 2026-11-05: three npm/tsx/node worker trees per run, still polling task queue sdlc-graph-poc). The next run, from any checkout, can have its activities picked up by a stale worker running another checkout's code: on main the test failed with ENOENT on .worktrees/task-0021/graph/teams/auto.json after that worktree was deleted. Earlier passes were valid only because no stale worker existed yet. Likely cause: the kill-worker step and teardown signal the npm wrapper, not the tsx/node child.

Spec: specs/004-integration-worker-leak
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 run-all.ts kills every worker process tree it starts, on success and on failure
- [x] #2 Two consecutive runs leave zero worker processes behind (checked with ps)
- [x] #3 The test uses a per-run task queue name so a stray worker cannot steal its tasks
- [x] #4 Spec phase: Process-tree kill and per-run queue
- [ ] #5 Spec phase: Verification
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-05 verified by orchestrator: 2 consecutive integration runs ALL PASS, 0 worker.ts processes after each; stray worker on default queue does not affect a run; SIGINT path kills the tree. build ok, unit 32, workflow 10.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Process-tree kill and per-run queue: 4/4 · Verification: 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
