# Plan 010 — pre-loaded context for route, design and plan

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md` (benchmark integrity), D17, constraint C5
("the LLM is never trusted for deterministic decisions"), `graph/docs/stage-contracts.md` and
the follow-ups runbook (amendment A1).

## Shape

Ports and adapters, as the rest of `graph/`: a `ContextSource` port with a file-backed
adapter wired in `container.ts`; pure assembly and gate logic in `src/core/`; the activities
assemble context so file contents never enter Temporal history; the workflow only sees the
gate result (data) and records it. The new workflow branch sits behind
`patched('context-preload-v1')`.

## Phase 1 — context port, adapter, assembly (sonnet)

Files: `src/ports/context.ts`, `src/adapters/file-context.ts`, `src/core/context.ts`,
`config/context.json`, `tests/fixtures/checkouts/graph-sample-repo/{README.md,src/index.ts}`,
`tests/unit/context.test.ts`, `tests/unit/file-context.test.ts`. R1–R5. Tests use temp dirs
and the fixture checkout: keyword/path selection order and caps, determinism (same input →
identical JSON), integrity guard (refuses hidden-tests/tickets/reference.diff config paths;
skips `reference.diff` in walks; drops a file containing the canary prefix with the gap),
`readFiles` refuses paths outside the tree, null catalog / wiki / checkout → gaps.

## Phase 2 — plan schema and path gate (sonnet, parallel with phase 1; disjoint files)

Files: `src/core/schemas.ts` (`new_files`), `src/adapters/anthropic-schemas.ts` (mirror),
`src/core/gates.ts` (`planPathGate`), `tests/unit/{gates,schemas,anthropic-schemas}.test.ts`.
R7–R8. Gate tests: single-repo pass; missing path fails; path in `new_files` passes;
`new_files` path that exists fails; multi-repo prefix rules; null tree fails closed; reason
lists at most 10 paths.

## Phase 3 — wiring, prompts, docs (sonnet, after 1 and 2)

Files: `src/workflow/{activities,workflows,container}.ts`, `src/adapters/stub-reasoning.ts`,
`prompts/{route,design,plan}.md`, `docs/stage-contracts.md`, `tests/workflow/**`
(new plan-path stop test; existing tests stay green), versioning test still green.
R5, R6, R9–R11. Gates: `npm run build`, `npm test`, `npm run test:workflow`,
`npm run test:versioning`, `npm run test:integration` (temporal-dev on 127.0.0.1:7233; kill
stray `worker.ts` first). The orchestrator re-runs all of them.

## Risks

- Telemetry gaps merge: `recordStage` currently takes gaps only from `costAndGaps`; phase 3
  adds a `contextGaps` argument rather than changing `costAndGaps`.
- History size: only the gate result and refs cross into history; keep it that way.
- Integrity: the committed config points at `bench/orderdesk*` source trees, never
  `bench/tickets` or `bench/hidden-tests`; R3 enforces it in code, not only by config.
