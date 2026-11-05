---
id: TASK-0023
title: 'Tracker adapter: Jira sandbox (prefer MCP)'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - graph
  - adapter
  - jira
milestone: m-3
dependencies:
  - TASK-0001
  - TASK-0004
  - TASK-0022
documentation:
  - graph/docs/stage-contracts.md
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Real Tracker port adapter against the sandbox Jira project: read ticket, post the triage comment, set story points, transition status. Convention: prefer MCP for Atlassian; no gh/az dependency in product code beyond sign-in. Provider-specific code lives only in the adapter.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Triage of a sandbox ticket posts a comment, sets points and transitions the ticket
- [ ] #2 Writes are idempotent on retry (no duplicate comment)
- [ ] #3 Only the sandbox project is reachable with the configured credentials
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
