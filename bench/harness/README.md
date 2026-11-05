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
unless `--include-stub`. `export` writes one stored record per line.

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

## Out of scope

Repo reset between runs, sandbox Jira, scoring (TASK-0014), the P/N/G adapters, charts (TASK-0020).
