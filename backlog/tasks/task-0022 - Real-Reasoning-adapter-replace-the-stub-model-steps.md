---
id: TASK-0022
title: 'Real Reasoning adapter: replace the stub model steps'
status: In Progress
assignee: []
created_date: '2026-11-05 20:51'
updated_date: '2026-11-05 21:46'
labels:
  - graph
  - adapter
  - reasoning
  - critical-path
milestone: m-3
dependencies:
  - TASK-0021
documentation:
  - graph/docs/stage-contracts.md
  - notes/00-discovery-log.md
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
graph/ currently runs triage, route, design and plan with stub model steps. Build the real Reasoning port adapter (Claude Code headless or the API; first real adapter to build). The model is a typed function: output validated with zod, gates made by code and fail-closed, the model never decides control flow. Pin Sonnet 5.5 (D1), verify the served model from the response, record per-step tokens. Keep prompts and graph versioned so G can be frozen by tag.

Spec: specs/005-reasoning-adapter
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Triage, route, design and plan steps call the real model with zod-validated output
- [ ] #2 Invalid output fails closed at a gate rather than advancing
- [ ] #3 Served model and token usage recorded per step
- [ ] #4 Unit and workflow tests updated; npm test and npm run test:workflow pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
