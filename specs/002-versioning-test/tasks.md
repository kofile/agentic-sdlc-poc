# Tasks 002 — Temporal workflow-versioning test

## Phase 1: Fixtures and in-flight test

- [ ] T001 Add `graph/tests/versioning/fixtures/workflows-v2-patched.ts` and `workflows-v2-unpatched.ts` per plan
- [ ] T002 Add `graph/tests/versioning/in-flight.test.ts`: run A starts on v1, waits at design gate, worker swap to v2-patched, approval, run A completes without the new step
- [ ] T003 Same test file: run B on v2-patched takes the new step
- [ ] T004 Same test file: replay run A history against v2-unpatched fails with a determinism error; against v2-patched passes
- [ ] T005 Add `test:versioning` script; `npm run test:versioning`, `npm test`, `npm run test:workflow`, `npm run build` all green

## Phase 2: Evidence

- [ ] T006 Write `notes/spike-04-versioning.md` (method, commands, results, limits, plain paragraph)
- [ ] T007 Add a dated note under section 7 of `notes/00-discovery-log.md` pointing D7's follow-up to the evidence file
