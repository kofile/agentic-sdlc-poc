---
id: TASK-0026
title: 'Execute node: wrapped coding agent in a sandbox container'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - graph
  - execute
  - docker
  - critical-path
milestone: m-3
dependencies:
  - TASK-0022
  - TASK-0025
documentation:
  - notes/spike-03-execute-host.md
  - notes/00-discovery-log.md
priority: high
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The execute stage runs a full coding harness (Claude Code headless) inside a container through the ExecuteHost interface (D8: Docker local now, cloud host after the demo). Requirements from the spikes (notes/spike-03-execute-host.md): attach, list and reapOrphans; a poll fallback is mandatory; secrets by file mount only; heartbeats; cancel works. The agent edits only the target repo checkout and must not see hidden tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A dev ticket is implemented in a container and committed to a feature branch
- [ ] #2 Killing the container mid-run is detected and the activity retries or fails closed
- [ ] #3 No secret is in the image or environment dump
- [ ] #4 Orphaned containers are reaped
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
