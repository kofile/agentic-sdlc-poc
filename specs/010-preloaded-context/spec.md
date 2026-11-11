# Spec 010 — pre-loaded context for route, design and plan (TASK-0049)

**Board:** TASK-0049 · **Runbook:** `docs/design/follow-ups-runbook.md` (Lane 2, amendment A1)
· **Decision:** D17 (option 1: code pre-loads context; plan file-path gate in code). Merges
before TASK-0048 and TASK-0046.

## Problem

`graph/src/workflow/activities.ts` sends route only `{ticket}`, design only
`{ticket, feedback, round}` and plan only `{ticket, design}`. Route cannot see the repository
catalog, so it can only invent repo names. Design and plan see no Spec Wiki and no code, so
plan file paths are guesses. P's plan-agent reads a real checkout, so G loses for a
structural reason that would confound H6 and the plan comparison.

## Requirements

- **R1 Context port** `graph/src/ports/context.ts`, interface `ContextSource`:
  - `repositoryCatalog(): Promise<string | null>` — catalog markdown, or null if absent.
  - `specWiki(repo: string): Promise<string | null>` — that repo's Spec Wiki text, or null.
  - `fileTree(repo: string): Promise<string[] | null>` — repo-relative POSIX paths of tracked
    source files, sorted, or null when no checkout is configured or present.
  - `readFiles(repo: string, paths: string[]): Promise<{ path: string; content: string }[]>`.
- **R2 File-backed adapter** `graph/src/adapters/file-context.ts` (`FileContextSource`),
  configured by `graph/config/context.json` (path overridable by env `GRAPH_CONTEXT_CONFIG`,
  for tests). Config shape, paths relative to the config file:
  `{ "catalog": string|null, "specWikiDir": string|null, "repos": { "<name>": string } }`.
  Spec Wiki for repo `r` is `<specWikiDir>/<r>/*.md`, concatenated in natural sort order with
  a `## <file>` header each; `specWikiDir` null or `<r>` missing → null. Committed config:
  catalog → `../../bench/catalog/repository-catalog.md`; `specWikiDir: null` (the sandbox
  Confluence is not provisioned, M1); repos `orderdesk` → `../../bench/orderdesk`,
  `orderdesk-web` → `../../bench/orderdesk-web`, `graph-sample-repo` →
  `../tests/fixtures/checkouts/graph-sample-repo`.
  The file tree walk skips `node_modules`, `.git`, `dist`, `build`, `coverage` and dot-dirs.
- **R3 Integrity guard (benchmark integrity, CLAUDE.md).** The adapter refuses (throws at
  construction) any configured path that resolves inside `bench/hidden-tests`,
  `bench/tickets` or to a file named `reference.diff`; the walk also skips any file named
  `reference.diff`. `readFiles` reads only paths present in `fileTree` (no `..`, no absolute
  paths). A file whose content contains the canary prefix `BENCH-CANARY-` is never returned;
  it is dropped and reported as gap `context:canary-skipped:<repo>/<path>`. Never write the
  full canary string into any file.
- **R4 Deterministic assembly** `graph/src/core/context.ts`, pure functions, no I/O:
  - `ticketKeywords(ticket)`: lowercase word tokens (≥4 chars, `[a-z0-9]`) from title,
    description, component and labels, minus a fixed stoplist, deduped, sorted.
  - `ticketPaths(ticket)`: path-like tokens (contain `/` or end in a file extension) mentioned
    in the ticket text.
  - `selectFiles(tree, ticket, caps)`: tree paths named by `ticketPaths` first (exact or
    suffix match), then the rest scored by the number of keywords appearing in the path
    (case-insensitive), score > 0 only, descending score then path ascending; capped at
    `maxFiles` (default 12).
  - `buildRepoContext(...)`: per repo `{ name, spec_wiki, tree, files }`, tree capped at
    `maxTreePaths` (default 2000, truncation noted as gap `context:tree-truncated:<repo>`),
    each file capped at `maxFileBytes` (default 16 KiB, truncated with a marker line), total
    file bytes capped at `maxTotalBytes` (default 120 KiB; files beyond it dropped, gap
    `context:files-capped:<repo>`).
  Same inputs → byte-identical output.
