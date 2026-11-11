---
id: TASK-0017
title: 'N adapter: n8n history baseline first, then live trigger'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
updated_date: '2026-11-11 16:27'
labels:
  - adapter
  - contender-n
  - n8n
milestone: m-2
dependencies:
  - TASK-0013
  - TASK-0006
  - TASK-0005
documentation:
  - notes/00-discovery-log.md
  - notes/02-benchmark-spec.md
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contender N is the n8n workflows. D2: baseline from execution history first (speed and success on covered stages), live sandbox copies only if cheap. n8n covers only execute, validate and review per Cesar; triage workflow is tagged Old and inactive. Adapter: webhook/API trigger then poll executions, normalise to the uniform record. Token telemetry may be missing: per-contender API key is the ground truth and values are labelled estimated. n8n has a 40-minute execution cap that bounds N's throughput (confirm).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Historical executions for the covered workflows are pulled and normalised into the uniform record with their gaps marked
- [ ] #2 If live copies exist: one dev ticket runs end to end against the sandbox
- [ ] #3 Token and cost fields present or explicitly marked estimated/unavailable
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-11 (Cesar + operator, log 9d): baseline candidate is workflow VvyhCzdxMvluqf7d; n8n covers triage..plan only (no execute/open-pr/validate/review); past executions of WF2.1/2.2/3 may be read; token usage is in agent-node responses in execution history; n8n run ~5 min. K9: read-only, never update/publish via connector. Scope pending D13.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
