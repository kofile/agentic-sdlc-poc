---
id: TASK-0006
title: Enable MCP access on the n8n execute workflow
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
updated_date: '2026-11-11 16:28'
labels:
  - operator
  - cesar
  - n8n
milestone: m-0
dependencies: []
documentation:
  - notes/00-discovery-log.md
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The execute workflow (id ad47NpL1Nf3VlZUM) returns 'Workflow is not available in MCP', so it cannot be read and its past executions cannot be pulled. Cesar or the operator must enable MCP access in the workflow settings. Until then N can only be compared on covered stages.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 get_workflow_details on ad47NpL1Nf3VlZUM succeeds
- [ ] #2 Past executions for it can be searched and a token-count field is confirmed present or absent
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-11 (Cesar): ad47NpL1Nf3VlZUM is already exposed to MCP, but it is an example workflow, not the SDLC path in use; never update it through the connector (auto-publishes; K9). Whether this card is still needed depends on D13.

2026-11-11: under D16 the execute workflow is not part of N; propose dropping this card (operator call).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
