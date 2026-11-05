---
id: TASK-0008
title: 'Review Lane A output: tickets, hidden tests, reference diffs'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - operator
  - review
  - bench
  - checkpoint
milestone: m-1
dependencies: []
documentation:
  - bench/tickets/SET.md
  - bench/verify/last-run.txt
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lane A (bench/) was built by an agent and re-verified by the orchestrator (verify.sh 11/11 cold). Nobody has read the content for quality. Read bench/tickets/T01..T16, the hidden tests and reference diffs and judge: are the tickets realistic, are the traps fair, do hidden tests test behaviour (not implementation), do tickets leak the answer (the agent already removed the Jira Component field because it gave away routing). Known judgment calls to check: T11's acceptance criteria settle a design choice (draft marks it B); T06's reference needed stricter date validation. End-of-Day-2 operator checkpoint.

Integrity: do not paste hidden tests or expected.draft.yaml into any contender-facing place.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Operator has read all 16 tickets and the 11 reference diffs and logged findings
- [ ] #2 Every finding is either fixed (and bash bench/verify/verify.sh re-run 11/11 cold) or recorded as accepted
- [ ] #3 Findings recorded in notes/00-discovery-log.md
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
