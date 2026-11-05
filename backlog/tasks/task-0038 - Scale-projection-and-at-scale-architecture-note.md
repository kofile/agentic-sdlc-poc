---
id: TASK-0038
title: Scale projection and at-scale architecture note
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - demo
  - scale
  - cost
milestone: m-6
dependencies:
  - TASK-0037
documentation:
  - notes/02-benchmark-spec.md
priority: medium
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Joe wants numbers and at-scale estimates: cost per ticket at N tickets per month, and what changes for one instance versus per team versus multi-tenant (the PoC need not demo tenancy). Use the method in spec section 6 ('Scale-estimate method'). AWS and Azure agreements exist; note placement options.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Projection table with stated assumptions and sensitivity to the biggest cost driver
- [ ] #2 One-page at-scale architecture note in plain language
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
