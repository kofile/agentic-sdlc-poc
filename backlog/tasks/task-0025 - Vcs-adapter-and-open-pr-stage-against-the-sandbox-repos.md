---
id: TASK-0025
title: Vcs adapter and open-pr stage against the sandbox repos
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - graph
  - adapter
  - vcs
milestone: m-3
dependencies:
  - TASK-0003
  - TASK-0004
documentation:
  - graph/docs/stage-contracts.md
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Real Vcs port adapter: clone, branch, push and open a PR in the sandbox repos. Pre-push secret check; adopt an existing PR on the exact head branch instead of opening a duplicate. Idempotent so a retried activity does not open a second PR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 open-pr creates one PR on the sandbox repo for a dev ticket and a retry adopts it
- [ ] #2 Pre-push secret scan blocks a seeded fake secret
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
