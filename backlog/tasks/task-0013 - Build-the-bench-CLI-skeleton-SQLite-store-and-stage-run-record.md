---
id: TASK-0013
title: 'Build the bench CLI skeleton, SQLite store and stage-run record'
status: Done
assignee: []
created_date: '2026-11-05 20:51'
updated_date: '2026-11-05 21:35'
labels:
  - harness
  - bench
  - typescript
milestone: m-2
dependencies: []
documentation:
  - notes/02-benchmark-spec.md
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Per spec section 7: a small TypeScript CLI 'bench' (Node 22, exact dependency versions, committed lockfile) with one adapter per contender and no contender-specific logic in the core. 'bench run --contender P|N|G --ticket T07 --rep 2 --stages triage..open-pr --seed-order n'. Adapters normalise events into ONE uniform JSON record per stage per run. Storage: bench.sqlite (tables runs, stage_runs, scores, interventions) plus artifacts/<run_id>/; flat JSONL export. bench.sqlite and artifacts/ are gitignored.

Spec: specs/003-bench-harness
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bench run executes a stub contender end to end and writes runs and stage_runs rows
- [x] #2 The stage-run record schema matches spec section 7 and is validated (zod) on write
- [x] #3 bench report reads only from SQLite
- [x] #4 Unit tests cover the schema and the store
- [x] #5 Spec phase: Package, schema and store
- [ ] #6 Spec phase: Adapter contract, stub and run command
- [ ] #7 Spec phase: Report, export and end-to-end
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-05 phase 1 done: build ok, 13 tests (orchestrator re-run). node:sqlite loaded via process.getBuiltinModule because vitest cannot resolve the static import.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-05 phase 2 done: 31 tests (orchestrator re-run). Spec R3a added by orchestrator: no silent zeros (core must not default telemetry_gaps; defaulted fields named as gaps) — T007a in phase 3.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-05 phase 3 done: build ok, 41 tests; orchestrator smoke run stub T02 triage..open-pr → 6 rows, report and export from SQLite only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Package, schema and store: 4/4 · Adapter contract, stub and run command: 3/3 · Report, export and end-to-end: 4/4). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
