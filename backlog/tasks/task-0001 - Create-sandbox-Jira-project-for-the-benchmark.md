---
id: TASK-0001
title: Create sandbox Jira project for the benchmark
status: To Do
assignee: []
created_date: '2026-11-05 20:50'
labels:
  - operator
  - sandbox
  - jira
milestone: m-0
dependencies: []
documentation:
  - notes/02-benchmark-spec.md
  - notes/HANDOFF.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Benchmark runs must never touch production Jira. Create one new Jira project (suggested name 'SDLC Benchmark', own key such as SDLCB) that all three contenders (P plugin, N n8n, G Temporal system) are pointed at.

Context: the harness creates a fresh ticket copy per run (title prefix [SDLC-TEST], label sdlc_test), so do NOT pre-create the 16 benchmark tickets. Sub-tasks are needed because the plugin's repo-route stage creates one per repo.

Provide back to the repo: the project key. Record it in notes/00-discovery-log.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Project exists with its own key, separate from any real board
- [ ] #2 Workflow statuses match the plugin and n8n vocabulary (Ready for Dev, Waiting for Info, Deploying, etc.; list in plugins/sdlc-pipeline-plugin/skills/pipeline-conventions/SKILL.md in ai-coe-plugins); cloning the workflow of the project n8n already runs on is the safest route
- [ ] #3 Issue types Story, Bug, Task and Sub-task are available
- [ ] #4 A Story Points field is available (triage sets it)
- [ ] #5 Project key recorded in the discovery log
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
