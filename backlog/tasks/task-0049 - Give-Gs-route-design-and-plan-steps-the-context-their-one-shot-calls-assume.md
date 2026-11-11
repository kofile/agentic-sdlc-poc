---
id: TASK-0049
title: 'Give G''s route, design and plan steps the context their one-shot calls assume'
status: In Progress
assignee: []
created_date: '2026-11-11 19:59'
updated_date: '2026-11-11 20:03'
labels:
  - graph
  - reasoning
  - benchmark-integrity
milestone: m-3
dependencies: []
priority: high
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-11-11 by the explainer session, confirmed by the orchestrator. The discovery log (s3) classes design and plan as one-shot generation with PRE-LOADED context; G loads none. activities.ts sends route only {ticket} (no repository catalog, though bench/catalog/repository-catalog.md exists and the stage contract says 'classify against catalog', so route can only invent repo names); design only {ticket, feedback, round}; plan only {ticket, design}, yet plan.md asks for the files each task touches, so paths are guesses. Spec section 4 says a pre-generated Spec Wiki is shared by contenders, and P's plan-agent reads a real checkout. Left as is, G loses route/plan quality for a structural reason, which confounds H6 and the plan comparison. Options: (1) code assembles context before each call (catalog for route; Spec Wiki + file tree + keyword-matched files for design/plan) and a code gate checks every plan file path exists or is marked new; (2) bounded read-only tool loop for plan; (3) hybrid: (1) plus at most N typed extra-file requests. Decision needed before the D5 freeze and before TASK-0046's prompt review.

Spec: specs/010-preloaded-context
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Operator decision on the approach recorded as a decision-log row
- [ ] #2 Route receives the repository catalog; design and plan receive the agreed context
- [ ] #3 Plan file paths are checked by a code gate against the checkout (exist, or explicitly new)
- [ ] #4 Lands before the spec-frozen tag; TASK-0046 reviews prompts after this change
- [ ] #5 Spec phase: Context port, adapter and assembly
- [ ] #6 Spec phase: Plan schema and path gate
- [ ] #7 Spec phase: Wiring, prompts and docs
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
D17 (2026-11-11): option 1. Context step in code: route gets the repository catalog; design and plan get the Spec Wiki, file tree and keyword/path-matched files; plan file-path gate in code. Hybrid only if the dev pilot shows context-labelled plan failures.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-11: operator chose 'Pre-load + path gate'; recorded as D17.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
