---
id: TASK-0047
title: Stub reasoning runs must not look like real model runs
status: Done
assignee: []
created_date: '2026-11-09 19:37'
updated_date: '2026-11-09 19:45'
labels:
  - graph
  - harness
  - benchmark-integrity
  - bug
dependencies: []
priority: high
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-11-09 (side-agent note, confirmed by orchestrator): StubReasoning (graph/src/adapters/stub-reasoning.ts) sets model_served = model_requested (claude-sonnet-5-5). Since TASK-0022, cost is priced on model_served, so stub stages carry a plausible non-zero cost_usd. bench's G adapter files these runs as contender G, not stub, so a stub-backed G run in a scored bench.sqlite is indistinguishable from a real Sonnet run except tokens.source=estimated. Violates CLAUDE.md 'verify the served model from the response, never from config'. Lane 2 verification runs used scratchpad databases only (no repo bench.sqlite exists).

Spec: specs/007-stub-not-real
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Stub reasoning reports model_served as a non-model value (e.g. 'stub') and a telemetry gap such as no_real_model
- [x] #2 Stub stages cost 0 or are flagged; no price lookup on a stub model
- [x] #3 bench refuses to store a G run backed by stub reasoning in a scored database, or labels it so report excludes it by default
- [x] #4 Tests cover both
- [x] #5 Spec phase: Graph reports stub honestly
- [x] #6 Spec phase: Harness refuses or labels stub-backed G runs
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-09 phases 1 (graph) and 2 (harness) dispatched in parallel on disjoint directories; orchestrator re-ran all gates and real CLI runs (see specs/007 tasks.md verification record).

spec-bridge sync: Graph reports stub honestly: 3/3 · Harness refuses or labels stub-backed G runs: 3/3 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Graph reports stub honestly: 3/3 · Harness refuses or labels stub-backed G runs: 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
