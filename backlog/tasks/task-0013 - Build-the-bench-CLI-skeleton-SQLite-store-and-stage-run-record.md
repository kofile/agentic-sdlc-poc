---
id: TASK-0013
title: 'Build the bench CLI skeleton, SQLite store and stage-run record'
status: In Progress
assignee: []
created_date: '2026-11-05 20:51'
updated_date: '2026-11-05 21:09'
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
- [ ] #1 bench run executes a stub contender end to end and writes runs and stage_runs rows
- [ ] #2 The stage-run record schema matches spec section 7 and is validated (zod) on write
- [ ] #3 bench report reads only from SQLite
- [ ] #4 Unit tests cover the schema and the store
- [ ] #5 Spec phase: Package, schema and store
- [ ] #6 Spec phase: Adapter contract, stub and run command
- [ ] #7 Spec phase: Report, export and end-to-end
<!-- AC:END -->



## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
