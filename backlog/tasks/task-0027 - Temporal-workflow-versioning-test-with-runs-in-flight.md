---
id: TASK-0027
title: Temporal workflow-versioning test with runs in flight
status: Done
assignee: []
created_date: '2026-11-05 20:51'
updated_date: '2026-11-05 21:35'
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
- [x] #1 A test starts a run, deploys a changed workflow, and the old run completes correctly
- [x] #2 Result and the method used recorded in notes/ as evidence
- [ ] #3 Spec phase: Fixtures and in-flight test
- [ ] #4 Spec phase: Evidence
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-05 phase 1 done: test:versioning 1/1 (orchestrator re-run), unit 21, workflow 10. Deviation: patched step placed before the design loop, not before plan (see plan.md).

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-05 phase 2 done: notes/spike-04-versioning.md + D7 follow-up note in the discovery log.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Fixtures and in-flight test: 5/5 · Evidence: 2/2). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
