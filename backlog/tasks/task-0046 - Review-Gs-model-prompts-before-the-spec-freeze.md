---
id: TASK-0046
title: Review G's model prompts before the spec freeze
status: To Do
assignee: []
created_date: '2026-11-09 19:33'
labels:
  - graph
  - reasoning
  - benchmark-integrity
dependencies: []
priority: high
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
graph/prompts/{triage,route,design,plan}.md were written by an implementer agent in TASK-0022 (spec 005 put prompt quality out of scope) and have not been read by a person or exercised by a live call. They are versioned so G can be frozen by tag (TASK-0029), and G's triage/route accuracy (H6) depends on their wording. A human (operator or Cesar) reviews them against graph/docs/stage-contracts.md before the D5 freeze; review must not consult bench/tickets/expected.draft.yaml or reference diffs while editing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each of the four prompt files reviewed by a person, findings recorded
- [ ] #2 Changes, if any, land before the spec-frozen tag
- [ ] #3 Reviewer did not tune prompts against expected labels or hidden tests
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
