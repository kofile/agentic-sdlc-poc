---
id: TASK-0010
title: 'Triage the spikes/ code: ignore data, decide commit or discard'
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - repo-hygiene
  - spikes
milestone: m-1
dependencies: []
documentation:
  - notes/spike-01-plugin-headless.md
  - notes/spike-02-engine.md
  - notes/spike-03-execute-host.md
priority: low
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
spikes/ holds throwaway evidence behind decisions D7-D9 (reports are committed in notes/spike-0*.md; the code is not). It is unreviewed, and spikes/02-engine/data/ is not gitignored. Add spikes/*/data/ to .gitignore (operator go-ahead needed; the .gitignore was once changed without approval) and decide per spike whether to commit code as evidence or discard it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 spikes/*/data/ is gitignored
- [ ] #2 Each spike dir is either committed with a README saying it is not product code, or removed
- [ ] #3 git status is clean of spikes/ leftovers
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
