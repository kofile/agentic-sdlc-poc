# Graph system — walking skeleton (Lane B)

An end-to-end runnable pipeline for one ticket — triage -> route -> design -> [human gate] ->
plan -> [human gate] -> execute -> open-pr — as a Temporal (TypeScript) workflow, built
hexagonal (core + ports + stub adapters) so real adapters (Jira, Confluence, GitHub/Azure
Repos, a real model) can replace the stubs here without touching the workflow or core logic.

## Architecture, in 10 lines

- **core/** is pure, deterministic: zod schemas for stage outputs, the triage/route code
  gates, the gate-policy type, and the telemetry record. No I/O.
- **ports/** are TypeScript interfaces (Reasoning, Tracker, Docs, Vcs, ExecuteHost, Clock,
  Config) — the hexagon's edge.
- **adapters/** implement ports. Here they're stubs: in-memory Tracker/Docs/Vcs with a call
  ledger, a deterministic StubReasoning, a real `DockerExecuteHost` (copied from spike 3)
  running a stub coding agent in a real container.
- **workflow/** is the Temporal layer: `workflows.ts` is the graph itself (pure, runs in
  Temporal's deterministic sandbox — no I/O, no `Date.now()`), `activities.ts` is every
  side-effecting call (wraps the ports), `worker.ts`/`client.ts` run and talk to it.
- A **Signal** (`decide`) carries human gate approve/reject, keyed `gate#round` so duplicate
  and stale signals are dropped in-workflow; a **Query** (`state`) exposes what's pending.
- **Gate policy is data** (`teams/*.json`), loaded once per run through an activity (the
  workflow sandbox forbids file reads) and snapshotted — a mid-run edit never changes a
  running workflow.

## Running it

Prereqs: Docker running, `npm install` in this directory.

```bash
# 1. Temporal dev server (SQLite inside the container; same recipe as spike 2)
docker run -d --name temporal-dev -p 127.0.0.1:7233:7233 -p 127.0.0.1:8233:8233 \
  temporalio/temporal:latest server start-dev --ip 0.0.0.0

# 2. Build the execute-host image (the stub coding agent container, from spike 3)
docker build -t sdlc-graph-poc-execute-host:latest container/

# 3. Worker (leave running in its own terminal)
npm run worker

# 4. Start a run (auto team = no human gates, fastest path to a PR)
npm run run -- --ticket tickets/sample-ticket.md --team auto

# Human-gated team: the CLI will print `waiting-on=design#1`; from another terminal:
npm run approve -- --run <workflowId> --gate design --round 1
npm run reject  -- --run <workflowId> --gate design --round 1 --feedback "needs X"

# Check status/progress at any time:
npm run status -- --run <workflowId>
```

Output: a `StageRunRecord` per stage, per `notes/02-benchmark-spec.md` section 7, appended to
`.run-state/telemetry.jsonl` (contender `"G"`). `.run-state/` also holds the bare git repo the
execute stage clones from/pushes to, and per-job state for the Docker execute host.

## Tests

```bash
npm run test              # Vitest unit tests: schemas, gates, telemetry, stub reasoning retries
npm run test:workflow     # Vitest + @temporalio/testing time-skipping: the graph's control flow
npm run test:integration  # real dev server + real Docker execute host (needs Docker, ~15s)
```

`test:workflow` mocks every activity (never the real stub-reasoning/Docker adapters) so it
runs in seconds via time-skipping and covers: happy path, triage stop (C/D), reject-and-redo
loop (+ max-rounds cap), duplicate/concurrent/stale approval signals, and human-gate timeout
(auto-reject and escalate). `test:integration` is a plain Node script (not Vitest — it starts
and SIGKILLs real worker processes) covering the Docker execute host end to end and
kill-the-worker-mid-execute-then-resume.

## What is stubbed

- **Reasoning**: `StubReasoning` — no model call, deterministic ticket-derived output, but the
  real contract (zod validation, bound retries on schema failure, usage/model telemetry) is
  exercised, including an induced-failure test hook (`knobs.failSchemaNTimes`).
- **Tracker / Docs / Vcs**: in-memory, Jira/Confluence/GitHub-shaped, each with an
  idempotency-keyed ledger so duplicate calls are detectable.
- **ExecuteHost**: real — `DockerExecuteHost` from spike 3 runs a real stub agent in a real
  container against a real local bare-git remote; only the *agent* (what writes the diff) is
  a stub, not the host mechanics (attach/list/reapOrphans, poll fallback, file-mounted
  secrets, heartbeat-based worker-death detection).
- **Price table** (`config/prices.json`): placeholder numbers, explicitly marked
  `UNVERIFIED: true`. The operator must verify against current provider pricing before any
  scored benchmark run.

**First real adapter I would build next:** the Reasoning adapter for the actual model API
(Anthropic Messages API with a JSON-schema-constrained or tool-call output, same zod
validate-and-retry contract `StubReasoning` already proves out). It unlocks real triage/route/
design/plan content without touching the workflow, and lets the benchmark harness
(`notes/02-benchmark-spec.md`) start recording real token/cost numbers instead of
`telemetry_gaps: []` placeholders. Tracker/Docs/Vcs real adapters come after (out of scope
this round per the dispatch).

## Contradictions with the spike findings

None found. This implementation follows spike-02's proven gate-keying design (`gate#round`,
first-decision-wins, condition()+timer for durable timeout) and spike-03's `ExecuteHost`
interface and runner shape verbatim (copied, not imported). One addition beyond what the
spikes tested: a bounded reject-round cap (`maxRejectRounds`) and an `onTimeout: escalate`
path that comments on the ticket, neither of which the spikes needed to test but both of
which the dispatch required.

## Size (rough, non-blank lines)

- **Core** (`src/core/`): ~140 LOC (schemas, gates, telemetry) — pure, no I/O.
- **Ports** (`src/ports/`): ~160 LOC (7 interfaces, mostly copied verbatim from spike 3 for
  ExecuteHost).
- **Adapters** (`src/adapters/`): ~430 LOC, of which ~250 is the Docker execute host +
  HMAC/receiver/reconciler copied from spike 3 nearly verbatim; the stub Reasoning/Tracker/
  Docs/Vcs adapters are ~180 LOC combined.
- **Workflow** (`src/workflow/`): ~260 LOC (the graph itself is ~140, activities ~140 minus
  shared helpers, worker/client/container are thin).
- **CLI** (`src/cli/`): ~140 LOC.
- **Tests**: ~90 LOC unit, ~330 LOC workflow (incl. shared harness), ~130 LOC integration.

## What I could not finish

- No real Reasoning/Tracker/Docs/Vcs adapter — explicitly out of scope this round.
- No workflow-versioning test (explicitly out of scope — Day 3 item per the discovery log).
- The `strict` team's `merge: human` gate exists in `teams/strict.json` but the workflow
  currently treats `merge` as always-auto (there is no `open-pr -> merge` stage in this
  skeleton's scope; `open-pr` is the last stage per the dispatch). The gate policy schema and
  `teams/*.json` are ready for a `merge` stage to be added without a schema change.
- Benchmark-harness integration (writing `bench.sqlite`, the `bench run --contender G`
  adapter) is not built — only the uniform `StageRunRecord` JSONL output it would consume.
- Load/concurrency testing of multiple simultaneous runs against one worker was not done
  (the integration script runs one workflow at a time).
