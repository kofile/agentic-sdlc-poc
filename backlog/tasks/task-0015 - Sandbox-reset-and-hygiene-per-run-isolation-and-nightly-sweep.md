---
id: TASK-0015
title: 'Sandbox reset and hygiene: per-run isolation and nightly sweep'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - harness
  - sandbox
milestone: m-2
dependencies:
  - TASK-0013
  - TASK-0001
  - TASK-0002
  - TASK-0003
documentation:
  - notes/02-benchmark-spec.md
priority: medium
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Each run gets its own Jira ticket and Confluence page tree; the repos are reset to the base tag before each run (spec section 7 step 1). A nightly sweep moves run pages into the single 'safe to delete' Confluence folder (no delete operation exists; verify by listing descendants). Risk mitigated: cross-run contamination and sandbox clutter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 bench run resets repos to the base tag and creates a fresh ticket
- [ ] #2 Sweep moves run pages and a descendants listing proves it
- [ ] #3 Two back-to-back runs of the same ticket do not see each other's artifacts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
