---
id: TASK-0014
title: 'Ground-truth scoring: hidden tests in a clean container and label comparison'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - harness
  - bench
  - scoring
milestone: m-2
dependencies:
  - TASK-0013
  - TASK-0009
documentation:
  - notes/02-benchmark-spec.md
  - bench/verify/verify.mjs
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After a contender produces a PR, the harness scores it against ground truth: run the hidden tests (bench/hidden-tests, with the canary string) in a clean container against the PR head, compare ticket grade and route to expected.yaml, and assign the cumulative success tiers (spec 5.3). Flag a leak if BENCH-CANARY-7f3a91c2 appears in any transcript or contender output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hidden tests run in a clean container from the PR head and results land in the scores table
- [ ] #2 Canary scan runs on every transcript and artifact and raises a flag on a hit
- [ ] #3 Success tiers 5.3 are computed and match a hand-checked sample
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
