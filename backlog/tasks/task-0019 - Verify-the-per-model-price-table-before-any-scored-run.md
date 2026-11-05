---
id: TASK-0019
title: Verify the per-model price table before any scored run
status: Done
assignee: []
created_date: '2026-11-05 20:51'
updated_date: '2026-11-05 21:35'
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

Spec: specs/001-price-table
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every price in prices.json cites its source and retrieval date and the UNVERIFIED markers are gone
- [x] #2 A unit test recomputes cost for a recorded usage sample
- [ ] #3 Spec phase: Source the prices
- [ ] #4 Spec phase: Rewrite the table and test it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-05: all six prices spot-checked by the orchestrator against https://platform.claude.com/docs/en/about-claude/pricing (independent fetch): match. Old placeholder had Sonnet 5 at 3/15; the page says 2/10 is now standard. Haiku 5.5 over-100K tier not recorded (in _comment). Gates re-run by orchestrator: build ok, unit 32/32, workflow 10/10.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Source the prices: 2/2 · Rewrite the table and test it: 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
