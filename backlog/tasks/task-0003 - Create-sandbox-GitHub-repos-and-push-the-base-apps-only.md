---
id: TASK-0003
title: Create sandbox GitHub repos and push the base apps only
status: To Do
assignee: []
created_date: '2026-11-05 20:51'
labels:
  - operator
  - sandbox
  - github
  - leak-risk
milestone: m-0
dependencies: []
documentation:
  - bench/catalog/repository-catalog.md
  - notes/02-benchmark-spec.md
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two private repos under the org the plugin and n8n can already reach (suggested names sdlc-bench-orderdesk and sdlc-bench-orderdesk-web). Push ONLY the base apps from bench/orderdesk and bench/orderdesk-web as a single main, with a tag on the base commit (e.g. bench/base) so the harness can reset main between runs.

NEVER push bench/hidden-tests/, any reference.diff, bench/tickets/, bench/verify/ or expected.draft.yaml: a contender that can see those invalidates the benchmark. Branch protection stays off because the merge stage must be able to merge; the harness resets main to the base tag between runs. The 3 decoy repos in bench/catalog/repository-catalog.md do not need to exist.

Open question to confirm first: is the VCS GitHub or Azure Repos for n8n's execute and review workflows? (the plugin supports both through its vcs contract).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Two private repos exist with only the base apps on main
- [ ] #2 Base commit is tagged and the tag name is recorded in the discovery log
- [ ] #3 A search of both repos for the canary string BENCH-CANARY-7f3a91c2 and for reference.diff finds nothing
- [ ] #4 Branch protection is off on main
- [ ] #5 VCS choice (GitHub vs Azure Repos) recorded as a decision
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests are written (when applicable).
- [ ] #2 All Tests pass (when available)
- [ ] #3 All acceptance criteria (AC) are checked off or explicitly bypassed with note
- [ ] #4 Spec-kit specifications have been written, and have been fully executed (when applicable)
<!-- DOD:END -->
