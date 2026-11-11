# Tasks 011 — plan gate policy

## Phase 1: Policy files, docs and tests

- [x] T001 `plan` in `teams/{auto,default,strict}.json` (auto, human, human) (R1)
- [x] T002 `merge` documented as reserved; README and stage-contracts list `plan` as policy-driven (R2)
- [x] T003 Unit test: every team file parses and states the expected `plan` mode (R4)
- [x] T004 Workflow test: human plan gate waits for `decide` under the committed default policy; approve → opened-pr, reject → rejected (R3)
- [x] T005 build, unit, workflow, versioning, integration green; harness plan-gate handling checked and reported