- **R5 Gaps, never silent emptiness.** Absence is recorded in the stage's `telemetry_gaps`
  (merged with the cost gaps): `context:catalog-absent`, `context:spec-wiki-absent:<repo>`,
  `context:checkout-absent:<repo>`, plus the R3/R4 gaps. The prompt payload carries the same
  `gaps` array so the model knows what is missing. A stage record also gets artifact ref
  `context:<sha256 of the canonical JSON context, first 12 hex>`.
- **R6 Stage inputs (AC #2).**
  - Route prompt payload: `{ ticket, catalog, gaps }` (catalog string or null).
  - Design: `{ ticket, feedback, round, context: { repos: [...] }, gaps }` for the repos
    route chose (route `order`).
  - Plan: `{ ticket, design, context: { repos: [...] }, gaps }`, same repos.
  - Context is assembled inside the activities (activities.ts) via the port + core functions,
    so file contents never enter Temporal history. Design and plan activities take the routed
    repo names as a new trailing parameter.
- **R7 Plan schema (AC #3).** `PlanTaskSchema` gains `new_files: string[]` (default `[]`):
  paths the task creates. `files` stays "paths the task touches". The hand-written JSON
  schema in `graph/src/adapters/anthropic-schemas.ts` gains the same field (required,
  string array, matching how `files` is declared); its parity test is updated.
- **R8 Plan file-path gate (AC #3)** `planPathGate(plan, trees)` in `graph/src/core/gates.ts`,
  pure: `trees` maps repo name → tree (or null). With one routed repo, paths are
  repo-relative; with several, every path must start with `<repo>/`. Fails when any `files`
  path neither exists in its repo's tree nor appears in that task's `new_files`; when a
  `new_files` path already exists; when a path names an unrouted repo (multi-repo); or when
  a referenced repo's tree is null (fail closed: `checkout unavailable`). Reason lists the
  offending paths (first 10). The plan activity runs it after a valid output and returns
  `{ ...StageCallResult, pathGate: { pass, reason } }`.
- **R9 Workflow.** After plan, the workflow records the gate (`recordGateOutcome`, stage
  `plan`, name `Plan paths exist?`) and on fail transitions the ticket to
  `Waiting for Info` and returns new status `{ status: 'stopped-at-plan-paths', reason, log }`.
  The new gate and the changed design/plan arguments sit behind
  `patched('context-preload-v1')` (pattern: `graph/tests/versioning/fixtures/workflows-v2-patched.ts`),
  so an in-flight run replays unchanged.
- **R10 Prompts.** `graph/prompts/route.md` names `catalog` (choose only repositories that
  appear in it; if null, say so in `role` and keep confidence low). `design.md` and `plan.md`
  name `context` and `gaps`; `plan.md` says every `files` path must exist in the given tree
  or be listed in `new_files`, and multi-repo paths are prefixed `<repo>/`. No
  ticket-specific hints. `graph/docs/stage-contracts.md` updated for the new inputs, the
  `new_files` field and the plan path gate.
- **R11 Stub and fixtures.** `StubReasoning` plan output uses only paths that exist in the
  fixture checkout or are in `new_files`, so the happy path passes the gate. Fixture checkout
  `graph/tests/fixtures/checkouts/graph-sample-repo/` holds `README.md` and
  `src/index.ts` (tiny placeholders). A stub knob (e.g. `forcePlanFiles`) lets a workflow
  test drive a bad path to the new stop status.

## Constraints

- Benchmark integrity, verbatim from CLAUDE.md: "When working on `graph/` or any contender
  code, do not read `bench/hidden-tests/`, `bench/tickets/expected.draft.yaml` or
  `bench/*/reference.diff`." Implementers may read `bench/catalog/` and list (not need to
  read) `bench/orderdesk*` trees; tests use the fixture checkout and temp dirs only.
- No new dependencies. Node 22, exact versions unchanged.
- No network, no Keychain, no real model calls in any test.
- Footprint: `graph/src/ports/context.ts`, `graph/src/adapters/file-context.ts`,
  `graph/src/core/{context,gates,schemas}.ts`, `graph/src/adapters/{anthropic-schemas,stub-reasoning}.ts`,
  `graph/src/workflow/{activities,workflows,container}.ts`, `graph/config/context.json`,
  `graph/prompts/{route,design,plan}.md`, `graph/docs/stage-contracts.md`, `graph/tests/**`,
  this spec dir.
- Escalation to the hybrid (typed extra-file requests) is out of scope (D17).
