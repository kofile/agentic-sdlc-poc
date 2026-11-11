# Tasks 011 — plan gate policy

## Phase 1: Policy files, docs and tests

- [ ] T001 `plan` in `teams/{auto,default,strict}.json` (auto, human, human) (R1)
- [ ] T002 `merge` documented as reserved; README and stage-contracts list `plan` as policy-driven (R2)
- [ ] T003 Unit test: every team file parses and states the expected `plan` mode (R4)
- [ ] T004 Workflow test: human plan gate waits for `decide` under the committed default policy; approve → opened-pr, reject → rejected (R3)
- [ ] T005 build, unit, workflow, versioning, integration green; harness plan-gate handling checked and reported
