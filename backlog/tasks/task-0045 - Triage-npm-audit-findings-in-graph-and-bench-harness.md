---
id: TASK-0045
title: Triage npm audit findings in graph/ and bench/harness
status: Done
assignee: []
created_date: '2026-11-05 21:58'
updated_date: '2026-11-11 18:27'
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
- [x] #1 Each finding has a recorded disposition
- [x] #2 Production dependency findings fixed or accepted with a decision-log row
- [x] #3 Spec phase: graph on zod 4 and vitest 2.1.9
- [x] #4 Spec phase: harness on zod 4 and vitest 2.1.9
- [x] #5 Spec phase: Dispositions recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-11 phases 1 (graph) and 2 (harness) in parallel on disjoint dirs; zod 4 needed no source edits; orchestrator re-ran all gates incl. integration and test:g (specs/008 tasks.md verification record). Phase 3 (decision rows) next.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

2026-11-11 merged via PR #11 (c64fad5). tasks.md T001-T008 all ticked; phase ACs synced from spec 008.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
zod 4.6.7 and vitest 2.1.9 (exact) in graph/ and bench/harness; production audit 0 in both. F1/F2 cleared, F3-F8 accepted dev-only (D14, D15). Gates re-run by the orchestrator incl. integration and test:g. PR #11, merge c64fad5.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests are written (when applicable).
- [x] #2 All Tests pass (when available)
- [x] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [x] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
