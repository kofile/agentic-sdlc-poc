# bench harness

The `bench` CLI, SQLite store and uniform stage-run record for the benchmark
(`notes/02-benchmark-spec.md` section 7; `specs/003-bench-harness/`). Node 22, TypeScript.

## Usage

```
npm install
npm run bench -- run --contender stub --ticket T01 --rep 1 --stages triage..plan --seed-order 1 [--set dev|heldout]
npm run bench -- report [--format md|json] [--include-stub]
npm run bench -- export --out runs.jsonl
npm run build && npm test
```

`report` aggregates per contender x stage (runs, completed, median wall ms, total tokens,
total cost, union of telemetry gaps) from SQLite only. The `stub` contender is excluded
unless `--include-stub`; so is every run with at least one stage record carrying the `no_real_model`
gap (stub-backed G runs). `--include-stub` includes both. `export` is a raw dump and is unchanged. `export` writes one stored record per line.

## Environment

- `BENCH_DB` path of the SQLite file (default `./bench.sqlite`)
- `BENCH_ARTIFACTS` root for per-run artifact dirs (default `./artifacts`)

## Adapter contract

1. One adapter per contender (`P | N | G | stub`), registered in `src/adapters/registry.ts`.
2. `version()` returns the contender version string recorded on every record.
3. `run(ctx)` is an async generator yielding one `StageEvent` per stage (`{ stage, ...fields }`).
4. The core fills harness-owned fields (run id, version, contender, ticket, rep, set), validates the
   whole record with zod (strict) and stores it; an invalid record fails the run and is not stored.
5. Adapters write artifacts under `ctx.artifact_dir` and cite them in `output.artifact_refs`.

## No silent zeros (spec R3a)

`telemetry_gaps` is mandatory: an event without it fails validation. Every measurement field the
core fills with a default because the adapter omitted it gets `defaulted:<field path>` appended to
`telemetry_gaps` (timings, `tokens.*`, `cost_usd.*`, `llm_calls`, `tool_calls`, `model_served`), so a
missing number is shown with the gap named, never as a plain zero.

## node:sqlite loading quirk

Vite/vitest strips the `node:` prefix and cannot resolve a static `import 'node:sqlite'`. The store
loads it at runtime with `process.getBuiltinModule('node:sqlite')`. Only `src/store.ts` touches it;
the CLI filters just the sqlite `ExperimentalWarning`.

## G adapter (contender G, `src/adapters/g/`)

Runs one graph (Temporal) workflow per bench run and maps `graph/.run-state/telemetry.jsonl` to stage
records (`specs/006-g-adapter/`).

```
BENCH_G_TEAM=default npm run bench -- run --contender G --ticket T01 --rep 1 --stages triage..open_pr --seed-order 1
npm run test:g     # opt-in end-to-end test (BENCH_G_E2E=1), needs the prerequisites below
```

- `--stages` must start at `triage`; supported ends are `triage` through `open_pr`. After the last
  requested stage has its record the workflow is cancelled, so `triage..route` does not pay for design.
- Env: `BENCH_G_TEAM` (`auto` | `default` | `strict`, default `auto`), `BENCH_G_BUDGET_SECONDS`
  (default 60), `GRAPH_REASONING` and `TEMPORAL_ADDRESS` (default `127.0.0.1:7233`) pass through to the worker.
  A run with `GRAPH_REASONING` other than `anthropic` is refused unless `BENCH_G_ALLOW_STUB=1`; stub-backed
  records carry `model_served: stub`, zero token cost and the `no_real_model` gap, and `report` omits them.
- Prerequisites: a Temporal dev server (temporal-dev), `npm ci` in `graph/`, the execute-host image.
- The adapter spawns its own graph worker (detached, per-run task queue) and kills its process group on
  every exit path. Do not run another worker on the same queue.
- **Scripted approvals.** At a human gate the adapter acts as the benchmark's scripted approver: it signals
  `decide` with `approved: true, by: 'bench-scripted'` and writes an `interventions` row with kind
  `scripted_approval`. These do not count toward a stage's `interventions` metric or set `assisted`
  (decision D13). The wait is added to `waiting_ms` and subtracted from `active_ms`.
- `gate.expected` / `gate.correct` stay unset for G records (scoring is TASK-0014); an absent `correct`
  means "not scored", not false.

## Out of scope

Repo reset between runs, sandbox Jira, scoring (TASK-0014), the P/N adapters, charts (TASK-0020).
