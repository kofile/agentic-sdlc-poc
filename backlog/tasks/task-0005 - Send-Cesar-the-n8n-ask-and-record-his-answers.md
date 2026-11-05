---
id: TASK-0005
title: Send Cesar the n8n ask and record his answers
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - operator
  - cesar
  - n8n
milestone: m-0
dependencies: []
documentation:
  - notes/00-discovery-log.md
  - notes/02-benchmark-spec.md
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cesar owns the n8n workflows. Questions the benchmark needs answered: do workflows WF4-WF9 exist elsewhere; does the execute workflow open the PR; which n8n variants (many-node, single-node) are current; can the inactive 'Ticket Grader Webhook' (tagged Old) be reactivated as a sandbox copy, or is there a current triage workflow; does n8n execution data carry token counts and cost; does the 40-minute execution cap apply to the instance; will he act as the second ticket grader. Note that a triage sandbox copy needs only the sandbox Jira project; later stages need Confluence and GitHub too.

His first reply (2026-11-05) says the Ticket Grader Webhook is Old and inactive; the follow-up question is whether a current triage workflow exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Message sent and each question above has a recorded answer in the discovery log (section 9b)
- [ ] #2 Decision recorded on which n8n variants are measured and whether N has live sandbox copies or history-only baselines (D2)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
