# Tasks 009 — live smoke call

## Phase 1: Launcher and smoke command

- [ ] T001 `graph/scripts/with-g-key.sh` (Keychain → 0600 temp file → env → command; trap cleanup)
- [ ] T002 `graph/scripts/smoke-triage.ts` and `npm run smoke:triage` (refuses without `GRAPH_REASONING=anthropic`)
- [ ] T003 Unit tests with a fake `security` and dummy key; build and unit green

## Phase 2: Live triage call

- [ ] T004 Orchestrator runs the launcher once on the sample ticket after C8 and TASK-0045 merge
- [ ] T005 `model_served` is `claude-sonnet-5-5`, output schema-valid, temp file gone, spend under $1

## Phase 3: Evidence recorded

- [ ] T006 `notes/spike-05-live-smoke.md` with tokens, cost, console check and hygiene checks
- [ ] T007 D12's UNVERIFIED clause replaced with a pointer to the evidence
