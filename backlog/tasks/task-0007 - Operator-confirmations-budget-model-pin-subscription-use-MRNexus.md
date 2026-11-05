---
id: TASK-0007
title: 'Operator confirmations: budget, model pin, subscription use, MRNexus'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - operator
  - decision
  - budget
milestone: m-0
dependencies: []
documentation:
  - notes/02-benchmark-spec.md
  - notes/00-discovery-log.md
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Open operator items from the spec section 9 that gate runs: (1) budget ceiling (spec assumes about 700 USD tokens plus under 20 USD compute); (2) confirm the model pin (Sonnet 5.5 for all steps of N and G, plugin headline run as shipped plus an anchor run pinned to Sonnet, D1) is allowed for N's agents and the plugin's agents; (3) whether the subscription OAuth token (already in Keychain) may be used for container-based automation; (4) MRNexus access, whether a sandbox fork is allowed, and any limits on showing numbers outside Kofile (dropped by Day 6 if absent); (5) where hidden-tests are kept (gitignored in this repo; confirm it stays private).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each of the five items has an answer recorded in the Decisions table of the discovery log with its three-way grade (AICOE maintenance, customer ease, adaptability)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
