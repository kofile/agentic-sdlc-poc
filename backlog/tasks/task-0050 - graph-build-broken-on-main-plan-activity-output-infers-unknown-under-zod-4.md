---
id: TASK-0050
title: 'graph build broken on main: plan activity output infers unknown under zod 4'
status: In Progress
assignee: []
created_date: '2026-11-11 20:29'
updated_date: '2026-11-11 20:31'
labels:
  - graph
  - bug
dependencies: []
priority: high
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-11-11 after PR #12 (TASK-0049) merged: 'npm run build' in graph/ fails on main with TS2322/TS2345 at src/workflow/activities.ts:205. callModelStage is called without a type argument in plan(), so with zod 4.6.7 T infers as unknown. Pre-merge verification missed it because the TASK-0049 worktree symlinked graph/node_modules to the root checkout, which still had pre-#11 packages (zod 3). vitest does not type-check, so unit/workflow/integration stayed green.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 npm run build in graph/ is clean on a fresh npm ci
- [ ] #2 unit, workflow, versioning and integration stay green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-11 escape line signed (runbook, Per-task artifacts section): card ACs + clean build on fresh npm ci + green suites stand in for the spec set.

Dispatch: tier=haiku pinned=claude-haiku-5-5 served=claude-haiku-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
