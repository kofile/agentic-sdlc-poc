---
id: TASK-0019
title: Verify the per-model price table before any scored run
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - harness
  - cost
  - verify
milestone: m-2
dependencies: []
documentation:
  - graph/config/prices.json
  - notes/02-benchmark-spec.md
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
graph/config/prices.json holds placeholder prices marked UNVERIFIED. Cost is computed by price lookup on model_served, so a wrong table corrupts every cost chart. Verify each model's input, output and cache prices against the vendor's pricing page and record the retrieval date and source.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every price in prices.json cites its source and retrieval date and the UNVERIFIED markers are gone
- [ ] #2 A unit test recomputes cost for a recorded usage sample
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
