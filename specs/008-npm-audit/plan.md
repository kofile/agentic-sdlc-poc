# Plan 008 — npm audit dispositions

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md`, D12, spec 005 and the follow-ups runbook
(C7 ruling).

Phases 1 and 2 touch disjoint directories and may run in parallel; phase 3 runs after both.

## Phase 1 — graph/

- `npm install --save-exact zod@4.6.7 vitest@2.1.9` (dev for vitest), from `graph/`.
- Fix compile/test fallout from zod 4. Known candidates: `z.ZodTypeAny` / `._def.innerType`
  use in `tests/unit/anthropic-schemas.test.ts` (zod 4 keeps `ZodOptional`/`ZodDefault` and
  exposes the inner type as `.unwrap()` / `._zod.def.innerType`; prefer `.unwrap()`),
  `z.record` (already two-argument), `.default()` on nested objects (zod 4 short-circuits on
  `undefined`; check `telemetry.ts` defaults still produce the same parsed records). Keep
  edits minimal; no refactors.
- Do not edit `src/adapters/anthropic-schemas.ts`.
- Gates: `npm run build && npm test && npm run test:workflow && npm run test:versioning`.
  (Integration is re-run by the orchestrator.)

## Phase 2 — bench/harness/

- Same install from `bench/harness/`: zod 4.6.7, vitest 2.1.9, exact.
- Fix fallout in `src/record.ts`, `src/store.ts`, `src/core/run.ts` (`describe` reads
  `ZodError.issues` — still present in zod 4), tests. Minimal edits.
- Gates: `npm run build && npm test`. (`test:g` is re-run by the orchestrator against
  temporal-dev.)

## Phase 3 — record

- `npm audit --json` in both packages; summarise what cleared and what remains, mapping to
  F1–F8 in spec.md, into tasks.md's verification record (orchestrator) — the implementer
  reports the raw summary.
- Two decision rows in `notes/00-discovery-log.md` section 7 (next free ids after D13):
  zod 4.6.7 upgrade; vitest chain dev-only acceptance (C7b, with the "no vitest UI/API/vite
  dev server, local-only tests" rationale and C7c's out-of-scope note). Three-way grade
  columns as in existing rows; evidence `specs/008-npm-audit/spec.md`.

## Verification (orchestrator re-runs)

graph: build, unit, workflow, versioning, integration. harness: build, test, `test:g`.
`npm audit --omit=dev` clean in both. Canary grep 0. Exact versions in both package.json.
