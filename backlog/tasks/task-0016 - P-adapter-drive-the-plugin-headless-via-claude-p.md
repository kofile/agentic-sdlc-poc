---
id: TASK-0016
title: 'P adapter: drive the plugin headless via claude -p'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - adapter
  - contender-p
  - plugin
milestone: m-2
dependencies:
  - TASK-0013
  - TASK-0004
documentation:
  - notes/spike-01-plugin-headless.md
  - notes/02-benchmark-spec.md
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contender P is sdlc-pipeline-plugin run headless (D9; findings in notes/spike-01-plugin-headless.md). Spawn claude -p with stream-json, isolated from user-level plugins (they otherwise leak about 113k tokens of context), parse modelUsage for per-model tokens and cost, drive its interactive questions with a scripted answer driver (AskUserQuestion is absent headless so the model asks in plain text). Two configs (D1): as shipped (headline) and pinned to Sonnet (anchors; needs CLAUDE_CODE_SUBAGENT_MODEL=sonnet, CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 and --model sonnet). Cost is an estimate from tokens at list price because it runs on the subscription (D4). Verify the served model from the response, never from config.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A dev ticket runs end to end through the adapter and emits uniform stage-run records
- [ ] #2 Served model recorded from the response for each stage
- [ ] #3 Run is isolated from user-level plugins (context size confirmed small)
- [ ] #4 Cost is labelled estimated
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
