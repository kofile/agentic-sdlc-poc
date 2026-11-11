---
id: TASK-0045
title: Triage npm audit findings in graph/ and bench/harness
status: In Progress
assignee: []
created_date: '2026-11-05 21:58'
updated_date: '2026-11-11 16:22'
labels:
  - graph
  - harness
  - security
dependencies: []
priority: medium
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
npm audit in graph/ (2026-11-05, on main and on TASK-0022's branch alike) reports 7 findings: zod <4.6.6 (high, production), plus dev-only vitest/@vitest/mocker, esbuild, tinypool (2 critical). Not introduced by Lane 2. Decide per finding: upgrade (exact versions), accept with rationale, or not applicable (dev-only).

Spec: specs/008-npm-audit
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each finding has a recorded disposition
- [ ] #2 Production dependency findings fixed or accepted with a decision-log row
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
