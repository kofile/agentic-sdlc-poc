---
id: TASK-0033
title: 'Held-out runs for P and N (k=3, randomized order)'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - runs
  - contender-p
  - contender-n
milestone: m-5
dependencies:
  - TASK-0032
documentation:
  - notes/02-benchmark-spec.md
priority: high
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Start P and N held-out runs in the background on Day 6 with k=3 in randomized interleaved order (rate limits and outages distort timing otherwise; waiting time is separated and an infra retry rule applies). Respect per-run spend caps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every held-out ticket has 3 repetitions per applicable contender, or a recorded reason
- [ ] #2 Run order is randomized and the seed is stored
- [ ] #3 Infra failures are re-run per the retry rule and labelled
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
