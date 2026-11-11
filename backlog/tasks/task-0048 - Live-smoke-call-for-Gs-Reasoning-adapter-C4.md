---
id: TASK-0048
title: Live smoke call for G's Reasoning adapter (C4)
status: In Progress
assignee: []
created_date: '2026-11-11 16:20'
updated_date: '2026-11-11 16:27'
labels:
  - graph
  - reasoning
  - verify
milestone: m-3
dependencies: []
priority: high
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First real model call through graph/src/adapters/anthropic-reasoning.ts (D12), which so far is tested only against recorded fixtures. Needs the dedicated G API key from the operator, stored in the macOS Keychain and passed to the process as a file (ANTHROPIC_API_KEY_FILE, GRAPH_REASONING=anthropic); never written to the repo, a log or a fixture. Use graph/tickets/sample-ticket.md only (never bench/tickets). Spend: a few cents; hard stop at $1.

Spec: specs/009-live-smoke
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A launcher reads the key from the Keychain into a 0600 temp file, runs the call, and deletes the file on exit (success or failure)
- [ ] #2 One triage call on graph/tickets/sample-ticket.md succeeds, output passes zod, and model_served from the response is claude-sonnet-5-5
- [ ] #3 Tokens and computed cost recorded and checked against the Anthropic console usage page
- [ ] #4 D12's UNVERIFIED note on live behaviour updated with the evidence
- [ ] #5 Spec phase: Launcher and smoke command
- [ ] #6 Spec phase: Live triage call
- [ ] #7 Spec phase: Evidence recorded
<!-- AC:END -->



## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
