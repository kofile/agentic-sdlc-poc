---
id: TASK-0004
title: Provision scoped credentials for the sandbox
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - operator
  - sandbox
  - secrets
milestone: m-0
dependencies:
  - TASK-0001
  - TASK-0002
  - TASK-0003
documentation:
  - CLAUDE.md
  - notes/00-discovery-log.md
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scoped access only, never committed. (1) Atlassian token or MCP access limited to the sandbox Jira project and Confluence space. (2) Fine-grained GitHub token limited to the two sandbox repos. (3) One Anthropic API key or workspace per contender (N and G) so provider-side usage can cross-check token and cost telemetry; P runs on the subscription and its cost is labelled estimated (D4). (4) n8n sandbox copies need credentials that point at the sandbox, not production.

Secrets rule (CLAUDE.md): the subscription OAuth token lives in the macOS Keychain (service claude-bench-oauth); pass it by file mount, never print it or write it into the repo.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Atlassian access verified to reach the sandbox project and space and nothing else
- [ ] #2 GitHub token verified to reach only the two sandbox repos
- [ ] #3 Separate Anthropic key or workspace exists for N and for G
- [ ] #4 No secret appears in any tracked file or transcript
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
